with ranked_live as (
  select id, row_number() over (order by started_at desc, created_at desc) as position
  from public.missions
  where status = 'live'
)
update public.missions
set status = 'success',
    finished_at = coalesce(finished_at, now())
where id in (
  select id
  from ranked_live
  where position > 1
);

create or replace function public.finish_previous_live_missions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'live' then
    update public.missions
    set status = 'success',
        finished_at = coalesce(finished_at, new.started_at, now())
    where status = 'live';
  end if;
  return new;
end;
$$;

drop trigger if exists missions_finish_previous_live on public.missions;

create trigger missions_finish_previous_live
before insert on public.missions
for each row execute function public.finish_previous_live_missions();

create unique index if not exists missions_one_live_idx
on public.missions ((true))
where status = 'live';
