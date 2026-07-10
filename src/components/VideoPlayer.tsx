import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { formatTime } from "@/lib/rag-types";

export interface PlayerMarker {
  time: number;
  label: string;
}

interface Props {
  src: string;
  markers?: PlayerMarker[];
  /** Change `key` to re-trigger seeking to the same time. */
  seekSignal?: { time: number; key: number } | null;
  onTimeUpdate?: (t: number) => void;
}

/**
 * Custom video player with relevance markers on the progress bar.
 * Markers indicate where retrieved evidence lives in the timeline.
 */
export function VideoPlayer({ src, markers = [], seekSignal, onTimeUpdate }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (seekSignal && ref.current) {
      ref.current.currentTime = seekSignal.time;
      ref.current.play().catch(() => {});
    }
  }, [seekSignal]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const seekFromBar = (e: React.MouseEvent) => {
    const v = ref.current;
    const bar = barRef.current;
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-foreground/95 shadow-md">
      <video
        ref={ref}
        src={src}
        className="aspect-video w-full bg-foreground object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrent(t);
          onTimeUpdate?.(t);
        }}
        onClick={toggle}
        playsInline
      />
      <div className="flex items-center gap-3 bg-card px-3 py-2.5">
        <button
          onClick={toggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>

        <div
          ref={barRef}
          onClick={seekFromBar}
          className="relative h-2 flex-1 cursor-pointer rounded-full bg-muted"
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={current}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: duration ? `${(current / duration) * 100}%` : "0%" }}
          />
          {duration > 0 &&
            markers.map((m, i) => (
              <button
                key={i}
                title={`${formatTime(m.time)} — ${m.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (ref.current) {
                    ref.current.currentTime = m.time;
                    ref.current.play().catch(() => {});
                  }
                }}
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary-glow transition-transform hover:scale-125"
                style={{ left: `${Math.min(99, (m.time / duration) * 100)}%` }}
                aria-label={`Jump to ${formatTime(m.time)}`}
              />
            ))}
        </div>

        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {formatTime(current)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
