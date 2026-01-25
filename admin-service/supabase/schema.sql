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
  targeting jsonb,
  ab_testing jsonb,
  hsts jsonb,
  password_protection jsonb,
  expires_at timestamptz,
  max_clicks integer,
  unique(slug, domain_id) -- Uniqueness per domain (if domain_id is null, it's the default domain)
);

-- Table: analytics_events
create table public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  path text not null,
  destination text not null,
  timestamp timestamptz not null,
  ip text,
  user_agent text,
  referrer text,
  referrer_source text,
  status integer,
  created_at timestamptz default now()
);

-- RLS: Enable
alter table public.domains enable row level security;
alter table public.links enable row level security;
alter table public.analytics_events enable row level security;

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

-- Policies: Analytics Events
-- Ideally, users should only see analytics for links they own.
-- This requires a join or ensuring we store owner_id (which isn't in the payload).
-- For MVP Phase 3, we allow authenticated users to view all analytics (or we can rely on service role for the API and disable RLS for public read, but keep RLS enabled to deny public access).
-- Let's deny all public access by default (implicit) and only allow service role (which bypasses RLS) to insert.
-- We will add a policy for authenticated users to VIEW events.
-- Since we don't have owner_id, we'll let any authenticated user view all stats for now (internal admin tool).
create policy "Authenticated users can view all analytics"
on public.analytics_events for select
using (auth.role() = 'authenticated');

-- Realtime: Enable for tables
alter publication supabase_realtime add table public.links;
alter publication supabase_realtime add table public.domains;

-- Replica Identity: Ensure DELETE events contain the full row
alter table public.links replica identity full;
