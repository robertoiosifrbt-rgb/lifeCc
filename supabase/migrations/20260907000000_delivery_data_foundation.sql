-- NOT APPLIED LIVE. D1 — Delivery Data Foundation. Local repo only, not run
-- against production, not declared applied in docs/MIGRATII.md until it is.
--
-- Five things, all part of the same audit's findings on top of
-- `20260906070000_pin_while_draft`:
--
--   1. Vehicle cost/wear moves off `running_costs` (Area-keyed) onto a new
--      per-Vehicle, effective-dated table — the same semantic correction
--      0700 already gave fuel, now given to wear too, and independent of it:
--      configuring a cost never requires a known fuel rate.
--   2. `pin_shift_rates()` is rewritten again to read both rates from the
--      Vehicle alone; `running_costs`/`items.area_id` are no longer read by
--      it at all.
--   3. `vehicle_fuel_rates` gains a real invalidation path: the fuel query
--      now excludes a soft-deleted row, so a rate that became unknowable
--      after an edit/delete stops being pinned onto new Draft writes.
--   4. Configurable Platforms: the data foundation only — an Item anchor +
--      extension, exactly like Entities, linked to a Company Entity through
--      the same `links` table everything else already uses. No payout or
--      settlement execution lives here; that is D2.
--   5. `shift_earnings` gains a nullable `platform_item_id`, alongside the
--      existing `platform` text column, never replacing it: an old row keeps
--      meaning exactly what it always meant, and nothing here guesses which
--      Platform record an old `'other'` (or any other legacy value) was.
--
-- Plus one more: Completed immutability stops being a UI convention. A
-- Workday's `state='done'` is read by application code today, never
-- enforced by the database — this migration adds that enforcement directly,
-- independent of `20260906060000_shift_invariants` (blocked, untouched,
-- unrelated concern).

begin;

-- 1. Vehicle cost/wear, per Vehicle, effective-dated.
--
-- Not a single mutable row like `running_costs` was: a rate the owner
-- configures today must not rewrite what an earlier date was assessed
-- against. Each save is a new row keyed by the day it took effect, unless
-- it corrects the same day again — "current" is simply the newest row not
-- yet in the future. A Completed shift never reads this table at all: its
-- own `rate_vehicle_per_km` was already pinned at the moment it was
-- written, by the same trigger, and stays exactly that afterwards.
create table public.vehicle_cost_rates (
  vehicle_item_id uuid not null,
  owner           uuid not null default auth.uid(),
  effective_from  date not null default (timezone('utc', now()))::date,

  vehicle_per_km numeric(8, 4) not null,

  version    integer     not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  primary key (vehicle_item_id, effective_from),

  constraint vehicle_cost_rates_item
    foreign key (vehicle_item_id, owner) references public.items (id, owner)
    on delete cascade,

  constraint vehicle_cost_rates_positive check (vehicle_per_km >= 0)
);

create trigger vehicle_cost_rates_stamp
  before insert or update on public.vehicle_cost_rates
  for each row execute function public.stamp_setting();

revoke all on table public.vehicle_cost_rates from anon, authenticated;

grant select on table public.vehicle_cost_rates to authenticated;
grant insert (vehicle_item_id, effective_from, vehicle_per_km)
  on table public.vehicle_cost_rates to authenticated;
grant update (vehicle_per_km, deleted_at) on table public.vehicle_cost_rates to authenticated;

-- Both halves of the key are grantable, for the same upsert-vs-grant reason
-- every other keyed setting needs it, and both are pinned: a row's Vehicle
-- and the day it took effect are the historical fact, never editable after
-- the fact — only vehicle_per_km and deleted_at may actually move.
grant update (vehicle_item_id, effective_from) on table public.vehicle_cost_rates to authenticated;
create trigger vehicle_cost_rates_pin
  before update on public.vehicle_cost_rates
  for each row execute function public.pin('vehicle_item_id', 'effective_from');

alter table public.vehicle_cost_rates enable row level security;

create policy vehicle_cost_rates_select on public.vehicle_cost_rates for select to authenticated
  using (owner = auth.uid());
