-- APPLIED LIVE (manually, via the Supabase SQL Editor, not through
-- `supabase db push`/CLI — see docs/MIGRATII.md's drift section). D1 audit
-- blocker: D1.F requires "effective-dated/
-- versioned financial rule semantics" in the Platform data foundation, but
-- `platforms` (already live, from `20260907000000_delivery_data_foundation`)
-- keeps earning cycle/payout/cash-out as a single mutable row — the same
-- shape `vehicle_cost_rates` replaced for Vehicle wear, for the same reason:
-- a rule changed today must not silently rewrite what applied yesterday.
--
-- `platforms` itself is untouched by nothing here having ever written these
-- seven columns — no Platform-management screen exists yet (that is D3's),
-- so nothing on live can hold a real value in any of them. Dropping them is
-- schema cleanup, not data loss.

begin;

alter table public.platforms
  drop column earning_cycle_kind,
  drop column earning_cycle_starts_on,
  drop column payout_schedule,
  drop column cashout_enabled,
  drop column cashout_settlement,
  drop column cashout_fee_type,
  drop column cashout_fee_value;

alter table public.platforms drop constraint if exists platforms_fee_type;
alter table public.platforms drop constraint if exists platforms_fee_value_positive;

create table public.platform_rules (
  platform_item_id uuid not null,
  owner            uuid not null default auth.uid(),
  effective_from   date not null default (timezone('utc', now()))::date,

  earning_cycle_kind      text,
  earning_cycle_starts_on text,
  payout_schedule         text,

  cashout_enabled    boolean not null default false,
  cashout_settlement text,
  cashout_fee_type   text,
  cashout_fee_value  numeric(10, 2),

  version    integer     not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  primary key (platform_item_id, effective_from),

  constraint platform_rules_item
    foreign key (platform_item_id, owner) references public.items (id, owner)
    on delete cascade,

  constraint platform_rules_fee_type check (
    cashout_fee_type is null or cashout_fee_type in ('fixed', 'percent')
  ),
  constraint platform_rules_fee_value_positive check (
    cashout_fee_value is null or cashout_fee_value >= 0
  )
);

create trigger platform_rules_stamp
  before insert or update on public.platform_rules
  for each row execute function public.stamp_setting();

revoke all on table public.platform_rules from anon, authenticated;

grant select on table public.platform_rules to authenticated;
grant insert (
  platform_item_id, effective_from,
  earning_cycle_kind, earning_cycle_starts_on, payout_schedule,
  cashout_enabled, cashout_settlement, cashout_fee_type, cashout_fee_value
) on table public.platform_rules to authenticated;
grant update (
  earning_cycle_kind, earning_cycle_starts_on, payout_schedule,
  cashout_enabled, cashout_settlement, cashout_fee_type, cashout_fee_value,
  deleted_at
) on table public.platform_rules to authenticated;

-- Same upsert-vs-grant shape every other keyed setting in this schema needs:
-- the key has to be grantable for the upsert to name it, and the trigger is
-- what actually keeps it from moving.
grant update (platform_item_id, effective_from) on table public.platform_rules to authenticated;
create trigger platform_rules_pin
  before update on public.platform_rules
  for each row execute function public.pin('platform_item_id', 'effective_from');

alter table public.platform_rules enable row level security;

create policy platform_rules_select on public.platform_rules for select to authenticated
  using (owner = auth.uid());
create policy platform_rules_insert on public.platform_rules for insert to authenticated
  with check (owner = auth.uid());
create policy platform_rules_update on public.platform_rules for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

commit;
