-- Enable pgvector for embeddings
create extension if not exists vector;

-- Enums
create type public.file_status as enum ('processing','indexed','failed');
create type public.file_kind as enum ('document','video','audio');
create type public.chunk_modality as enum ('transcript','visual','text');

-- Files (uploaded documents & videos)
create table public.files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.file_kind not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  storage_path text not null,
  status public.file_status not null default 'processing',
  error text,
  duration_seconds numeric,
  page_count int,
  summary text,
  created_at timestamptz not null default now(),
  indexed_at timestamptz
);
grant select, insert, update, delete on public.files to anon, authenticated;
grant all on public.files to service_role;
alter table public.files enable row level security;
create policy "Public access to files" on public.files for all using (true) with check (true);

-- Chunks (indexed content with embeddings)
create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  content text not null,
  modality public.chunk_modality not null,
  start_seconds numeric,
  end_seconds numeric,
  page_number int,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.chunks to anon, authenticated;
grant all on public.chunks to service_role;
alter table public.chunks enable row level security;
create policy "Public access to chunks" on public.chunks for all using (true) with check (true);

create index chunks_embedding_idx on public.chunks using hnsw (embedding vector_cosine_ops);
create index chunks_file_id_idx on public.chunks(file_id);

-- Query history
create table public.queries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.queries to anon, authenticated;
grant all on public.queries to service_role;
alter table public.queries enable row level security;
create policy "Public access to queries" on public.queries for all using (true) with check (true);

-- Similarity search function
create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_count int default 12
)
returns table (
  id uuid,
  file_id uuid,
  content text,
  modality public.chunk_modality,
  start_seconds numeric,
  end_seconds numeric,
  page_number int,
  similarity float
)
language sql stable
set search_path = public
as $$
  select c.id, c.file_id, c.content, c.modality, c.start_seconds, c.end_seconds, c.page_number,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Storage policies for the private 'media' bucket (app is public/no-auth demo)
create policy "Anyone can read media" on storage.objects for select using (bucket_id = 'media');
create policy "Anyone can upload media" on storage.objects for insert with check (bucket_id = 'media');
create policy "Anyone can delete media" on storage.objects for delete using (bucket_id = 'media');