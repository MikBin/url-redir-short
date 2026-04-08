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

-- Function to atomically increment analytics aggregates
create or replace function public.increment_analytics_aggregate(
  p_link_id uuid,
  p_date date,
  p_hour integer,
  p_country text,
  p_device_type text,
  p_browser text,
  p_count integer default 1
)
returns void
language plpgsql
security definer
as $$
declare
  v_country_json jsonb;
  v_device_json jsonb;
  v_browser_json jsonb;
begin
  -- Construct partial JSONBs for the initial insert
  v_country_json := case when p_country is not null then jsonb_build_object(p_country, p_count) else '{}'::jsonb end;
  v_device_json := case when p_device_type is not null then jsonb_build_object(p_device_type, p_count) else '{}'::jsonb end;
  v_browser_json := case when p_browser is not null then jsonb_build_object(p_browser, p_count) else '{}'::jsonb end;

  insert into public.analytics_aggregates (
    link_id, date, hour, click_count, unique_visitors,
    country_breakdown, device_breakdown, browser_breakdown
  )
  values (
    p_link_id, p_date, p_hour, p_count, p_count,
    v_country_json, v_device_json, v_browser_json
  )
  on conflict (link_id, date, hour)
  do update set
    click_count = analytics_aggregates.click_count + p_count,
    unique_visitors = analytics_aggregates.unique_visitors + p_count,
    country_breakdown = case
      when p_country is not null then
        analytics_aggregates.country_breakdown || jsonb_build_object(p_country, coalesce((analytics_aggregates.country_breakdown->>p_country)::int, 0) + p_count)
      else analytics_aggregates.country_breakdown
    end,
    device_breakdown = case
      when p_device_type is not null then
        analytics_aggregates.device_breakdown || jsonb_build_object(p_device_type, coalesce((analytics_aggregates.device_breakdown->>p_device_type)::int, 0) + p_count)
      else analytics_aggregates.device_breakdown
    end,
    browser_breakdown = case
      when p_browser is not null then
        analytics_aggregates.browser_breakdown || jsonb_build_object(p_browser, coalesce((analytics_aggregates.browser_breakdown->>p_browser)::int, 0) + p_count)
      else analytics_aggregates.browser_breakdown
    end,
    updated_at = now();
end;
$$;

-- Function to get detailed link analytics
create or replace function public.get_link_detailed_stats(
  p_link_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_group_by text default 'day'
)
returns json
language plpgsql
security invoker
as $$
declare
  v_path text;
  v_result json;
begin
  -- Get path for the link
  select case when slug ~ '^/' then slug else '/' || slug end
  into v_path
  from public.links
  where id = p_link_id;

  with filtered_events as (
    select *
    from public.analytics_events
    where (link_id = p_link_id or path = v_path)
      and timestamp >= p_from
      and timestamp <= p_to
  ),
  summary as (
    select
      count(*) as total_clicks,
      count(distinct session_id) as unique_visitors
    from filtered_events
  ),
  periods as (
    select generate_series(
      date_trunc(case when p_group_by = 'week' then 'day' else p_group_by end, p_from),
      date_trunc(case when p_group_by = 'week' then 'day' else p_group_by end, p_to),
      (case when p_group_by = 'week' then '7 days' else '1 ' || p_group_by end)::interval
    ) as period_start
  ),
  time_series as (
    select
      case
        when p_group_by = 'hour' then to_char(p.period_start, 'YYYY-MM-DD"T"HH24:00:00"Z"')
        when p_group_by = 'day' then to_char(p.period_start, 'YYYY-MM-DD')
        when p_group_by = 'week' then to_char(p.period_start - (extract(dow from p.period_start) * interval '1 day'), 'YYYY-MM-DD')
        when p_group_by = 'month' then to_char(p.period_start, 'YYYY-MM')
        else to_char(p.period_start, 'YYYY-MM-DD')
      end as period,
      count(e.timestamp) as count
    from periods p
    left join filtered_events e on (
      case
        when p_group_by = 'hour' then date_trunc('hour', e.timestamp) = p.period_start
        when p_group_by = 'day' then date_trunc('day', e.timestamp) = p.period_start
        when p_group_by = 'week' then (date_trunc('day', e.timestamp) - (extract(dow from e.timestamp) * interval '1 day')) = (p.period_start - (extract(dow from p.period_start) * interval '1 day'))
        when p_group_by = 'month' then date_trunc('month', e.timestamp) = p.period_start
        else date_trunc('day', e.timestamp) = p.period_start
      end
    )
    group by p.period_start, period
    order by p.period_start
  ),
  country_breakdown as (
    select country as value, count(*) as count
    from filtered_events
    where country is not null
    group by country
    order by count desc
  ),
  city_breakdown as (
    select city as value, count(*) as count
    from filtered_events
    where city is not null
    group by city
    order by count desc
    limit 20
  ),
  device_breakdown as (
    select device_type as value, count(*) as count
    from filtered_events
    where device_type is not null
    group by device_type
    order by count desc
  ),
  browser_breakdown as (
    select browser as value, count(*) as count
    from filtered_events
    where browser is not null
    group by browser
    order by count desc
  ),
  os_breakdown as (
    select os as value, count(*) as count
    from filtered_events
    where os is not null
    group by os
    order by count desc
  ),
  referrer_breakdown as (
    select referrer as value, count(*) as count
    from filtered_events
    where referrer is not null
    group by referrer
    order by count desc
    limit 20
  )
  select json_build_object(
    'total_clicks', (select coalesce(total_clicks, 0) from summary),
    'unique_visitors', (select coalesce(unique_visitors, 0) from summary),
    'time_series', (select coalesce(json_agg(t), '[]'::json) from time_series t),
    'countries', (select coalesce(json_agg(t), '[]'::json) from country_breakdown t),
    'cities', (select coalesce(json_agg(t), '[]'::json) from city_breakdown t),
    'devices', (select coalesce(json_agg(t), '[]'::json) from device_breakdown t),
    'browsers', (select coalesce(json_agg(t), '[]'::json) from browser_breakdown t),
    'operating_systems', (select coalesce(json_agg(t), '[]'::json) from os_breakdown t),
    'referrers', (select coalesce(json_agg(t), '[]'::json) from referrer_breakdown t)
  ) into v_result;

  return v_result;
end;
$$;
