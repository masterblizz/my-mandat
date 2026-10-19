-- Adds a fixed, server-enforced cadence for the initial community turns.
alter table public.worlds add column if not exists turn_duration_minutes integer not null default 60 check (turn_duration_minutes between 5 and 1440);
update public.world_turns set closes_at = opens_at + interval '60 minutes' where closes_at is null and status = 'open';

create or replace function public.assign_world_turn_deadline()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_minutes integer;
begin
  if new.closes_at is null then
    select turn_duration_minutes into v_minutes from public.worlds where id = new.world_id;
    new.closes_at := new.opens_at + make_interval(mins => coalesce(v_minutes, 60));
  end if;
  return new;
end; $$;
drop trigger if exists world_turns_assign_deadline on public.world_turns;
create trigger world_turns_assign_deadline before insert on public.world_turns for each row execute function public.assign_world_turn_deadline();

-- Replace only to ensure successor turns receive a deadline through the trigger.
-- `resolve_world_turn` remains the idempotent resolver introduced in 20261021.
