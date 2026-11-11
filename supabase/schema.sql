-- Just Us: run this whole file once in Supabase > SQL Editor.
-- Then run the "members" insert at the bottom with your two user IDs.

create extension if not exists pgcrypto;

-- The two of you. Nobody else gets in.
create table if not exists public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name    text not null unique check (name in ('shima','tima')),
  heat    int  not null default 50 check (heat between 0 and 100)
);

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid())
$$;

create or replace function public.my_name() returns text
language sql stable security definer set search_path = public as $$
  select name from public.members where user_id = auth.uid()
$$;

alter table public.members enable row level security;
drop policy if exists "members read members" on public.members;
create policy "members read members" on public.members
  for select to authenticated using (public.is_member());
drop policy if exists "update own heat" on public.members;
create policy "update own heat" on public.members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Messages
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  sender     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type       text not null check (type in ('text','tease','image','video','sticker','card','notice')),
  body       text,
  meta       jsonb not null default '{}'::jsonb,
  media_path text,
  ttl        text,
  expires_at timestamptz,
  opened_at  timestamptz,
  seen_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages (created_at);

alter table public.messages enable row level security;
drop policy if exists "read" on public.messages;
create policy "read" on public.messages for select to authenticated using (public.is_member());
drop policy if exists "send" on public.messages;
create policy "send" on public.messages for insert to authenticated with check (public.is_member() and sender = auth.uid());
drop policy if exists "update" on public.messages;
create policy "update" on public.messages for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "delete" on public.messages;
create policy "delete" on public.messages for delete to authenticated using (public.is_member());

-- Fantasy jar
create table if not exists public.jar (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body       text not null,
  level      text not null check (level in ('Soft','Hot','Extreme')),
  created_at timestamptz not null default now()
);
alter table public.jar enable row level security;
drop policy if exists "jar read" on public.jar;
create policy "jar read" on public.jar for select to authenticated using (public.is_member());
drop policy if exists "jar add" on public.jar;
create policy "jar add" on public.jar for insert to authenticated with check (public.is_member() and author = auth.uid());
drop policy if exists "jar remove" on public.jar;
create policy "jar remove" on public.jar for delete to authenticated using (public.is_member());

-- Position cards, filled by the GitHub Action from the positions/ folder.
-- he* files: only Shima sees them. she* files: only Tima. Anything else: both.
create table if not exists public.positions (
  id       bigserial primary key,
  audience text not null check (audience in ('he','she','both')),
  title    text not null,
  body     text not null,
  source   text not null default 'repo',
  sort     int  not null default 0
);
alter table public.positions enable row level security;
drop policy if exists "positions read" on public.positions;
create policy "positions read" on public.positions for select to authenticated using (
  public.is_member() and (
    audience = 'both'
    or (audience = 'he'  and public.my_name() = 'shima')
    or (audience = 'she' and public.my_name() = 'tima')
  )
);

-- Live updates
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.jar;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.members;  exception when duplicate_object then null; end;
end $$;

-- Private storage for photos and videos (50 MB per file)
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "media read" on storage.objects;
create policy "media read" on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_member());
drop policy if exists "media upload" on storage.objects;
create policy "media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_member());
drop policy if exists "media delete" on storage.objects;
create policy "media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_member());

-- ============================================================
-- LAST STEP: paste your two user IDs (Authentication > Users)
-- and run just these lines.
-- ============================================================
-- insert into public.members (user_id, name) values
--   ('PASTE-SHIMA-USER-ID-HERE', 'shima'),
--   ('PASTE-TIMA-USER-ID-HERE',  'tima');
