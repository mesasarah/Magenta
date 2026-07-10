import { createFileRoute, Link } from "@tanstack/react-router";
import {
  UploadCloud,
  Search,
  LibraryBig,
  Sparkles,
  Film,
  FileText,
  AudioLines,
  Clock,
  Layers,
  Quote,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Magenta — Multimodal RAG for Enterprise Knowledge" },
      {
        name: "description",
        content:
          "Search across your documents, videos and audio with time-stamped, cited answers. A multimodal RAG workspace for enterprise knowledge and video analysis.",
      },
      { property: "og:title", content: "Magenta Mind — Multimodal RAG Workspace" },
      {
        property: "og:description",
        content:
          "Upload PDFs, videos and audio. Ask questions. Get grounded answers with citations linked to the exact page or timestamp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Hero */}
      <section className="gradient-hero relative overflow-hidden rounded-3xl px-8 py-16 text-primary-foreground shadow-xl sm:px-14 sm:py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Multimodal RAG · Enterprise
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-5xl">
            Turn documents and videos into a searchable, cited knowledge base.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed opacity-90 sm:text-lg">
            Magenta ingests PDFs, presentations, videos and audio, then
            answers your questions with grounded citations linked to the exact
            page or timestamp. Reading, watching and listening — unified in one
            retrieval layer.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/upload" className="btn-primary bg-white text-primary hover:bg-white/90">
              <UploadCloud className="h-4 w-4" /> Upload your first file
            </Link>
            <Link
              to="/search"
              className="btn-secondary border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              <Search className="h-4 w-4" /> Try a question
            </Link>
            <Link
              to="/library"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white/90 hover:text-white"
            >
              Browse library <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* What it does */}
      <section className="mt-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            What it does
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            One workspace for every modality.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every asset is parsed, transcribed and embedded so a single
            question can pull the right paragraph, the right frame, and the
            right spoken moment — together.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: FileText,
              title: "Documents",
              body:
                "PDFs, slide decks and reports are OCR'd and chunked with page-level citations.",
            },
            {
              icon: Film,
              title: "Video",
              body:
                "Transcripts plus visual descriptions of keyframes, all aligned to timestamps.",
            },
            {
              icon: AudioLines,
              title: "Audio",
              body:
                "Meetings, interviews and podcasts transcribed and indexed for semantic search.",
            },
          ].map((f) => (
            <div key={f.title} className="card-elevated p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            How it works
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            From upload to answer in three steps.
          </h2>
        </div>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              step: "01",
              icon: UploadCloud,
              title: "Upload",
              body:
                "Drag in a PDF, video or audio file. The pipeline extracts text, speech and visual cues.",
            },
            {
              step: "02",
              icon: Layers,
              title: "Index",
              body:
                "Content is chunked, embedded with pgvector, and organised temporally across modalities.",
            },
            {
              step: "03",
              icon: Quote,
              title: "Ask & cite",
              body:
                "Ask a natural question. Get an answer with inline citations to the exact page or moment.",
            },
          ].map((s) => (
            <li key={s.step} className="card-elevated relative p-6">
              <span className="font-display text-xs font-semibold text-primary/60">
                STEP {s.step}
              </span>
              <div className="mt-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Highlight — temporal reasoning */}
      <section className="mt-20 grid gap-8 rounded-3xl bg-accent/40 p-8 md:grid-cols-2 md:p-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Temporal reasoning
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            Answers linked to the exact moment.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Text and video evidence are reranked in matched time windows so a
            slide, a spoken sentence and an on-screen action all support the
            same answer. Click any citation to jump straight to the source.
          </p>
          <Link to="/search" className="btn-primary mt-6 inline-flex">
            <Search className="h-4 w-4" /> Ask a question
          </Link>
        </div>
        <div className="card-elevated space-y-3 p-6">
          <p className="text-sm">
            <span className="font-medium">Q.</span> When did the team decide to
            move to a monthly release cadence?
          </p>
          <div className="rounded-lg border border-border/60 bg-background p-4 text-sm">
            The team agreed on a monthly cadence during the Q3 planning review,
            citing improved regression coverage
            <sup className="mx-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              1
            </sup>
            and better predictability for stakeholders
            <sup className="mx-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              2
            </sup>
            .
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
              <Film className="h-3 w-3" /> planning-review.mp4 · 12:47
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
              <FileText className="h-3 w-3" /> release-notes.pdf · p. 4
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-20 mb-6 rounded-3xl border border-border bg-card px-8 py-12 text-center shadow-sm">
        <Clock className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 font-display text-2xl font-semibold">
          Ready to give your knowledge a searchable memory?
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Start with a single file — you'll have grounded, cited answers in
          under a minute.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/upload" className="btn-primary">
            <UploadCloud className="h-4 w-4" /> Upload files
          </Link>
          <Link to="/library" className="btn-secondary">
            <LibraryBig className="h-4 w-4" /> View library
          </Link>
        </div>
      </section>
    </div>
  );
}
