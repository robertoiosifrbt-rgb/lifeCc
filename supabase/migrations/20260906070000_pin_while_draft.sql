-- NOT APPLIED LIVE. Written for the Workday recovery task, not run against
-- production and not declared applied in docs/MIGRATII.md until it is.
--
-- `pin_shift_rates()` (20260905100000_reserves, redefined by
-- 20260905160000_one_answer) only ever fills a null rate. That is right for
-- the reason its own comment gives — "a shift keeps the rates it was worked
-- under" — but that reason only applies once a day is actually settled. A
-- Draft is not settled: the owner can still edit its Area, and correcting the
-- Area is not "the same day, a second guess" — the day was never worked
-- under the old Area's rate at all, so keeping that number pinned is not
-- history being preserved, it is a mistake that happened to get written down
-- first.
--
-- So the rule now has two halves instead of one:
--
--   Draft      — always the current Area's rate, every time the row is
--                written, matching whatever the Workday sheet is showing.
--   Completed  — exactly what today's function already does: left alone.
--
-- Only reachable in practice while a shift is a Draft in the first place:
-- nothing in the application writes to a shift's own row once its anchor is
-- `done`. The check is here anyway, at the one function that already owns
-- this decision, rather than trusted to stay true on the client's word.

begin;

create or replace function public.pin_shift_rates() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  area  uuid;
  item_state text;
begin
  select area_id, state into area, item_state
    from public.items where id = new.item_id;

  -- Completed: the existing behaviour, untouched. A shift that has already
  -- been worked keeps whatever it was pinned under.
  if item_state = 'done' then
    return new;
  end if;

  -- Still a Draft: the Area's rate, current as of this write — never a
  -- rate left behind by an Area the day no longer belongs to, and never
  -- a rate this write cannot yet justify because there is no Area at all.
  if area is not null then
    select fuel_per_km, vehicle_per_km
      into new.rate_fuel_per_km, new.rate_vehicle_per_km
      from public.running_costs where area_id = area;
  else
    new.rate_fuel_per_km := null;
    new.rate_vehicle_per_km := null;
  end if;

  return new;
end $$;

commit;
