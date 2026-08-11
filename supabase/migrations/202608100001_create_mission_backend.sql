create extension if not exists pgcrypto;

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  mission_code text not null unique,
  mission_type text not null check (mission_type in ('thermal_search', 'p3k_delivery', 'evacuation')),
  status text not null default 'success' check (status = 'success'),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  distance_meters numeric not null default 0 check (distance_meters >= 0),
  max_altitude_meters numeric not null default 0,
  start_lat numeric,
  start_lng numeric,
  finish_lat numeric,
  finish_lng numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mission_track_points (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  latitude numeric not null,
  longitude numeric not null,
  altitude_meters numeric,
  speed_mps numeric,
  heading numeric,
  battery_percent numeric,
  created_at timestamptz not null default now()
);

create table public.mission_captures (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  storage_path text not null,
  captured_at timestamptz not null default now(),
  ai_detections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.mission_marked_locations (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  capture_id uuid references public.mission_captures(id) on delete set null,
  latitude numeric not null,
  longitude numeric not null,
  altitude_meters numeric,
  marked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index missions_started_at_idx on public.missions(started_at desc);
create index missions_status_idx on public.missions(status);
create index mission_track_points_mission_recorded_idx on public.mission_track_points(mission_id, recorded_at);
create index mission_captures_mission_captured_idx on public.mission_captures(mission_id, captured_at desc);
create index mission_marked_locations_mission_marked_idx on public.mission_marked_locations(mission_id, marked_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger missions_set_updated_at
before update on public.missions
for each row execute function public.set_updated_at();

alter table public.missions enable row level security;
alter table public.mission_track_points enable row level security;
alter table public.mission_captures enable row level security;
alter table public.mission_marked_locations enable row level security;

create policy "anon can read missions" on public.missions for select to anon using (true);
create policy "anon can insert missions" on public.missions for insert to anon with check (true);
create policy "anon can update missions" on public.missions for update to anon using (true) with check (true);

create policy "anon can read track points" on public.mission_track_points for select to anon using (true);
create policy "anon can insert track points" on public.mission_track_points for insert to anon with check (true);

create policy "anon can read captures" on public.mission_captures for select to anon using (true);
create policy "anon can insert captures" on public.mission_captures for insert to anon with check (true);

create policy "anon can read marked locations" on public.mission_marked_locations for select to anon using (true);
create policy "anon can insert marked locations" on public.mission_marked_locations for insert to anon with check (true);

insert into storage.buckets (id, name, public)
values ('mission-captures', 'mission-captures', false)
on conflict (id) do nothing;

create policy "anon can upload mission captures"
on storage.objects for insert to anon
with check (bucket_id = 'mission-captures');

create policy "anon can read mission captures"
on storage.objects for select to anon
using (bucket_id = 'mission-captures');