create policy vehicle_cost_rates_insert on public.vehicle_cost_rates for insert to authenticated
  with check (owner = auth.uid());
create policy vehicle_cost_rates_update on public.vehicle_cost_rates for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());


-- 4. Configurable Platforms — a fifth kind, an Item like any other.
alter table public.items drop constraint items_kind_check;
alter table public.items add constraint items_kind_check
  check (kind in ('task', 'letter', 'shift', 'expense', 'entity', 'journal', 'platform'));

-- Identity (name, active, order) lives here and rides the anchor, same as
-- Entity. The Company a Platform pays through is an `about` Link to a
-- Company Entity — the existing generic relation, not a new column, so a
-- Platform with no Company yet, or one linked later, needs no migration.
--
-- The rule fields below are D2's to execute, not D1's — deliberately a
-- single current row, like every other settings extension in this schema,
-- because nothing yet reads a past version of them: a Completed Workday's
-- own money is pinned on the shift itself, never re-derived from a
-- Platform's current configuration. If D2 needs history for these specific
-- fields, that is its own migration to add, not a shape D1 has to guess at
-- now.
create table public.platforms (
  item_id uuid primary key,
  owner   uuid not null default auth.uid(),

  active        boolean not null default true,
  display_order integer not null default 0,

  earning_cycle_kind      text,
  earning_cycle_starts_on text,
  payout_schedule         text,

  cashout_enabled    boolean not null default false,
  cashout_settlement text,
  cashout_fee_type   text,
  cashout_fee_value  numeric(10, 2),

  constraint platforms_item_owner
    foreign key (item_id, owner) references public.items (id, owner)
    on delete cascade,

  constraint platforms_fee_type check (
    cashout_fee_type is null or cashout_fee_type in ('fixed', 'percent')
  ),
  constraint platforms_fee_value_positive check (
    cashout_fee_value is null or cashout_fee_value >= 0
  )
);

create trigger platforms_touch_anchor
  after insert or update or delete on public.platforms
  for each row execute function public.touch_anchor();

revoke all on table public.platforms from anon, authenticated;

grant select, delete on table public.platforms to authenticated;
grant insert (
  item_id, active, display_order,
  earning_cycle_kind, earning_cycle_starts_on, payout_schedule,
  cashout_enabled, cashout_settlement, cashout_fee_type, cashout_fee_value
) on table public.platforms to authenticated;
grant update (
  item_id, active, display_order,
  earning_cycle_kind, earning_cycle_starts_on, payout_schedule,
  cashout_enabled, cashout_settlement, cashout_fee_type, cashout_fee_value
) on table public.platforms to authenticated;

create trigger platforms_pin
  before update on public.platforms
  for each row execute function public.pin('item_id');

alter table public.platforms enable row level security;

create policy platforms_select on public.platforms for select to authenticated
  using (owner = auth.uid());
create policy platforms_insert on public.platforms for insert to authenticated
  with check (owner = auth.uid());
create policy platforms_update on public.platforms for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy platforms_delete on public.platforms for delete to authenticated
  using (owner = auth.uid());


-- 5. `shift_earnings`, extended rather than replaced.
--
-- The old primary key (item_id, platform) cannot survive `platform` turning
-- nullable — a NULL platform column could never satisfy a PK across many
-- rows for the same item. A surrogate id takes its place, and it is also
-- exactly the stable identity D2 will need to attach a settlement event to
-- the earning that produced it. The two unique indexes below are the old
-- constraint's replacement, one per era. Both are ordinary (non-partial)
-- indexes on purpose: regular UNIQUE semantics already treat NULL as
-- distinct from every other NULL, so a legacy row (platform set,
-- platform_item_id null) never collides with a configurable-Platform row
-- (the reverse) on either index — no WHERE predicate needed, and none
-- added, because a partial index cannot be named as an `ON CONFLICT`
-- target without repeating its predicate there too (Postgres 42P10); the
-- app's `.upsert(..., { onConflict: 'item_id,platform' })` has no way to do
-- that.
alter table public.shift_earnings add column id uuid not null default gen_random_uuid();
alter table public.shift_earnings drop constraint shift_earnings_pkey;
alter table public.shift_earnings add primary key (id);

