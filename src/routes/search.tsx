import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Search,
  Sparkles,
  Film,
  FileText,
  AudioLines,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { searchKnowledge } from "@/lib/rag.functions";
import { formatTime, type SearchResult, type SearchSource } from "@/lib/rag-types";
import { getSignedUrl } from "@/lib/storage";
import { VideoPlayer } from "@/components/VideoPlayer";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

const kindIcon = { document: FileText, video: Film, audio: AudioLines };

/** Renders the answer text with clickable [n] citation chips. */
function AnswerText({
  text,
  onCite,
}: {
  text: string;
  onCite: (n: number) => void;
}) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {text.split(/\n{2,}/).map((para, pi) => (
        <p key={pi}>
          {para.split(/(\[\d+\])/g).map((part, i) => {
            const m = part.match(/^\[(\d+)\]$/);
            if (m) {
              const n = Number(m[1]);
              return (
                <button key={i} className="citation-chip" onClick={() => onCite(n)}>
                  {n}
                </button>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
      ))}
    </div>
  );
}

function SourceViewer({
  source,
  allSources,
  seekKey,
}: {
  source: SearchSource;
  allSources: SearchSource[];
  seekKey: number;
}) {
  const { data: url, isLoading } = useQuery({
    queryKey: ["signed-url", source.storagePath],
    queryFn: () => getSignedUrl(source.storagePath),
    staleTime: 30 * 60 * 1000,
  });

  const markers = useMemo(
    () =>
      allSources
        .filter((s) => s.fileId === source.fileId && s.startSeconds != null)
        .map((s) => ({ time: s.startSeconds as number, label: `Source [${s.n}]` })),
    [allSources, source.fileId],
  );

  const seekSignal = useMemo(
    () =>
      source.startSeconds != null ? { time: source.startSeconds, key: seekKey } : null,
    [source, seekKey],
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!url) return <p className="p-4 text-sm text-destructive">Could not load file.</p>;

  if (source.kind === "video") {
    return <VideoPlayer src={url} markers={markers} seekSignal={seekSignal} />;
  }

  if (source.kind === "audio") {
    return (
      <div className="card-elevated space-y-4 p-5">
        <audio key={`${url}-${seekKey}`} src={`${url}#t=${Math.floor(source.startSeconds ?? 0)}`} controls autoPlay className="w-full" />
        <p className="text-sm text-muted-foreground">
          Evidence at {formatTime(source.startSeconds)} — “{source.snippet}”
        </p>
      </div>
    );
  }

  // Document
  if (source.mimeType === "application/pdf") {
    return (
      <div className="card-elevated overflow-hidden">
        <iframe
          key={`${source.n}-${seekKey}`}
          src={`${url}#page=${source.pageNumber ?? 1}`}
          title={source.fileName}
          className="h-[560px] w-full"
        />
      </div>
    );
  }
  return (
    <div className="card-elevated p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {source.fileName}
        {source.pageNumber != null ? ` — page ${source.pageNumber}` : ""}
      </p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{source.snippet}</p>
    </div>
  );
}

function SearchPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeN, setActiveN] = useState<number | null>(null);
  const [seekKey, setSeekKey] = useState(0);
  const runSearch = useServerFn(searchKnowledge);

  const mutation = useMutation({
    mutationFn: (q: string) => runSearch({ data: { question: q } }),
    onSuccess: (res) => {
      setResult(res);
      setActiveN(res.sources[0]?.n ?? null);
      setSeekKey((k) => k + 1);
    },
  });

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = question.trim();
    if (q.length < 2 || mutation.isPending) return;
    setResult(null);
    mutation.mutate(q);
  };

  const activeSource = result?.sources.find((s) => s.n === activeN) ?? null;

  const cite = (n: number) => {
    setActiveN(n);
    setSeekKey((k) => k + 1);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-semibold">Multimodal Search</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask in natural language — answers are grounded in your documents and
          videos, with citations that jump to the exact moment or page.
        </p>
        <form onSubmit={submit} className="relative mt-6">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What does the speaker say when the revenue chart appears?"
            className="w-full rounded-xl border border-input bg-card py-3.5 pl-12 pr-32 text-sm shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={mutation.isPending || question.trim().length < 2}
            className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Search
          </button>
        </form>
      </div>

      {mutation.isPending && (
        <div className="mx-auto mt-12 flex max-w-md flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Searching across text, speech and visuals…</p>
          <p className="text-xs text-muted-foreground">
            Embedding your query, retrieving evidence and reasoning over timestamps.
          </p>
        </div>
      )}

      {mutation.isError && (
        <p className="mx-auto mt-8 max-w-xl rounded-lg bg-destructive/10 p-4 text-center text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : "Search failed."}
        </p>
      )}

      {result && (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Left: AI answer with citations */}
          <div className="card-elevated p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-4 w-4" /> AI Answer
            </div>
            <div className="mt-4">
              <AnswerText text={result.answer} onCite={cite} />
            </div>

            {result.sources.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sources
                </p>
                <div className="mt-3 space-y-2">
                  {result.sources.map((s) => {
                    const Icon = kindIcon[s.kind];
                    const active = s.n === activeN;
                    return (
                      <button
                        key={s.n}
                        onClick={() => cite(s.n)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                          active
                            ? "border-primary bg-accent"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <span className="citation-chip shrink-0">{s.n}</span>
                        <Icon className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.fileName}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.startSeconds != null
                              ? `${formatTime(s.startSeconds)}${s.endSeconds != null && s.endSeconds !== s.startSeconds ? `–${formatTime(s.endSeconds)}` : ""} · ${s.modalities.join(" + ")}`
                              : s.pageNumber != null
                                ? `Page ${s.pageNumber}`
                                : "Document"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: evidence viewer */}
          <div>
            {activeSource ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Evidence — source [{activeSource.n}]
                  </p>
                  <Link
                    to="/files/$fileId"
                    params={{ fileId: activeSource.fileId }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Open full asset <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <SourceViewer
                  source={activeSource}
                  allSources={result.sources}
                  seekKey={seekKey}
                />
              </div>
            ) : (
              <div className="card-elevated flex h-64 items-center justify-center text-sm text-muted-foreground">
                No sources for this answer.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
