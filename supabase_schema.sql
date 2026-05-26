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
