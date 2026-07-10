// Shared types between client and server for the multimodal RAG pipeline.

export type FileKind = "document" | "video" | "audio";
export type FileStatus = "processing" | "indexed" | "failed";
export type ChunkModality = "transcript" | "visual" | "text";

export interface SearchSource {
  n: number;
  fileId: string;
  fileName: string;
  kind: FileKind;
  mimeType: string;
  storagePath: string;
  modalities: ChunkModality[];
  startSeconds: number | null;
  endSeconds: number | null;
  pageNumber: number | null;
  snippet: string;
  similarity: number;
}

export interface SearchResult {
  answer: string;
  sources: SearchSource[];
}

export function kindFromMime(mime: string): FileKind {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

export function formatTime(t: number | null | undefined): string {
  if (t == null || Number.isNaN(t)) return "0:00";
  const s = Math.max(0, Math.floor(t));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