alter table public.shift_earnings alter column platform drop not null;
alter table public.shift_earnings add column platform_item_id uuid;

alter table public.shift_earnings
  add constraint shift_earnings_platform_owner
    foreign key (platform_item_id, owner) references public.items (id, owner)
    on delete cascade;

alter table public.shift_earnings
  add constraint shift_earnings_one_platform_kind check (
    (platform is not null) <> (platform_item_id is not null)
  );

create unique index shift_earnings_legacy_platform_unique
  on public.shift_earnings (item_id, platform);
create unique index shift_earnings_platform_item_unique
  on public.shift_earnings (item_id, platform_item_id);

-- Same upsert-vs-grant shape `20260905170000_upsert_keys` already fixed for
-- `(item_id, platform)`: `platform_item_id` also sits in an upsert's own SET
-- list once a second write targets the same (item_id, platform_item_id)
-- conflict target, so it needs the grant too — and `shift_earnings_pin` is
-- recreated to pin it, exactly as it already pins `item_id`/`platform`, so
-- the grant only lets the upsert name the column, never actually move it.
grant insert (platform_item_id) on table public.shift_earnings to authenticated;
grant update (platform_item_id) on table public.shift_earnings to authenticated;

drop trigger shift_earnings_pin on public.shift_earnings;
create trigger shift_earnings_pin
  before update on public.shift_earnings
  for each row execute function public.pin('item_id', 'platform', 'platform_item_id');


-- Completed immutability, enforced at the boundary rather than trusted to
-- the client's word. `state='done'` was already read by application code —
-- Complete Workday's own writes always land while the item is still
-- `active`, one write before the state flips, so this never blocks the
-- completion itself; it blocks everything after it.
create function public.reject_write_to_completed_shift() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  item_state text;
begin
  select state into item_state
    from public.items where id = coalesce(new.item_id, old.item_id);
  if item_state = 'done' then
    raise exception 'A Completed workday''s % cannot be changed', tg_table_name
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create trigger shifts_reject_completed_write
  before insert or update or delete on public.shifts
  for each row execute function public.reject_write_to_completed_shift();
create trigger shift_sessions_reject_completed_write
  before insert or update or delete on public.shift_sessions
  for each row execute function public.reject_write_to_completed_shift();
create trigger shift_earnings_reject_completed_write
  before insert or update or delete on public.shift_earnings
  for each row execute function public.reject_write_to_completed_shift();

-- The Vehicle relation lives in `links`, a table shared by every kind of
-- item — only a link whose `from_id` is itself a Completed shift is
-- rejected; a link between two unrelated items is never this trigger's
-- business.
create function public.reject_link_change_on_completed_shift() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  item_state text;
begin
  select state into item_state
    from public.items
   where id = coalesce(new.from_id, old.from_id) and kind = 'shift';
  if item_state = 'done' then
    raise exception 'A Completed workday''s links cannot be changed'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create trigger links_reject_completed_shift_change
  before insert or delete on public.links
  for each row execute function public.reject_link_change_on_completed_shift();


-- 2 + 3. `pin_shift_rates()`, rewritten a second time.
--
-- `running_costs`/`items.area_id` are gone from this function entirely: both
-- rates are the linked Vehicle's now, resolved once and read from two
-- Vehicle-keyed tables. The fuel query excludes a soft-deleted
-- `vehicle_fuel_rates` row — the invalidation path `refreshVehicleFuelRate`
-- uses when a rate becomes unknowable — and the Vehicle resolution itself
-- excludes a Vehicle Entity whose own anchor is soft-deleted, so a removed
-- car cannot keep silently pricing new Draft writes either.
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

  -- The one Vehicle this shift's own item points at with an `about` link,
  -- whose own anchor is not soft-deleted — null when there is none, more
  -- than one, or the one there is has been removed. Never a guess between
  -- candidates.
  with candidates as (
    select l.to_id
    from public.links l
    join public.entities e on e.item_id = l.to_id and e.entity_kind = 'vehicle'
    join public.items i on i.id = l.to_id and i.deleted_at is null
    where l.from_id = new.item_id and l.kind = 'about'
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
