-- NOT APPLIED LIVE. D1 audit blocker: `pin_shift_rates()` pinned
-- `vehicle_cost_rates.vehicle_per_km` by comparing `effective_from` against
-- `now()` — the moment the Draft is saved, not the day the Workday is for.
-- A Workday entered or edited after the fact (a day worked last week, typed
-- up today) would pin whatever rate is current today, not the rate that was
-- actually in force on the day driven; a rate corrected after the fact for a
-- past date would never reach a Workday already saved on that date either
-- way, since the write reads "today" regardless of which day the row is
-- for. `items.due` is the Workday's own day — the same column
-- `createDated`/`createShift` set it to — so the lookup now compares against
-- that instead.
--
-- `vehicle_fuel_rates` needs no equivalent change: it is a single mutable
-- row (invalidated by soft-delete only, no history), so there is no date to
-- get right or wrong.

begin;

create or replace function public.pin_shift_rates() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  item_state  text;
  workday_due date;
  vehicle     uuid;
begin
  select state, due into item_state, workday_due
    from public.items where id = new.item_id;

  -- Completed: unchanged. A shift that has already been worked keeps
  -- whatever it was pinned under.
  if item_state = 'done' then
    return new;
  end if;

  -- The one Vehicle this shift's own item actually *uses* — never a looser
  -- `about` mention, which could just as easily be an unrelated Vehicle this
  -- item happens to reference. Null when there is none, more than one, or
  -- the one there is has been removed. Never a guess between candidates.
  with candidates as (
    select l.to_id
    from public.links l
    join public.entities e on e.item_id = l.to_id and e.entity_kind = 'vehicle'
    join public.items i on i.id = l.to_id and i.deleted_at is null
    where l.from_id = new.item_id and l.kind = 'uses'
  )
  select to_id into vehicle from candidates
  where (select count(*) from candidates) = 1;

  if vehicle is null then
    new.rate_fuel_per_km := null;
    new.rate_vehicle_per_km := null;
    return new;
  end if;

  select fuel_per_km into new.rate_fuel_per_km
    from public.vehicle_fuel_rates
   where vehicle_item_id = vehicle and deleted_at is null;

  -- The Workday's own day, not the moment of this write. `due` is expected
  -- on every shift anchor (`createDated` always sets it); the fallback to
  -- today only covers an anchor that somehow has none, rather than pinning
  -- nothing at all.
  select vehicle_per_km into new.rate_vehicle_per_km
    from public.vehicle_cost_rates
   where vehicle_item_id = vehicle
     and effective_from <= coalesce(workday_due, (timezone('utc', now()))::date)
     and deleted_at is null
   order by effective_from desc
   limit 1;

  return new;
end $$;

commit;
