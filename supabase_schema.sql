-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Books table
create table books (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('ebook', 'physical', 'pdf')),
  title text not null,
  author text not null,
  isbn text,
  status text not null check (status in ('wantToRead', 'reading', 'completed')),
  cover text, -- Base64 or URL
  progress jsonb, -- {type: 'pages', value: '45/300'}
  recommended boolean NOT NULL DEFAULT false,
  recommended_at timestamptz,
  date_added timestamptz default now(),
  date_completed timestamptz,
  file_url text, -- For ebook files (Supabase Storage)
  metadata jsonb, -- Additional metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Quotes table
create table quotes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  book_id uuid references books(id) on delete cascade not null,
  quote_text text not null,
  page_number integer,
  personal_note text,
  color text,
  cfi text,
  date_saved timestamptz default now(),
  created_at timestamptz default now()
);

-- Ebook progress table
create table ebook_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  book_id uuid references books(id) on delete cascade not null,
  current_page integer,
  total_pages integer,
  percentage_read integer,
  last_read_date timestamptz default now(),
  total_read_time integer default 0, -- In minutes
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, book_id) -- One progress record per book per user
);

-- Indexes for performance
create index books_user_id_idx on books(user_id);
create index books_status_idx on books(status);
create index books_date_added_idx on books(date_added);
create index quotes_user_id_idx on quotes(user_id);
create index quotes_book_id_idx on quotes(book_id);
create index ebook_progress_user_id_idx on ebook_progress(user_id);

-- Row Level Security (RLS) policies
alter table books enable row level security;
alter table quotes enable row level security;
alter table ebook_progress enable row level security;

-- Books policies
create policy "Users can view their own books"
  on books for select
  using (auth.uid() = user_id);

create policy "Users can insert their own books"
  on books for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own books"
  on books for update
  using (auth.uid() = user_id);

create policy "Users can delete their own books"
  on books for delete
  using (auth.uid() = user_id);

-- Quotes policies
create policy "Users can view their own quotes"
  on quotes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own quotes"
  on quotes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own quotes"
  on quotes for delete
  using (auth.uid() = user_id);

create policy "Users can update their own quotes"
  on quotes for update
  using (auth.uid() = user_id);

-- Progress policies
create policy "Users can view their own progress"
  on ebook_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert their own progress"
  on ebook_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own progress"
  on ebook_progress for update
  using (auth.uid() = user_id);

create policy "Users can delete their own progress"
  on ebook_progress for delete
  using (auth.uid() = user_id);

-- Function to update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger books_updated_at
  before update on books
  for each row
  execute function update_updated_at();

create trigger ebook_progress_updated_at
  before update on ebook_progress
  for each row
  execute function update_updated_at();


-- ==============================================================================
-- Profiles table and auth hooks
-- ==============================================================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  total_books integer DEFAULT 0,
  total_quotes integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow profile creation on signup
CREATE POLICY "Enable insert for authenticated users"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on new user signup (trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill existing auth users into profiles table
INSERT INTO profiles (id, email, full_name, avatar_url, created_at)
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url',
  created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- ==============================================================================
-- Storage Bucket Limits (25MB cap on book_files)
-- ==============================================================================
UPDATE storage.buckets
SET file_size_limit = 26214400   -- 25MB in bytes
WHERE id = 'book_files';

-- Keep ebook files and their cover images private to each signed-in user's folder.
DROP POLICY IF EXISTS "book_files_select_own_folder" ON storage.objects;
CREATE POLICY "book_files_select_own_folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'book_files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "book_files_insert_own_folder" ON storage.objects;
CREATE POLICY "book_files_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book_files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "book_files_update_own_folder" ON storage.objects;
CREATE POLICY "book_files_update_own_folder" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'book_files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'book_files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "book_files_delete_own_folder" ON storage.objects;
CREATE POLICY "book_files_delete_own_folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'book_files' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ==============================================================================
-- Explore Books Public Aggregation View
-- Security: Does NOT expose user_id, auth.users, or any user metadata.
-- Only public aggregated recommendation counts, titles, authors, covers, and tags.
-- ==============================================================================

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS recommended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recommended_at timestamptz;

CREATE TABLE IF NOT EXISTS public.explore_blocklist (
  book_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.explore_blocklist ADD COLUMN IF NOT EXISTS book_key text;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'explore_blocklist' AND column_name = 'key'
  ) THEN
    EXECUTE 'UPDATE public.explore_blocklist SET book_key = "key" WHERE book_key IS NULL';
  END IF;
END $$;
ALTER TABLE public.explore_blocklist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'explore_books' AND column_name = 'reader_count'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'explore_books' AND column_name = 'recommendation_count'
  ) THEN
    ALTER VIEW public.explore_books RENAME COLUMN reader_count TO recommendation_count;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.explore_books WITH (security_invoker = false) AS
SELECT
  min(title) AS title,
  min(author) AS author,
  max(CASE WHEN cover NOT LIKE 'book-cover://%'
    THEN nullif(nullif(btrim(cover), ''), 'null') END) AS cover,
  COALESCE(
    (
      SELECT array_agg(DISTINCT t)
      FROM unnest(array_agg(tags)) AS t
      WHERE t IS NOT NULL AND t <> ''
    ),
    '{}'::text[]
  ) AS tags,
  count(DISTINCT user_id)::integer AS recommendation_count,
  max(recommended_at) AS last_recommended
FROM public.books
WHERE type IN ('ebook', 'physical')
  AND status = 'completed'
  AND recommended = true
  AND nullif(btrim(title), '') IS NOT NULL
  AND nullif(btrim(author), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.explore_blocklist AS blocked
    WHERE blocked.book_key = lower(trim(public.books.title)) || '|' || lower(trim(public.books.author))
  )
GROUP BY lower(trim(title)), lower(trim(author));

GRANT SELECT ON public.explore_books TO anon, authenticated;
