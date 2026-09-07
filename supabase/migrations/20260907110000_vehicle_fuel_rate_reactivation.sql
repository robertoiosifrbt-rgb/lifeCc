-- NOT APPLIED LIVE (not declared applied in docs/MIGRATII.md until it is).
--
-- D1 audit blocker: `clearVehicleFuelRate` soft-deletes a Vehicle's fuel
-- rate the moment its full-tank chain becomes unknowable (`deleted_at` set).
-- `saveVehicleFuelRate`'s own upsert never named `deleted_at` in its values,
-- so once the chain became valid again it wrote a fresh `fuel_per_km` but
-- left the row soft-deleted — `pin_shift_rates()` only ever reads a row
-- `where ... deleted_at is null`, so a Workday could pin a null fuel rate
-- (or Complete could refuse for "the fuel rate is not known yet") even
-- though the app's own screens showed a perfectly good one.
--
-- Fixed in the client: `saveVehicleFuelRate` now always sends
-- `deleted_at: null` alongside the rate. `.upsert()` compiles to one
-- `insert ... on conflict do update`, so that column has to be grantable on
-- the insert branch too, not only the update branch it already had — the
-- first-ever rate for a Vehicle would otherwise fail outright the moment
-- the client started naming the column.

begin;

grant insert (deleted_at) on table public.vehicle_fuel_rates to authenticated;

commit;
