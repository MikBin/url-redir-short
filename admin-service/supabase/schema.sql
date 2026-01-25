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

-- Table: sessions (for tracking user sessions)
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  session_id text not null unique,
  user_id uuid references auth.users,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  device_fingerprint text,
  last_activity_at timestamptz default now()
);

-- Index for session lookups
create index idx_sessions_session_id on public.sessions(session_id);
create index idx_sessions_user_id on public.sessions(user_id);
create index idx_sessions_expires_at on public.sessions(expires_at);

-- Table: analytics_events (enhanced with new columns)
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
  session_id text,
  country text,
  city text,
  device_type text,
  browser text,
  os text,
  link_id uuid references public.links(id),
  created_at timestamptz default now()
);

-- Indexes for analytics_events
create index idx_analytics_path_timestamp on public.analytics_events(path, timestamp);
create index idx_analytics_destination_timestamp on public.analytics_events(destination, timestamp);
create index idx_analytics_device_type on public.analytics_events(device_type);
create index idx_analytics_country on public.analytics_events(country);
create index idx_analytics_link_id on public.analytics_events(link_id);
create index idx_analytics_session_id on public.analytics_events(session_id);
create index idx_analytics_created_at on public.analytics_events(created_at);

-- Table: analytics_aggregates (for hourly/daily stats)
create table public.analytics_aggregates (
  id uuid default gen_random_uuid() primary key,
  link_id uuid references public.links(id) not null,
  date date not null,
  hour smallint, -- 0-23, null for daily aggregates
  click_count integer default 0,
  unique_visitors integer default 0,
  conversion_data jsonb default '{}',
  country_breakdown jsonb default '{}',
  device_breakdown jsonb default '{}',
  browser_breakdown jsonb default '{}',
  referrer_breakdown jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(link_id, date, hour)
);

-- Indexes for analytics_aggregates
create index idx_aggregates_link_date on public.analytics_aggregates(link_id, date);
create index idx_aggregates_date on public.analytics_aggregates(date);

-- RLS: Enable
alter table public.domains enable row level security;
alter table public.links enable row level security;
alter table public.analytics_events enable row level security;
alter table public.sessions enable row level security;
alter table public.analytics_aggregates enable row level security;

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

-- Policies: Sessions
create policy "Users can view their own sessions"
on public.sessions for select
using (auth.uid() = user_id);

create policy "Users can insert their own sessions"
on public.sessions for insert
with check (auth.uid() = user_id);

create policy "Users can delete their own sessions"
on public.sessions for delete
using (auth.uid() = user_id);

-- Policies: Analytics Aggregates
create policy "Authenticated users can view all aggregates"
on public.analytics_aggregates for select
using (auth.role() = 'authenticated');

-- Realtime: Enable for tables
alter publication supabase_realtime add table public.links;
alter publication supabase_realtime add table public.domains;

-- Replica Identity: Ensure DELETE events contain the full row
alter table public.links replica identity full;
