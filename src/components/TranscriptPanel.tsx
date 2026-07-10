import { useEffect, useRef } from "react";
import { Eye } from "lucide-react";
import { formatTime } from "@/lib/rag-types";

export interface TranscriptChunk {
  id: string;
  content: string;
  modality: "transcript" | "visual" | "text";
  start_seconds: number | null;
  end_seconds: number | null;
}

interface Props {
  chunks: TranscriptChunk[];
  currentTime: number;
  onSeek: (t: number) => void;
}

/** Synced transcript: highlights the active line as the video plays. */
export function TranscriptPanel({ chunks, currentTime, onSeek }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);

  const timeline = [...chunks]
    .filter((c) => c.start_seconds != null)
    .sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0));

  let activeId: string | undefined;
  for (const c of timeline) {
    if ((c.start_seconds ?? 0) <= currentTime) activeId = c.id;
    else break;
  }

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  if (timeline.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">No transcript available.</p>
    );
  }

  return (
    <div className="max-h-[420px] space-y-1 overflow-y-auto p-2">
      {timeline.map((c) => {
        const active = c.id === activeId;
        return (
          <button
            key={c.id}
            ref={active ? activeRef : undefined}
            onClick={() => onSeek(c.start_seconds ?? 0)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              active
                ? "bg-accent text-accent-foreground"
                : "text-foreground/80 hover:bg-muted"
            }`}
          >
            <span className="mr-2 inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-primary">
              {c.modality === "visual" && <Eye className="h-3 w-3" />}
              {formatTime(c.start_seconds)}
            </span>
            {c.content}
          </button>
        );
      })}
    </div>
  );
}
