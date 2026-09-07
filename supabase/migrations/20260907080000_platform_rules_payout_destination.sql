-- NOT APPLIED LIVE (not declared applied in docs/MIGRATII.md until it is).
--
-- D1 audit blocker: `docs/PLAN.md`'s own list of what the Platform data
-- foundation must be able to represent names "payout destination account"
-- alongside earning cycle, automatic payout schedule, cash-out enabled/
-- disabled, settlement timing and fee — `platform_rules`
-- (`20260907030000_platform_rules`) has a column for every one of those
-- except this one. Nothing reads or writes it yet — no payout-destination
-- screen exists, execution is D2/D3 — but the foundation could not even
-- hold the value if it existed, which the audit is right to call a gap in
-- the foundation itself, not a missing screen.
--
-- Kept a plain reference, the same shape as `cashout_settlement`
-- (settlement timing, also plain text, also unexecuted): no bank-account
-- entity kind exists in `entities` yet (`person`/`company`/`property`/
-- `vehicle` only), and inventing one now to back a column nothing writes
-- would be designing D3's payout UX ahead of it actually being built.

begin;

alter table public.platform_rules
  add column payout_destination_reference text;

grant insert (payout_destination_reference) on table public.platform_rules to authenticated;
grant update (payout_destination_reference) on table public.platform_rules to authenticated;

commit;
