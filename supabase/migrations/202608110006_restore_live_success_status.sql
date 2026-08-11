alter table public.missions
drop constraint if exists missions_status_check;

alter table public.missions
add constraint missions_status_check
check (status in ('live', 'success'));
