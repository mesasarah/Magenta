// Server functions: ingestion pipeline + hybrid retrieval & synthesis.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  analyzeMedia,
  bufferToBase64,
  chunkPages,
  chunkSegments,
  chunkVisuals,
  createServerSupabase,
  embedTexts,
  extractDocument,
  synthesizeAnswer,
  type PendingChunk,
} from "./rag.server";
import type { ChunkModality, FileKind, SearchResult, SearchSource } from "./rag-types";

const MAX_BYTES = 26 * 1024 * 1024; // ~26MB raw -> ~35MB base64

/* ------------------------------ processFile ------------------------------ */

export const processFile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ fileId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createServerSupabase();

    const { data: file, error: fileErr } = await supabase
      .from("files")
      .select("*")
      .eq("id", data.fileId)
      .single();
    if (fileErr || !file) throw new Error("File record not found");

    const fail = async (message: string) => {
      await supabase
        .from("files")
        .update({ status: "failed", error: message.slice(0, 500) })
        .eq("id", file.id);
      return { ok: false as const, error: message };
    };

    try {
      if (file.size_bytes > MAX_BYTES) {
        return await fail("File too large to index (limit ~25MB). Try a shorter clip or smaller document.");
      }

      // 1. Download the raw file from storage
      const { data: blob, error: dlErr } = await supabase.storage
        .from("media")
        .download(file.storage_path);
      if (dlErr || !blob) return await fail(`Could not download file: ${dlErr?.message ?? "unknown"}`);

      const base64 = bufferToBase64(await blob.arrayBuffer());

      // 2. Extract content per modality
      let pending: PendingChunk[] = [];
      let summary = "";
      let duration: number | null = null;
      let pageCount: number | null = null;

      if (file.kind === "document") {
        if (file.mime_type.startsWith("text/")) {
          const text = new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
          pending = chunkPages([{ page: 1, text }]);
          pageCount = 1;
          summary = text.slice(0, 180);
        } else {
          const doc = await extractDocument(base64, file.mime_type, file.name);
          pending = chunkPages(doc.pages);
          pageCount = doc.pages.length;
          summary = doc.summary;
        }
      } else {
        const media = await analyzeMedia(
          base64,
          file.mime_type,
          file.kind as "video" | "audio",
          file.name,
        );
        pending = [...chunkSegments(media.segments), ...chunkVisuals(media.visuals)];
        duration = media.durationSeconds;
        summary = media.summary;
      }

      if (pending.length === 0) {
        return await fail("No indexable content was found in this file.");
      }

      // 3. Embed and store
      const embeddings = await embedTexts(pending.map((c) => c.content));
      const rows = pending.map((c, i) => ({
        file_id: file.id,
        content: c.content,
        modality: c.modality,
        start_seconds: c.start_seconds,
        end_seconds: c.end_seconds,
        page_number: c.page_number,
        embedding: JSON.stringify(embeddings[i]),
      }));

      // Replace any previous chunks for idempotent re-processing
      await supabase.from("chunks").delete().eq("file_id", file.id);
      for (let i = 0; i < rows.length; i += 100) {
        const { error: insErr } = await supabase.from("chunks").insert(rows.slice(i, i + 100));
        if (insErr) return await fail(`Indexing failed: ${insErr.message}`);
      }

      await supabase
        .from("files")
        .update({
          status: "indexed",
          error: null,
          summary: summary || null,
          duration_seconds: duration,
          page_count: pageCount,
          indexed_at: new Date().toISOString(),
        })
        .eq("id", file.id);

      return { ok: true as const, chunks: rows.length };
    } catch (e) {
      return await fail(e instanceof Error ? e.message : "Unexpected processing error");
    }
  });

/* ------------------------------ searchKnowledge -------------------------- */

interface Hit {
  id: string;
  file_id: string;
  content: string;
  modality: ChunkModality;
  start_seconds: number | null;
  end_seconds: number | null;
  page_number: number | null;
  similarity: number;
}

const TEMPORAL_WINDOW = 25; // seconds — merge evidence from the same moment

