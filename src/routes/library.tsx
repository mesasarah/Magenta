import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Film,
  AudioLines,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UploadCloud,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatTime } from "@/lib/rag-types";

export const Route = createFileRoute("/library")({
  component: LibraryPage,
});

type FileRow = {
  id: string;
  name: string;
  kind: "document" | "video" | "audio";
  mime_type: string;
  size_bytes: number;
  status: "processing" | "indexed" | "failed";
  error: string | null;
  duration_seconds: number | null;
  page_count: number | null;
  summary: string | null;
  created_at: string;
};

const kindIcon = { document: FileText, video: Film, audio: AudioLines };

function StatusBadge({ status }: { status: FileRow["status"] }) {
  if (status === "processing")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Processing
      </span>
    );
  if (status === "indexed")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
        <CheckCircle2 className="h-3 w-3" /> Indexed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
      <AlertCircle className="h-3 w-3" /> Failed
    </span>
  );
}

function LibraryPage() {
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select(
          "id, name, kind, mime_type, size_bytes, status, error, duration_seconds, page_count, summary, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FileRow[];
    },
    refetchInterval: (q) =>
      (q.state.data ?? []).some((f) => f.status === "processing") ? 3500 : false,
  });

  const deleteFile = async (f: FileRow) => {
    if (!confirm(`Delete "${f.name}" and its index?`)) return;
    await supabase.storage.from("media").remove([`${f.id}/${f.name}`]);
    await supabase.from("files").delete().eq("id", f.id);
    queryClient.invalidateQueries({ queryKey: ["files"] });
  };

  const stats = {
    total: files.length,
    indexed: files.filter((f) => f.status === "indexed").length,
    processing: files.filter((f) => f.status === "processing").length,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="gradient-hero rounded-2xl px-8 py-10 text-primary-foreground shadow-lg">
        <h1 className="text-3xl font-semibold">Knowledge Library</h1>
        <p className="mt-2 max-w-xl text-sm opacity-85">
          Documents and videos indexed for multimodal search — text, speech and
          visuals, all searchable with time-stamped citations.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/upload" className="btn-primary">
            <UploadCloud className="h-4 w-4" /> Upload files
          </Link>
          <Link to="/search" className="btn-secondary">
            <Search className="h-4 w-4" /> Ask a question
          </Link>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: "Assets", value: stats.total },
          { label: "Indexed", value: stats.indexed },
          { label: "Processing", value: stats.processing },
        ].map((s) => (
          <div key={s.label} className="card-elevated px-5 py-4">
            <p className="text-2xl font-semibold text-primary">{s.value}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading library…</p>
        ) : files.length === 0 ? (
          <div className="card-elevated flex flex-col items-center gap-3 px-6 py-16 text-center">
            <UploadCloud className="h-10 w-10 text-primary" />
            <p className="font-medium">Your library is empty</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Upload a PDF, video or audio file. The pipeline extracts text,
              transcripts and visual cues, then indexes everything for search.
            </p>
            <Link to="/upload" className="btn-primary mt-2">
              Upload your first file
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((f) => {
              const Icon = kindIcon[f.kind];
              return (
                <div key={f.id} className="card-elevated group relative flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <StatusBadge status={f.status} />
                  </div>
                  <Link
                    to="/files/$fileId"
                    params={{ fileId: f.id }}
                    className="mt-3 line-clamp-2 font-semibold leading-snug hover:text-primary"
                  >
                    {f.name}
                  </Link>
                  {f.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{f.summary}</p>
                  )}
                  {f.status === "failed" && f.error && (
                    <p className="mt-1 line-clamp-2 text-xs text-destructive">{f.error}</p>
                  )}
                  <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-muted-foreground">
                    {f.duration_seconds != null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatTime(f.duration_seconds)}
                      </span>
                    )}
                    {f.page_count != null && <span>{f.page_count} pages</span>}
                    <span>{(f.size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                    <button
                      onClick={() => deleteFile(f)}
                      className="ml-auto rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      aria-label="Delete file"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
