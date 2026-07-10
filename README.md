# Magenta Mind — Multimodal RAG Enterprise System

A production-style multimodal Retrieval-Augmented Generation system for
enterprise knowledge and video analysis, built on Lovable Cloud.

Upload documents (PDF/TXT) and media (video/audio); the ingestion pipeline
extracts text, time-stamped transcripts and visual descriptions, embeds
everything into a vector index, and answers natural-language questions with
time-stamped, clickable citations.

## Architecture

```
Browser (React 19 / TanStack Start / Tailwind v4)
  ├─ Upload page ── direct upload to Cloud Storage (private "media" bucket)
  ├─ Library ────── polls file status (processing → indexed / failed)
  ├─ Search ─────── split view: AI answer + citations | evidence viewer
  └─ File detail ── custom video player + synced transcript

Server functions (TanStack createServerFn)
  ├─ processFile ── ingestion pipeline
  │     1. download raw file from storage
  │     2. documents → page-by-page text extraction (vision LLM, OCR included)
  │        video    → time-stamped transcript + keyframe visual descriptions
  │        audio    → time-stamped transcript
  │     3. chunking (transcript segments / visual moments / page text)
  │     4. embeddings (openai/text-embedding-3-small, 1536 dims)
  │     5. insert into pgvector index
  └─ searchKnowledge ── retrieval & reasoning
        1. embed the query
        2. similarity search across ALL modalities (match_chunks, HNSW index)
        3. temporal reranking: hits from the same video within a 25s window
           merge into one source, so spoken + visual evidence at the same
           moment are reasoned about together
        4. LLM synthesis with numbered citations [n]

Database (Postgres + pgvector)
  ├─ files   (metadata, status, duration, page_count)
  ├─ chunks  (content, modality, timestamps/page, embedding vector(1536))
  └─ queries (search history)
```

## Temporal reasoning (the core highlight)

- Every transcript segment and visual description carries `start_seconds` /
  `end_seconds`.
- At retrieval time, hits from the same file are grouped by time window, so
  "this chart appears while the speaker says X" is a single grounded source.
- Citations in the answer are clickable: they seek the video player to the
  exact timestamp (with relevance markers on the progress bar) or open the
  document at the cited page.

## Key files

| Path | Purpose |
| --- | --- |
| `src/lib/rag.server.ts` | AI gateway calls: extraction, transcription, embeddings, synthesis |
| `src/lib/rag.functions.ts` | Server functions: `processFile`, `searchKnowledge` |
| `src/routes/upload.tsx` | Drag-and-drop ingestion UI with live status |
| `src/routes/search.tsx` | Multimodal search + split-screen result view |
| `src/routes/files.$fileId.tsx` | Video player with markers + synced transcript |
| `src/components/VideoPlayer.tsx` | Custom player with evidence markers |

## Notes & limits

- Runs entirely on Lovable Cloud — no external accounts, API keys or Docker
  required. AI calls go through the Lovable AI Gateway (`LOVABLE_API_KEY` is
  provisioned automatically and stays server-side).
- Upload limit ~25MB per file (larger media should be trimmed or compressed).
- The app is an open demo (no login). Add authentication before storing
  sensitive corporate content.
