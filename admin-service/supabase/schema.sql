-- Schema for Redirector Engine (Supabase)

-- Users are managed by Supabase Auth (auth.users)

-- Table: domains
create table public.domains (
  id uuid default gen_random_uuid() primary key,
  domain text not null unique,
  created_at timestamptz default now(),
  owner_id uuid references auth.users not null
);

-- Table: links
create table public.links (
  id uuid default gen_random_uuid() primary key,
  slug text not null,
  destination text not null,
  owner_id uuid references auth.users not null,
  domain_id uuid references public.domains(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_active boolean default true,
  unique(slug, domain_id) -- Uniqueness per domain (if domain_id is null, it's the default domain)
);

-- RLS: Enable
alter table public.domains enable row level security;
alter table public.links enable row level security;

-- Policies: Domains
create policy "Users can view their own domains"
on public.domains for select
using (auth.uid() = owner_id);

create policy "Users can insert their own domains"
on public.domains for insert
with check (auth.uid() = owner_id);

create policy "Users can update their own domains"
on public.domains for update
using (auth.uid() = owner_id);

create policy "Users can delete their own domains"
on public.domains for delete
using (auth.uid() = owner_id);

-- Policies: Links
create policy "Users can view their own links"
on public.links for select
using (auth.uid() = owner_id);

create policy "Users can insert their own links"
on public.links for insert
with check (auth.uid() = owner_id);

create policy "Users can update their own links"
on public.links for update
using (auth.uid() = owner_id);

create policy "Users can delete their own links"
on public.links for delete
using (auth.uid() = owner_id);

-- Realtime: Enable for tables
alter publication supabase_realtime add table public.links;
alter publication supabase_realtime add table public.domains;