export const searchKnowledge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ question: z.string().min(2).max(600) }).parse(input),
  )
  .handler(async ({ data }): Promise<SearchResult> => {
    const supabase = createServerSupabase();

    const [queryEmbedding] = await embedTexts([data.question]);
    const { data: hitsRaw, error } = await supabase.rpc("match_chunks", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: 18,
    });
    if (error) throw new Error(`Search failed: ${error.message}`);

    const hits = ((hitsRaw ?? []) as Hit[]).filter((h) => h.similarity > 0.1);
    if (hits.length === 0) {
      return {
        answer:
          "I couldn't find anything relevant in the knowledge base. Upload documents or videos first, or try rephrasing your question.",
        sources: [],
      };
    }

    // Load file metadata
    const fileIds = [...new Set(hits.map((h) => h.file_id))];
    const { data: files } = await supabase
      .from("files")
      .select("id, name, kind, mime_type, storage_path")
      .in("id", fileIds);
    const fileMap = new Map((files ?? []).map((f) => [f.id, f]));

    // Temporal reranking: merge hits from the same file within a time window,
    // so spoken transcript + visual evidence at the same moment form one source.
    interface Group {
      fileId: string;
      hits: Hit[];
      start: number | null;
      end: number | null;
      page: number | null;
      best: number;
    }
    const groups: Group[] = [];

    const timeHits = hits
      .filter((h) => h.start_seconds != null)
      .sort(
        (a, b) =>
          a.file_id.localeCompare(b.file_id) ||
          (a.start_seconds ?? 0) - (b.start_seconds ?? 0),
      );
    for (const h of timeHits) {
      const last = groups[groups.length - 1];
      if (
        last &&
        last.fileId === h.file_id &&
        last.start != null &&
        h.start_seconds != null &&
        h.start_seconds - (last.end ?? last.start) <= TEMPORAL_WINDOW
      ) {
        last.hits.push(h);
        last.end = Math.max(last.end ?? 0, h.end_seconds ?? h.start_seconds ?? 0);
        last.best = Math.max(last.best, h.similarity);
      } else {
        groups.push({
          fileId: h.file_id,
          hits: [h],
          start: h.start_seconds,
          end: h.end_seconds ?? h.start_seconds,
          page: null,
          best: h.similarity,
        });
      }
    }

    // Document hits: group by file + page
    const pageKey = (h: Hit) => `${h.file_id}:${h.page_number ?? 0}`;
    const pageGroups = new Map<string, Group>();
    for (const h of hits.filter((x) => x.start_seconds == null)) {
      const key = pageKey(h);
      const g = pageGroups.get(key);
      if (g) {
        g.hits.push(h);
        g.best = Math.max(g.best, h.similarity);
      } else {
        pageGroups.set(key, {
          fileId: h.file_id,
          hits: [h],
          start: null,
          end: null,
          page: h.page_number,
          best: h.similarity,
        });
      }
    }
    groups.push(...pageGroups.values());
    groups.sort((a, b) => b.best - a.best);
    const top = groups.slice(0, 8);

    const fmt = (t: number) => {
      const s = Math.floor(t);
      return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
    };

    const sources: SearchSource[] = [];
    const contextBlocks: string[] = [];
    top.forEach((g, i) => {
      const f = fileMap.get(g.fileId);
      if (!f) return;
      const n = sources.length + 1;
      const modalities = [...new Set(g.hits.map((h) => h.modality))];
      const transcriptText = g.hits
        .filter((h) => h.modality === "transcript" || h.modality === "text")
        .map((h) => h.content)
        .join(" ");
      const visualText = g.hits
        .filter((h) => h.modality === "visual")
        .map((h) => `[on screen @ ${fmt(h.start_seconds ?? 0)}] ${h.content}`)
        .join(" ");
      const combined = [transcriptText, visualText].filter(Boolean).join("\n");

      let locator = "";
      if (g.start != null) locator = `@ ${fmt(g.start)}${g.end != null && g.end !== g.start ? `–${fmt(g.end)}` : ""}`;
      else if (g.page != null) locator = `page ${g.page}`;

      contextBlocks.push(`[${n}] ${f.kind} "${f.name}" ${locator} (${modalities.join("+")}):\n${combined.slice(0, 1600)}`);
      sources.push({
        n,
        fileId: f.id,
        fileName: f.name,
        kind: f.kind as FileKind,
        mimeType: f.mime_type,
        storagePath: f.storage_path,
        modalities,
        startSeconds: g.start,
        endSeconds: g.end,
        pageNumber: g.page,
        snippet: combined.slice(0, 320),
        similarity: g.best,
      });
    });

    const answer = await synthesizeAnswer(data.question, contextBlocks);

    await supabase.from("queries").insert({
      question: data.question,
      answer,
      citations: JSON.parse(JSON.stringify(sources)),
    });

    return { answer, sources };
  });
