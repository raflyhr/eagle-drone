with ranked_active as (
  select id, row_number() over (order by started_at desc, created_at desc) as position
  from public.missions
  where status in ('in_progress', 'simulation')
)
update public.missions
set status = 'success',
    finished_at = coalesce(finished_at, now())
where id in (
  select id
  from ranked_active
  where position > 1
);

create or replace function public.finish_previous_active_missions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('in_progress', 'simulation') then
    update public.missions
    set status = 'success',
        finished_at = coalesce(finished_at, new.started_at, now())
    where status in ('in_progress', 'simulation');
  end if;
  return new;
end;
$$;

drop trigger if exists missions_finish_previous_active on public.missions;

create trigger missions_finish_previous_active
before insert on public.missions
for each row execute function public.finish_previous_active_missions();

create unique index if not exists missions_one_active_idx
on public.missions ((true))
where status in ('in_progress', 'simulation');
