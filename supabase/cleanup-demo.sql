begin;

truncate table
  public.mission_marked_locations,
  public.mission_captures,
  public.mission_track_points,
  public.missions
restart identity cascade;

commit;
