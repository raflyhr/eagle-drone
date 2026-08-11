create policy "anon can delete missions"
on public.missions for delete to anon
using (status = 'success');

create policy "anon can delete mission captures"
on storage.objects for delete to anon
using (bucket_id = 'mission-captures');
