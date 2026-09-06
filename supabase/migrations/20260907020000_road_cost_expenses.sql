-- NOT APPLIED LIVE. D1 audit blocker: parking/tolls/other_cost lived as
-- numeric columns directly on `shifts` (from `20260905190000_from_the_reference`,
-- already live) — a second financial truth the frozen contract forbids for
-- new writes. Widens the Expense category enum so a parking or toll cost can
-- become a real, shared Expense object instead, linked to the Workday the
-- same way a fuel Expense already links to a Vehicle.
--
-- The old `shifts.parking`/`tolls`/`other_cost` columns are untouched: they
-- may already hold real figures on live data, and there is no way to convert
-- an existing value into a proper Expense without guessing a title, a day
-- and a business_pct nobody actually typed. They stay exactly as they are,
-- read as a fallback only for a Workday that has never had the field
-- touched since this migration — see `withRoadCostExpenses` in
-- `repository/shift.ts`. No new write ever targets these columns again.

begin;

alter table public.expenses drop constraint expenses_category;
alter table public.expenses add constraint expenses_category check (
  category in ('fuel', 'repair', 'insurance', 'parking', 'tolls', 'other')
);

commit;
