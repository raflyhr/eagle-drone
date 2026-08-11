drop trigger if exists missions_finish_previous_active on public.missions;
drop function if exists public.finish_previous_active_missions();
drop index if exists public.missions_one_active_idx;

alter table public.missions
drop constraint if exists missions_status_check;

update public.missions
set status = 'success'
where status <> 'success';

alter table public.missions
alter column status set default 'success';

alter table public.missions
add constraint missions_status_check
check (status = 'success');
