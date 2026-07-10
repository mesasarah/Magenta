// Server-only helpers for the multimodal RAG pipeline.
// Handles AI gateway calls (extraction, transcription, embeddings, synthesis)
// and Supabase server client creation. Never imported by client code.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const CHAT_MODEL = "google/gemini-3-flash-preview";
const EMBED_MODEL = "openai/text-embedding-3-small";

export function createServerSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

function apiKey(): string {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("Missing LOVABLE_API_KEY");
  return k;
}

async function gatewayJson(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI rate limit reached. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits to your workspace to continue.");
    throw new Error(`AI processing failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

/* ------------------------------ Embeddings ------------------------------ */

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64);
    const json = await gatewayJson("/embeddings", { model: EMBED_MODEL, input: batch });
    const sorted = [...json.data].sort((a: any, b: any) => a.index - b.index);
    out.push(...sorted.map((d: any) => d.embedding as number[]));
  }
  return out;
}

/* ------------------------------ JSON parsing ----------------------------- */

function parseModelJson(raw: string): any {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  return JSON.parse(text);
}

/* --------------------------- Document extraction ------------------------- */

export interface ExtractedDocument {
  summary: string;
  pages: { page: number; text: string }[];
}

export async function extractDocument(
  base64: string,
  mime: string,
  filename: string,
): Promise<ExtractedDocument> {
  const json = await gatewayJson("/chat/completions", {
    model: CHAT_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "Extract the complete text content of this document, page by page.",
              "Include text visible in figures, tables and slides (perform OCR when needed).",
              'Respond with ONLY valid JSON, no markdown fences, in this exact shape:',
              '{"summary": "one-sentence summary of the document", "pages": [{"page": 1, "text": "full text of page 1"}]}',
            ].join(" "),
          },
          { type: "file", file: { filename, file_data: `data:${mime};base64,${base64}` } },
        ],
      },
    ],
  });
  const parsed = parseModelJson(json.choices[0].message.content);
  const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    pages: pages
      .filter((p: any) => typeof p?.text === "string" && p.text.trim().length > 0)
      .map((p: any, i: number) => ({ page: Number(p.page) || i + 1, text: String(p.text) })),
  };
}

/* ----------------------------- Media analysis ---------------------------- */

export interface MediaAnalysis {
  summary: string;
  durationSeconds: number | null;
  segments: { start: number; end: number; text: string }[];
  visuals: { time: number; description: string }[];
}

const AUDIO_FORMATS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/flac": "flac",
  "audio/aac": "aac",
};

export async function analyzeMedia(
  base64: string,
  mime: string,
  kind: "video" | "audio",
  filename: string,
): Promise<MediaAnalysis> {
  const promptVideo = [
    "Analyze this video for a multimodal search index.",
    "1. Produce a precise time-stamped transcript of everything spoken (start/end in seconds).",
    "2. Describe the key visual content (objects, people, on-screen text, charts, scene changes) roughly every 3-6 seconds or whenever the scene changes, each with its timestamp in seconds.",
    'Respond with ONLY valid JSON, no markdown fences, in this exact shape:',
    '{"summary": "one-sentence summary", "duration_seconds": 123, "segments": [{"start": 0, "end": 6.5, "text": "spoken words"}], "visuals": [{"time": 2, "description": "what is visible on screen"}]}',
  ].join(" ");

  const promptAudio = [
    "Transcribe this audio with timestamps for a search index.",
    'Respond with ONLY valid JSON, no markdown fences, in this exact shape:',
    '{"summary": "one-sentence summary", "duration_seconds": 123, "segments": [{"start": 0, "end": 6.5, "text": "spoken words"}], "visuals": []}',
  ].join(" ");

  const mediaBlock =
    kind === "audio"
      ? {
          type: "input_audio",
          input_audio: { data: base64, format: AUDIO_FORMATS[mime] ?? "mp3" },
        }
      : {
          type: "file",
          file: { filename, file_data: `data:${mime};base64,${base64}` },
        };

  const json = await gatewayJson("/chat/completions", {
    model: CHAT_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: kind === "video" ? promptVideo : promptAudio },
          mediaBlock,
        ],
      },
    ],
  });

  const parsed = parseModelJson(json.choices[0].message.content);
  const segments = (Array.isArray(parsed.segments) ? parsed.segments : [])
    .filter((s: any) => typeof s?.text === "string" && s.text.trim().length > 0)
    .map((s: any) => ({
      start: Number(s.start) || 0,
      end: Number(s.end) || Number(s.start) || 0,
      text: String(s.text),
    }));
  const visuals = (Array.isArray(parsed.visuals) ? parsed.visuals : [])
    .filter((v: any) => typeof v?.description === "string" && v.description.trim().length > 0)
    .map((v: any) => ({ time: Number(v.time) || 0, description: String(v.description) }));

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    durationSeconds:
      parsed.duration_seconds != null ? Number(parsed.duration_seconds) : null,
    segments,
    visuals,
  };
}

/* -------------------------------- Chunking ------------------------------- */

export interface PendingChunk {
  content: string;
  modality: "transcript" | "visual" | "text";
  start_seconds: number | null;
  end_seconds: number | null;
  page_number: number | null;
}

export function chunkSegments(
  segments: { start: number; end: number; text: string }[],
  maxLen = 500,
): PendingChunk[] {
  const chunks: PendingChunk[] = [];
  let buf: typeof segments = [];
  let len = 0;
  const flush = () => {
    if (buf.length === 0) return;
    chunks.push({
      content: buf.map((s) => s.text).join(" "),
      modality: "transcript",
      start_seconds: buf[0].start,
      end_seconds: buf[buf.length - 1].end,
      page_number: null,
    });
    buf = [];
    len = 0;
  };
  for (const seg of segments) {
    buf.push(seg);
    len += seg.text.length;
    if (len >= maxLen) flush();
  }
  flush();
  return chunks;
}

export function chunkVisuals(
  visuals: { time: number; description: string }[],
): PendingChunk[] {
  return visuals.map((v) => ({
    content: v.description,
    modality: "visual" as const,
    start_seconds: v.time,
    end_seconds: v.time,
    page_number: null,
  }));
}

export function chunkPages(
  pages: { page: number; text: string }[],
  maxLen = 1100,
): PendingChunk[] {
  const chunks: PendingChunk[] = [];
  for (const p of pages) {
    const text = p.text.trim();
    if (!text) continue;
    for (let i = 0; i < text.length; i += maxLen) {
      chunks.push({
        content: text.slice(i, i + maxLen),
        modality: "text",
        start_seconds: null,
        end_seconds: null,
        page_number: p.page,
      });
    }
  }
  return chunks;
}

/* ------------------------------- Synthesis ------------------------------- */

export async function synthesizeAnswer(
  question: string,
  contextBlocks: string[],
): Promise<string> {
  const json = await gatewayJson("/chat/completions", {
    model: CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You are an enterprise knowledge assistant answering questions from an indexed library of documents and videos.",
          "Use ONLY the numbered sources provided. Cite every claim with bracketed source numbers like [1] or [2].",
          "When evidence combines spoken words and visuals at the same moment in a video, explicitly connect them (e.g. 'while the speaker explains X, the slide shows Y [3]').",
          "Mention timestamps (m:ss) for video evidence and page numbers for documents.",
          "If the sources do not contain the answer, say so plainly.",
          "Write clear plain text paragraphs. No markdown headings, no bullet asterisks, no bold markers.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Question: ${question}\n\nSources:\n${contextBlocks.join("\n\n")}`,
      },
    ],
  });
  return String(json.choices[0].message.content ?? "").trim();
}

/* -------------------------------- Encoding ------------------------------- */

export function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}
