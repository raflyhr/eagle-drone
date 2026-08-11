alter table public.missions
add column if not exists current_altitude_meters numeric not null default 0;
