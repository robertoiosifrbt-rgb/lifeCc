-- APPLIED LIVE (manually, via the Supabase SQL Editor, not through
-- `supabase db push`/CLI — see docs/MIGRATII.md's drift section). Fix for a
-- D1 audit blocker: the Vehicle a Workday used
-- was resolved through an `about` link, the same generic kind a fuel Expense
-- or a car-insurance-renewal task also uses to mention a Vehicle. `about` is
-- deliberately loose — this migration gives the Workday's own cost basis a
-- link kind of its own, `uses`, so an unrelated mention of a Vehicle can
-- never be mistaken for the Vehicle a Workday was actually driven in.
--
-- No live Vehicle-used links exist yet to migrate (D1 D1.B's `about` usage
-- was never exercised against production data), so this is additive only:
-- widen the `links_kind` check, then repoint `pin_shift_rates()`'s Vehicle
-- resolution at `uses` instead of `about`. Everything else about the
-- function — fuel/vehicle-cost lookups, the Completed early return — is
-- untouched.

begin;

alter table public.links drop constraint links_kind;
alter table public.links add constraint links_kind check (kind in ('about', 'pays', 'uses'));

create or replace function public.pin_shift_rates() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  item_state text;
  vehicle    uuid;
begin
  select state into item_state from public.items where id = new.item_id;

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

  select vehicle_per_km into new.rate_vehicle_per_km
    from public.vehicle_cost_rates
   where vehicle_item_id = vehicle
     and effective_from <= (timezone('utc', now()))::date
     and deleted_at is null
   order by effective_from desc
   limit 1;

  return new;
end $$;

commit;
