-- The columns the owner's own app has and this one did not.
--
-- Taken from the export he sent, table by table, not invented here:
--
--   Shifts        otherPlatformEarnings, bonuses, parkingCost, tollsCost,
--                 otherShiftCost
--   WorkPeriods   breakMinutes
--   FuelPurchases litres
--   CarExpenses   coverageStartDate, coverageEndDate
--
-- Every one of them changes a number that is already on screen, which is why
-- they come together rather than one at a time: a shift that shows "roughly
-- yours" while ignoring the parking and the bonuses is not missing a feature,
-- it is answering wrong.
--
-- This migration only ADDS, so it runs before the code that reads the columns.


-- A fourth platform. His app has otherPlatformEarnings as a column; here the
-- earnings are one row per platform, so the same thing is a fourth allowed
-- value and no new column at all.
alter table public.shift_earnings drop constraint shift_earnings_platform;
alter table public.shift_earnings add constraint shift_earnings_platform
  check (platform in ('uber_eats', 'deliveroo', 'just_eat', 'other'));


-- What a shift brought in besides the platforms, and what it cost on the road.
--
-- Parking and tolls are apart from `expenses` on purpose: they are spent
-- inside one shift, they never have a receipt worth filing, and they belong to
-- that shift's own profit rather than to the month's pile of bills. His app
-- draws the same line — directShiftCosts against directExpenses.
alter table public.shifts
  add column bonuses    numeric(10, 2),
  add column parking    numeric(10, 2),
  add column tolls      numeric(10, 2),
  add column other_cost numeric(10, 2);

alter table public.shifts
  add constraint shifts_bonuses_positive    check (bonuses    is null or bonuses    >= 0),
  add constraint shifts_parking_positive    check (parking    is null or parking    >= 0),
  add constraint shifts_tolls_positive      check (tolls      is null or tolls      >= 0),
  add constraint shifts_other_cost_positive check (other_cost is null or other_cost >= 0);


-- The break, on the session that contains it.
--
-- Not on the shift: a day with a lunch session and an evening session has two
-- breaks in different places, and one number on the shift could not say which.
-- Zero rather than null, because a session with no break recorded did have a
-- break of nothing, and the hours are worked out either way.
alter table public.shift_sessions
  add column break_minutes integer not null default 0;

alter table public.shift_sessions
  add constraint shift_sessions_break_positive check (break_minutes >= 0);

-- A break cannot be longer than the session it sits in. The database can see
-- this, so JavaScript does not get to — and a session claiming a four-hour
-- break inside a two-hour stint would report negative hours worked, which then
-- flows into every rate per hour on the app.
alter table public.shift_sessions
  add constraint shift_sessions_break_fits check (
    ended_at is null
    or break_minutes <= extract(epoch from (ended_at - started_at)) / 60
  );


-- The litres. Without them the app can say what a kilometre costs in money and
-- nothing at all about what the car is actually drinking — no l/100km, no MPG,
-- which are the two numbers that tell you the car has a problem before the
-- bill does.
alter table public.expenses add column litres numeric(8, 2);

alter table public.expenses
  add constraint expenses_litres_positive check (litres is null or litres > 0);

-- Litres belong to a fuel purchase, like the pump details already there.
alter table public.expenses
  add constraint expenses_litres_is_fuel check (category = 'fuel' or litres is null);


-- What a bill covers, when it covers a stretch rather than a day.
--
-- A year of insurance paid in September is not September's cost. His app
-- carries coverageStartDate and coverageEndDate for exactly this, and spreads
-- the bill across the days between them. Null for the ordinary case: a tank of
-- fuel is spent on the day it is bought.
alter table public.expenses
  add column covers_from date,
  add column covers_to   date;

alter table public.expenses
  add constraint expenses_coverage_both check (
    (covers_from is null) = (covers_to is null)
  ),
  add constraint expenses_coverage_forward check (
    covers_from is null or covers_to >= covers_from
  );


grant insert (bonuses, parking, tolls, other_cost) on table public.shifts to authenticated;
grant update (bonuses, parking, tolls, other_cost) on table public.shifts to authenticated;

grant insert (break_minutes) on table public.shift_sessions to authenticated;
grant update (break_minutes) on table public.shift_sessions to authenticated;

grant insert (litres, covers_from, covers_to) on table public.expenses to authenticated;
grant update (litres, covers_from, covers_to) on table public.expenses to authenticated;
