do $$
declare
  table_name text;
begin
  foreach table_name in array array['mission_track_points', 'mission_captures', 'mission_marked_locations']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
