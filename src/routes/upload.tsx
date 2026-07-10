import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { UploadCloud, FileText, Film, AudioLines, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { processFile } from "@/lib/rag.functions";
import { kindFromMime } from "@/lib/rag-types";

export const Route = createFileRoute("/upload")({
  component: UploadPage,
});

const ACCEPT = ".pdf,.txt,.md,video/*,audio/*";
const MAX_MB = 25;

interface UploadItem {
  name: string;
  size: number;
  state: "uploading" | "indexing" | "done" | "error";
  message?: string;
}

function iconFor(name: string) {
  if (/\.(mp4|mov|webm|mkv|avi)$/i.test(name)) return Film;
  if (/\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(name)) return AudioLines;
  return FileText;
}

function UploadPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const runProcess = useServerFn(processFile);

  const setItem = (name: string, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((i) => (i.name === name ? { ...i, ...patch } : i)));

  const handleFiles = async (list: FileList | File[]) => {
    const files = Array.from(list);
    for (const file of files) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setItems((prev) => [
          ...prev,
          { name: file.name, size: file.size, state: "error", message: `Over ${MAX_MB}MB limit` },
        ]);
        continue;
      }
      setItems((prev) => [...prev, { name: file.name, size: file.size, state: "uploading" }]);

      try {
        const mime = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "text/plain");
        const kind = kindFromMime(mime);

        // 1. Create metadata record
        const { data: row, error: insErr } = await supabase
          .from("files")
          .insert({
            name: file.name,
            kind,
            mime_type: mime,
            size_bytes: file.size,
            storage_path: "pending",
            status: "processing",
          })
          .select("id")
          .single();
        if (insErr || !row) throw new Error(insErr?.message ?? "Could not create record");

        // 2. Upload binary to storage
        const path = `${row.id}/${file.name}`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, file, {
          contentType: mime,
          upsert: true,
        });
        if (upErr) {
          await supabase.from("files").delete().eq("id", row.id);
          throw new Error(upErr.message);
        }
        await supabase.from("files").update({ storage_path: path }).eq("id", row.id);

        // 3. Kick off the ingestion pipeline (extraction → embeddings → index)
        setItem(file.name, { state: "indexing" });
        runProcess({ data: { fileId: row.id } })
          .then((res) => {
            if (res && "ok" in res && !res.ok) {
              setItem(file.name, { state: "error", message: res.error });
            } else {
              setItem(file.name, { state: "done" });
            }
          })
          .catch((e) =>
            setItem(file.name, {
              state: "error",
              message: e instanceof Error ? e.message : "Processing failed",
            }),
          );
      } catch (e) {
        setItem(file.name, {
          state: "error",
          message: e instanceof Error ? e.message : "Upload failed",
        });
      }
    }
  };

  const busy = items.some((i) => i.state === "uploading");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold">Upload &amp; Index</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        PDFs, text files, videos and audio up to {MAX_MB}MB. Videos are transcribed
        and visually analyzed; documents are extracted page by page — everything
        becomes searchable with precise citations.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-8 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
          dragging ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/50 hover:bg-accent/40"
        }`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
          <UploadCloud className="h-7 w-7" />
        </div>
        <p className="font-semibold">Drag &amp; drop files here</p>
        <p className="text-sm text-muted-foreground">or click to browse — PDF, MP4, MP3, TXT…</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-8 space-y-3">
          {items.map((item, idx) => {
            const Icon = iconFor(item.name);
            return (
              <div key={`${item.name}-${idx}`} className="card-elevated flex items-center gap-4 px-4 py-3">
                <Icon className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full bg-primary transition-all duration-500 ${
                        item.state === "uploading"
                          ? "w-1/3 animate-pulse"
                          : item.state === "indexing"
                            ? "w-2/3 animate-pulse"
                            : "w-full"
                      } ${item.state === "error" ? "bg-destructive" : ""}`}
                    />
                  </div>
                  {item.message && (
                    <p className="mt-1 text-xs text-destructive">{item.message}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {item.state === "uploading" && (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading
                    </span>
                  )}
                  {item.state === "indexing" && (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI indexing
                    </span>
                  )}
                  {item.state === "done" && (
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Indexed
                    </span>
                  )}
                  {item.state === "error" && (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" /> Failed
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Indexing runs in the background — you can leave this page; keep the tab open until items finish.
            </p>
            <button onClick={() => navigate({ to: "/" })} className="btn-secondary" disabled={busy}>
              Go to Library
            </button>
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Ready to explore? <Link to="/search" className="font-semibold text-primary hover:underline">Ask your knowledge base a question →</Link>
      </p>
    </div>
  );
}
