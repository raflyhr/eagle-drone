create or replace function public.finalize_mission_max_altitude()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  computed_max_altitude numeric;
begin
  if new.status = 'success' and (old.status is distinct from new.status or old.finished_at is distinct from new.finished_at) then
    select coalesce(max(altitude_meters), 0)
    into computed_max_altitude
    from public.mission_track_points
    where mission_id = new.id;

    new.max_altitude_meters = greatest(coalesce(new.max_altitude_meters, 0), computed_max_altitude);
  end if;

  return new;
end;
$$;

drop trigger if exists missions_finalize_max_altitude on public.missions;

create trigger missions_finalize_max_altitude
before update on public.missions
for each row execute function public.finalize_mission_max_altitude();
