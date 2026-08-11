alter table public.missions
drop constraint if exists missions_mission_type_check;

alter table public.missions
drop constraint if exists missions_status_check;

update public.missions
set mission_type = 'evacuation'
where mission_type = 'sar_automation';

update public.missions
set status = 'success'
where status = 'aborted';

alter table public.missions
add constraint missions_mission_type_check
check (mission_type in ('thermal_search', 'p3k_delivery', 'evacuation'));

alter table public.missions
add constraint missions_status_check
check (status in ('in_progress', 'success', 'simulation'));
