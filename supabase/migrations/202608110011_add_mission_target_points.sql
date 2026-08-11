create table public.mission_target_points (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  name text not null,
  latitude numeric not null,
  longitude numeric not null,
  marked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index mission_target_points_mission_marked_idx on public.mission_target_points(mission_id, marked_at desc);
alter table public.mission_target_points enable row level security;
create policy "anon can read target points" on public.mission_target_points for select to anon using (true);
create policy "anon can insert target points" on public.mission_target_points for insert to anon with check (true);
create policy "anon can delete target points" on public.mission_target_points for delete to anon using (true);
