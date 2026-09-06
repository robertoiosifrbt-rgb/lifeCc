-- NOT APPLIED LIVE. Written for the Workday recovery task, not run against
-- production and not declared applied in docs/MIGRATII.md until it is.
--
-- Rewritten in place (never applied, so there is nothing live to preserve):
-- the first version of this file only reworked when `pin_shift_rates()`
-- re-derives its rates — Draft, every write; Completed, never — and left
-- both rates keyed off `items.area_id`, the same as before it. A full-diff
-- audit found that wrong for fuel: fuel is what a Vehicle burns, not what an
-- Area costs. Two vehicles sharing an Area do not share one tank of fuel,
-- and one vehicle worked across several Areas does not restart its fuel
-- history every time the Area changes. Vehicle wear (`rate_vehicle_per_km`)
-- is untouched — the original task scoped that rate to stay an Area setting,
-- and nothing here disagrees with that.
--
-- "The" Vehicle a shift used is resolved from the same Life Core primitives
-- everything else already reuses: an `about` Link from the shift's own item
-- to a Vehicle Entity's anchor (`src/repository/link.ts`'s own doc comment
-- already establishes `about` for "an Item is associated with a Vehicle
-- Entity" — the renewal example). `links` carries no constraint stopping a
-- second such Link, so ambiguity is a real state, not a schema violation, and
-- this trigger treats it the same way `sessionControlsOf` treats two open
-- sessions: not resolved by picking one, left unknown instead.
--
-- The one schema addition this needs: `vehicle_fuel_rates`, a per-Vehicle
-- mirror of what `running_costs.fuel_per_km` already does for an Area. A
-- trigger cannot run the full-tank-to-full-tank sum inline, so the client
-- works it out (`fuelRateForVehicle`) and writes it here every time a fuel
-- expense for that Vehicle is recorded or removed
-- (`refreshVehicleFuelRate`) — the only place anything writes this table,
-- and the only reader is this trigger. No screen reads it back; the live
-- display recomputes straight from the fuel expenses instead, the same as
-- it always has.
--
-- Rule, same two halves as before:
--
--   Draft      — always the current rates, every time the row is written:
--                the Area's vehicle wear, and the linked Vehicle's fuel.
--   Completed  — exactly what today's function already does: left alone.
--
-- Only reachable in practice while a shift is a Draft in the first place:
-- nothing in the application writes to a shift's own row once its anchor is
-- `done`. The check is here anyway, at the one function that already owns
-- this decision, rather than trusted to stay true on the client's word.

begin;

create table public.vehicle_fuel_rates (
  vehicle_item_id uuid primary key,
  owner           uuid not null default auth.uid(),

  fuel_per_km numeric(8, 4) not null,

  version    integer     not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint vehicle_fuel_rates_item
    foreign key (vehicle_item_id, owner) references public.items (id, owner)
    on delete cascade,

  constraint vehicle_fuel_rates_positive check (fuel_per_km >= 0)
);

create trigger vehicle_fuel_rates_stamp
  before insert or update on public.vehicle_fuel_rates
  for each row execute function public.stamp_setting();

-- Order matters here, and a full-diff audit found it wrong: `revoke all` was
-- written AFTER the targeted grant below, which wiped it out again —
-- `entities`/`vehicle_cost_rates` both revoke first, then grant, and this
-- table did the opposite. The result was an upsert that could never
-- succeed: `.upsert()` names every column of its payload in the SET list,
-- `vehicle_item_id` included, and UPDATE on it had just been revoked with
-- nothing granting it back.
revoke all on table public.vehicle_fuel_rates from anon, authenticated;

grant select on table public.vehicle_fuel_rates to authenticated;
grant insert (vehicle_item_id, fuel_per_km) on table public.vehicle_fuel_rates to authenticated;
grant update (fuel_per_km, deleted_at) on table public.vehicle_fuel_rates to authenticated;

-- Same upsert-vs-grant fix `20260905170000_upsert_keys` already gave every
-- other keyed setting: the key column has to be grantable for the upsert to
-- name it, and the trigger is what actually keeps it from moving.
grant update (vehicle_item_id) on table public.vehicle_fuel_rates to authenticated;
create trigger vehicle_fuel_rates_pin
  before update on public.vehicle_fuel_rates
  for each row execute function public.pin('vehicle_item_id');

alter table public.vehicle_fuel_rates enable row level security;

create policy vehicle_fuel_rates_select on public.vehicle_fuel_rates for select to authenticated
  using (owner = auth.uid());
create policy vehicle_fuel_rates_insert on public.vehicle_fuel_rates for insert to authenticated
  with check (owner = auth.uid());
create policy vehicle_fuel_rates_update on public.vehicle_fuel_rates for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

create or replace function public.pin_shift_rates() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  area       uuid;
  item_state text;
  vehicle    uuid;
begin
  select area_id, state into area, item_state
    from public.items where id = new.item_id;

  -- Completed: the existing behaviour, untouched. A shift that has already
  -- been worked keeps whatever it was pinned under.
  if item_state = 'done' then
    return new;
  end if;

  -- Vehicle wear: still the Area's own setting, current as of this write —
  -- exactly as before this migration touched anything.
  if area is not null then
    select vehicle_per_km into new.rate_vehicle_per_km
      from public.running_costs where area_id = area;
  else
    new.rate_vehicle_per_km := null;
  end if;

  -- The one Vehicle this shift's own item points at with an `about` link —
  -- null when there is none, or more than one. Never a guess between two
  -- candidates: an ambiguous Vehicle leaves the fuel rate unknown, the same
  -- way two open sessions leave Stop with nothing to close.
  with candidates as (
    select l.to_id
    from public.links l
    join public.entities e on e.item_id = l.to_id and e.entity_kind = 'vehicle'
    where l.from_id = new.item_id and l.kind = 'about'
  )
  select to_id into vehicle from candidates
  where (select count(*) from candidates) = 1;

  if vehicle is not null then
    select fuel_per_km into new.rate_fuel_per_km
      from public.vehicle_fuel_rates where vehicle_item_id = vehicle;
  else
    new.rate_fuel_per_km := null;
  end if;

  return new;
end $$;

commit;
