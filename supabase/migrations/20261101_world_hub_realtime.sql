-- Multiplayer city hub: live presence + movement over Supabase Realtime.
-- The browser joins the private channel `world-hub:<world uuid>`. Only
-- active members of that world may receive (select) or send (insert)
-- presence and broadcast messages on it, so non-members can neither watch
-- who is online nor inject fake avatars.
-- Forward-only and idempotent.

create or replace function public.can_use_world_hub(p_topic text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_world uuid;
begin
  if p_topic is null or p_topic !~ '^world-hub:[0-9a-fA-F-]{36}$' then return false; end if;
  v_world := split_part(p_topic, ':', 2)::uuid;
  return exists (
    select 1 from public.world_memberships m
    where m.world_id = v_world and m.account_id = auth.uid() and m.status = 'active'
  );
end; $$;
revoke all on function public.can_use_world_hub(text) from public, anon;
grant execute on function public.can_use_world_hub(text) to authenticated;

drop policy if exists "world hub: members receive" on realtime.messages;
create policy "world hub: members receive" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension in ('presence', 'broadcast') and public.can_use_world_hub(realtime.topic()));

drop policy if exists "world hub: members send" on realtime.messages;
create policy "world hub: members send" on realtime.messages
  for insert to authenticated
  with check (realtime.messages.extension in ('presence', 'broadcast') and public.can_use_world_hub(realtime.topic()));
