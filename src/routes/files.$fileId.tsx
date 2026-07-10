import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Eye, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { VideoPlayer } from "@/components/VideoPlayer";
import { TranscriptPanel, type TranscriptChunk } from "@/components/TranscriptPanel";
import { formatTime } from "@/lib/rag-types";

export const Route = createFileRoute("/files/$fileId")({
  component: FileDetailPage,
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-sm text-destructive">
      {error.message || "Could not load this file."}
    </div>
  ),
  notFoundComponent: () => {
    const { fileId } = Route.useParams();
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">File {fileId} was not found.</p>
        <Link to="/" className="btn-secondary mt-4">
          Back to Library
        </Link>
      </div>
    );
  },
});

function FileDetailPage() {
  const { fileId } = Route.useParams();
  const [currentTime, setCurrentTime] = useState(0);
  const [seekSignal, setSeekSignal] = useState<{ time: number; key: number } | null>(null);

  const { data: file, isLoading: fileLoading } = useQuery({
    queryKey: ["file", fileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("id", fileId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: chunks = [] } = useQuery({
    queryKey: ["chunks", fileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chunks")
        .select("id, content, modality, start_seconds, end_seconds, page_number")
        .eq("file_id", fileId)
        .order("start_seconds", { ascending: true, nullsFirst: false })
        .order("page_number", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!file,
  });

  const { data: url } = useQuery({
    queryKey: ["signed-url", file?.storage_path],
    queryFn: () => getSignedUrl(file!.storage_path),
    enabled: !!file && file.storage_path !== "pending",
    staleTime: 30 * 60 * 1000,
  });

  if (fileLoading || !file) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const isMedia = file.kind === "video" || file.kind === "audio";
  const transcriptChunks = chunks.filter(
    (c) => c.start_seconds != null,
  ) as TranscriptChunk[];
  const visualChunks = chunks.filter((c) => c.modality === "visual");
  const seek = (t: number) => setSeekSignal({ time: t, key: Date.now() });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Library
      </Link>

      <h1 className="mt-3 text-2xl font-semibold">{file.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {file.kind}
        {file.duration_seconds != null && ` · ${formatTime(file.duration_seconds)}`}
        {file.page_count != null && ` · ${file.page_count} pages`}
        {` · ${chunks.length} indexed chunks`}
        {file.status !== "indexed" && ` · ${file.status}`}
      </p>
      {file.summary && <p className="mt-2 max-w-2xl text-sm">{file.summary}</p>}

      {isMedia ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {url ? (
              file.kind === "video" ? (
                <VideoPlayer
                  src={url}
                  markers={visualChunks.map((v) => ({
                    time: v.start_seconds ?? 0,
                    label: v.content.slice(0, 60),
                  }))}
                  seekSignal={seekSignal}
                  onTimeUpdate={setCurrentTime}
                />
              ) : (
                <audio src={url} controls className="w-full" />
              )
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-xl bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {visualChunks.length > 0 && (
              <div className="card-elevated mt-6 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> Visual timeline
                </p>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                  {visualChunks.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => seek(v.start_seconds ?? 0)}
                      className="w-44 shrink-0 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-primary"
                    >
                      <span className="text-xs font-bold tabular-nums text-primary">
                        {formatTime(v.start_seconds)}
                      </span>
                      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                        {v.content}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card-elevated lg:col-span-2">
            <p className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Synced transcript
            </p>
            <TranscriptPanel
              chunks={transcriptChunks}
              currentTime={currentTime}
              onSeek={seek}
            />
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="card-elevated overflow-hidden">
            {url && file.mime_type === "application/pdf" ? (
              <iframe src={url} title={file.name} className="h-[640px] w-full" />
            ) : (
              <p className="p-5 text-sm text-muted-foreground">
                Preview not available for this format.
              </p>
            )}
          </div>
          <div className="card-elevated max-h-[640px] overflow-y-auto p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Extracted content
            </p>
            <div className="mt-3 space-y-3">
              {chunks.map((c) => (
                <div key={c.id} className="rounded-lg bg-muted p-3">
                  {c.page_number != null && (
                    <p className="text-[11px] font-bold uppercase text-primary">
                      Page {c.page_number}
                    </p>
                  )}
                  <p className="mt-1 text-sm leading-relaxed">{c.content}</p>
                </div>
              ))}
              {chunks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {file.status === "processing"
                    ? "Still indexing — check back shortly."
                    : "No indexed content."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
