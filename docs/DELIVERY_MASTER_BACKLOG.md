# LIFE CC — DELIVERY MASTER BACKLOG

**Document type:** Active implementation backlog / frozen Delivery scope
**Project:** Life Control Centre (Life CC)
**Configured Area path (data):** Areas → Work → Gig Work → Multi-App Delivery
**Created:** 2026-09-06
**Status:** ACTIVE
**Alignment:** adjusted against current `main` `docs/PLAN.md` on 2026-09-06.
**Authority:** `docs/PLAN.md` remains the product source of truth. This file is the active Delivery implementation backlog. If this backlog ever conflicts with `docs/PLAN.md`, `docs/PLAN.md` wins and the backlog must be corrected before implementation continues.

---

## 1. Why this file exists

This file preserves the complete Delivery implementation sequence so it does not depend on a chat session, a local Claude workspace, or memory.

The Delivery build is intentionally split into three fixed stages:

1. **D1 — Delivery Data Foundation**
2. **D2 — Payout / Cash-out / Settlement + minimum Money dependency**
3. **D3 — Final Delivery Experience**

The stages are sequential. A phase may require fixes before acceptance, but **D2 and D3 must never disappear, be silently merged away, or be replaced by newly invented milestones**.

This file is a backlog, not a historical log. Keep it current while Delivery is active. When Delivery is fully completed and verified, archive this file instead of deleting it.

---

# 2. STATUS BOARD

| Stage | Status | Meaning |
|---|---|---|
| **D1 — Delivery Data Foundation** | **IN PROGRESS** | Local implementation + migrations done; awaiting the ChatGPT full-cumulative audit before D1 can move to DONE. |
| **D2 — Payout / Cash-out / Settlement** | **TODO** | Must begin after D1 is accepted. |
| **D3 — Final Delivery Experience** | **TODO** | Must begin after D2 is accepted. |
| **Multi-App Delivery overall** | **PARTIAL** | Must remain PARTIAL until D1 + D2 + D3 are complete and verified. |

### Fixed order

`D1 → D2 → D3 → Delivery completion review`

No phase is skipped because an audit takes multiple rounds.

An audit round may delay the next stage, but it does not remove or redefine the stages that follow.

---

# 3. DELIVERY PRODUCT BOUNDARY

## 3.1 Multi-App Delivery is an Area in Life Core

`Area` is a Life Core concept: a continuing responsibility in the user's life.

`Multi-App Delivery` is one such Area. The target starting map currently described by PLAN is:

```text
LIFE
└── Work
    └── Gig Work
        └── Multi-App Delivery
```

**That concrete Area tree is user data/configuration, not a hardcoded application hierarchy.**

Therefore:

- `Work`, `Gig Work` and `Multi-App Delivery` are Area records/nodes in the user's data;
- their names are display/user data, not runtime domain identifiers;
- parent/child Area relationships come from data;
- code must not identify the Delivery context by matching an Area title such as `Delivery`, `Multi-App Delivery` or `Gig Work`;
- renaming an Area must not break its linked behavior;
- changing the parent/child placement of an Area must not silently change the identity of the records linked to it;
- the starting map in PLAN is a product starting structure, not permission to encode those names as enums, routes or database identity.

The stable identity used by code is the relevant record/link/configuration identity, such as an `area_id`, not the Area name.

## 3.2 Code provides the engine; configuration binds it to the Area

PLAN's rule is **configuration over hardcoding**.

Code may contain finite, safe, reusable or domain-specific capabilities needed to make Delivery useful, for example:

- shift/session lifecycle;
- `delivery.work` action capability;
- vehicle-usage logic;
- fuel calculations;
- platform-earnings engine;
- expense linking;
- payout/cash-out/settlement engine;
- performance calculations;
- reusable Delivery views/components.

This does **not** make `Multi-App Delivery` itself a hardcoded module identity.

Where code needs an Area context, that context is supplied by data/configuration — normally by stable ID/link — rather than inferred from a title.

A supported action/capability may be coded; **which Area instance it operates on is data**.

No runtime behavior may depend on patterns such as:

```text
if area.name == "Delivery"
if area.name == "Multi-App Delivery"
if parent.name == "Gig Work"
```

Display copy may of course show the user's Area name. The prohibition is on using mutable names/path labels as technical identity.

## 3.3 Delivery is a domain view over shared Life Core truth

Delivery is not a standalone parallel application or a second data universe.

The Delivery experience may contain:

- Dashboard
- Shifts
- Platforms
- Earnings
- Expenses
- Performance

But those views operate over Life Core/shared domain objects and relations.

Ownership boundaries remain:

- **HMRC / Tax** belongs to **Money → Tax**.
- **Vehicle administration** belongs to **Life Core / Directory → Vehicles**.
- **Financial Expenses** are shared Money objects, not Delivery duplicates.
- Delivery may display shared data without becoming its owner.
- One fact is entered once and reused through links and relations.
- links are object/item relationships, never fake `module ↔ module` ownership.

Core product principles from PLAN:

> Code provides the engine; data/configuration defines the user's changing system.

> A normal life or external-rule change must not require an application code change when it can be represented correctly as data.

---

# 4. D1 — DELIVERY DATA FOUNDATION

## D1 objective

Build the final stable data and domain foundation that D2 and D3 can safely use without another architectural rewrite.

D1 is not merely a Workday feature.

D1 covers the Delivery foundation across:

- Area-context binding by stable record/link identity — never by mutable Area name/path
- Workday / Shift lifecycle
- Vehicle usage
- Fuel
- Vehicle cost / wear
- Shared Expenses
- Configurable Platforms
- Platform Earnings
- Completed immutability
- Data integrity
- RLS / repositories / sync
- Local migrations
- Documentation truth

D1 does **not** implement payout settlement flows or the final Delivery dashboard experience.

---

## D1.A — Workday / Shift

A Workday / Shift is the existing Life Core **Item** anchor with the required work/Delivery domain extension.

Its Delivery Area context must be a real Area record/link supplied by data. The Workday must not discover its context by matching `Multi-App Delivery`, `Delivery`, `Gig Work`, or any other mutable Area title.

There must not be a second independent status model.

### Draft

Draft is active and editable.

Deferred edits remain local until:

- **Save Draft**, or
- **Complete**

Closing a dirty draft must support:

- keep editing, or
- discard changes

Discard must actually discard every deferred edit.

### Immediate actions

Only these Workday actions are immediate:

- Start session
- Stop session

They represent real work events and are persisted immediately.

Vehicle selection and normal form edits are **not** immediate.

### Workday foundation must support

- title
- date
- Area
- exactly one Vehicle used for a Completed Workday
- multiple work sessions
- breaks
- start odometer
- end odometer
- personal kilometres
- derived work kilometres / miles
- earnings by configurable platform
- tips
- bonuses
- linked real expenses
- fuel rate / basis
- vehicle cost / wear rate / basis
- Tax / NI preview through the shared Money / Tax engine when inputs exist

### Completion requirements

Complete is allowed only when all required truth exists:

- date exists
- at least one **closed** work session exists
- no open work session exists
- no ambiguous multiple-open session state exists
- exactly one valid Vehicle is linked as the Vehicle used
- start odometer exists
- end odometer exists
- `end odometer > start odometer`
- total earnings are greater than zero
- automatic fuel basis is known
- Vehicle cost / wear basis is known

Total earnings may come from:

- configurable platform earnings
- tips
- bonuses

### Multiple-open session anomaly

If two or more active sessions exist:

- fail safe
- do not guess the valid session
- do not allow Start
- do not allow a guessed Stop
- do not allow deletion of an open session
- do not allow Complete
- do not perform destructive repair
- surface the exact repair-required state

### Completed Workday

Completed is historical truth.

Completed operational and financial fields must be immutable through normal client/repository/database mutation paths, not merely disabled in React UI.

Historical pinned calculation inputs must remain historical even when current configuration changes.

Soft-delete may remain an explicit confirmed lifecycle action if supported by the existing product contract.

---

## D1.B — Vehicle relation

**Area and Vehicle are permanently independent concepts.**

Do not:

- use Area as Vehicle
- infer Vehicle from Area
- silently map historical data to a Vehicle

Workday must identify the actual Vehicle used through generic Life Core relation semantics.

Target semantic relation:

`Workday → uses → Vehicle`

The relation must remain generic Life Core architecture, not a Delivery-only relational model.

Existing generic link kinds such as `about` and `pays` must not be overloaded when they do not express the correct meaning.

Fuel Expense may use an appropriate generic relation such as `about → Vehicle` when semantically correct.

---

## D1.C — Fuel

Fuel truth is **per Vehicle**, not per Area.

### Required behavior

Same Area + Vehicle A + Vehicle B:

- fuel chains must not mix

Same Vehicle across multiple Areas:

- one continuous Vehicle fuel chain

### Fuel purchase data

Fuel purchase is the same shared financial Expense object and may contain:

- date
- Vehicle
- amount
- litres
- odometer
- full / partial fill
- relevant financial and tax context

### Full-to-full calculation

The automatic Vehicle fuel chain must:

- anchor on full fills
- include intermediate partial fills between full fills
- calculate valid derived fuel cost/rate

Useful derived metrics include, when data supports them:

- fuel £/km
- price per litre
- litres / 100 km
- UK MPG

### Unknown fuel truth

A fuel Expense without an unambiguous Vehicle:

- remains financially valid where appropriate
- is excluded from automatic Vehicle fuel-chain calculations
- is never guessed into a Vehicle
- must not silently become zero

If edit/delete of a critical fill makes the current automatic fuel rate unknowable:

- invalidate/remove the current derived cache
- never leave stale fuel truth available to Workday completion or DB logic

Completed Workdays keep their pinned historical fuel basis.

---

## D1.D — Vehicle cost / wear

Vehicle cost / wear per kilometre is **Vehicle-scoped**, not Area-scoped.

Fuel cost and Vehicle wear/running cost are separate concepts.

Do not:

- store Vehicle-derived fuel truth in an Area `running_costs` record
- require a valid fuel rate merely to configure Vehicle wear cost
- infer an old Area cost into a Vehicle without an explicit unambiguous mapping

Rates that change over time must preserve historical semantics through effective dating/versioning or an equivalent safe model.

Completed Workdays pin the rate/basis actually used at completion.

Current legacy Area-based running cost data is drift and must not remain the final Delivery architecture.

---

## D1.E — Shared Expense truth

Delivery expenses use the same financial Expense objects as Money.

Relevant examples:

- fuel
- parking
- tolls
- maintenance
- phone / business cost
- other shift costs
- recurring / coverage-based costs where applicable

A Workday may provide inline UI to add such costs, but persistence must create/link the **same shared Expense object**.

Do not keep a second independent financial truth inside Shift.

### Expense context may independently include

- Area
- Vehicle
- Account when Money provides one
- category
- tax/business-use context
- coverage dates when relevant

Area and Vehicle must be able to coexist independently on the same Expense.

Legacy Shift numeric cost columns may be retained temporarily for safe historical compatibility, but:

- new financial truth must not duplicate them
- ambiguous historical values must not be auto-converted into fabricated Expense rows
- remaining compatibility must be documented

Mutable category sets/labels belong to configuration/data rather than permanent hardcoded product lists, except where a small stable semantic engine primitive is genuinely required.

---

## D1.F — Configurable Platforms

Delivery platforms are configurable records linked to **Company Entities / income sources**.

A new platform must be addable without application code changes.

Permanent hardcoded product logic for:

- Uber Eats
- Deliveroo
- Just Eat
- `other`

is not acceptable as the final model.

### D1 platform data foundation must support

- stable platform identity
- Company Entity relation
- display name / identity from data
- active / inactive state when appropriate
- configurable ordering/display metadata if required
- earning-cycle configuration foundation
- payout/cash-out configuration foundation
- effective-dated/versioned financial rule semantics

The platform configuration model must be capable of representing future D2 requirements:

- earning cycle
- automatic payout schedule
- payout destination reference
- cash-out enabled / disabled
- settlement timing
- fee type
- fee value

D1 does **not** execute payout or cash-out settlement.

Configuration is data, not arbitrary executable code.

Existing legacy `other` earnings must not be guessed into a Company Platform.

---

## D1.G — Configurable Platform Earnings

Target model:

`Workday ↔ Platform ↔ Amount`

Do not preserve permanent platform-specific columns as the final architecture.

Platform earning records need stable identities so future settlement lineage can reference them.

Tips and bonuses may remain Workday-level semantic earning components if that matches the existing product model.

A single earning total engine must drive:

- Workday live summary
- completion validation
- future Delivery Dashboard
- future Performance calculations

Do not duplicate earning formulas.

Existing legacy platform-column history:

- must not be destroyed
- must not be silently remapped when ambiguous
- may require safe compatibility handling

---

## D1.H — Earned / Held / Received foundation

D1 must establish identities and data structure that allow D2 to implement:

`earned/accrued → held/pending → scheduled payout OR cash-out requested → settled/received`

Additional semantic events:

- fee
- adjustment
- reversal

Important invariants:

- platform-held money is **not** a normal user-controlled bank/current Account
- automatic payout and manual cash-out are distinct
- partial cash-out must be representable in D2
- adjustments/reversals must not fabricate bank Transactions
- held balance must ultimately derive from ledger/events, not a fixed number
- settlement must not double-count an earning

D1 must not fake bank balances or implement D2 settlement execution.

---

## D1.I — Completed immutability

Completed historical truth must be protected beyond UI controls.

Normal client/repository/database paths must reject changes that would alter Completed history, including relevant:

- sessions
- Vehicle-used relation
- platform earnings
- odometers
- direct linked Workday financial truth
- pinned fuel basis
- pinned Vehicle cost basis

No hidden repository bypass is acceptable.

---

## D1.J — Historical data safety

Never guess historical mappings.

Specifically:

- old fuel without Vehicle remains unresolved
- old Area running costs are not automatically assigned to a Vehicle
- old `other` platform earnings are not automatically assigned to a Company
- old Completed pinned rates remain historical truth
- no destructive conversion based on "probably"

When migration/backfill is ambiguous:

- preserve the old data
- add compatibility if necessary
- report the unresolved state explicitly

---

# 5. D1 — KNOWN FINDINGS THAT MUST BE ABSORBED

These are part of D1 acceptance, not a separate mini-project.

1. **0700 grants / RLS**
   - authenticated upsert must have the required privileges
   - final RLS/grants must be coherent and tested
   - *Status note (2026-09-06): grant/revoke ordering bug found and fixed in `20260906070000_pin_while_draft.sql` before it was ever live.*

2. **Vehicle currently persists immediately**
   - Vehicle selection must participate in normal Draft save/discard lifecycle
   - Start/Stop remain the only immediate Workday actions
   - *Spot-checked 2026-09-06: `saveWorkday.ts` writes the Vehicle link only on Save/Complete, not on selection — appears already satisfied.*

3. **Vehicle fuel copied into Area running costs**
   - remove this semantic corruption
   - *Status note: addressed by `20260906070000_pin_while_draft` (`vehicle_fuel_rates`, per-Vehicle).*

4. **Stale Vehicle fuel cache**
   - invalidate derived current rate when critical source data makes it unknowable
   - *Status note: `pin_shift_rates()` excludes soft-deleted `vehicle_fuel_rates` rows as of D1.*

5. **Odometer equality**
   - Complete requires `end > start`, not `end >= start`
   - *Spot-checked 2026-09-06: `draftValidate.ts` already enforces `end.value <= start.value` as an error — satisfied.*

6. **Stale Area-based fuel wording in docs**
   - product/state docs must match the actual final semantics
   - *Not independently re-verified in this pass.*

7. **Cost-basis memoization**
   - fix unstable object-identity dependency while the relevant logic is being corrected
   - *Not independently re-verified in this pass.*

---

# 6. D1 — TEST / ACCEPTANCE MATRIX

D1 is accepted only against the frozen contract above.

## Area / configuration boundary

- `Work`, `Gig Work` and `Multi-App Delivery` are represented by Area data/relations, not hardcoded runtime identity.
- Delivery behavior receives the relevant Area through stable ID/link/configuration.
- renaming `Multi-App Delivery` does not break Workday/Delivery behavior.
- renaming `Work` or `Gig Work` does not break Delivery context resolution.
- moving the configured Delivery Area within the Area hierarchy does not cause name/path-based misclassification.
- no repository, action, selector, route decision or calculation identifies Delivery by matching mutable Area names.
- a configured `delivery.work`/equivalent supported capability uses its configured `area_id` (or equivalent stable relation), not a title match.
- unknown/unconfigured Area contexts fail safely rather than falling back to a hardcoded Delivery Area.

## Workday

- Draft Save persists all deferred fields, including Vehicle.
- Discard does not persist Vehicle or other deferred edits.
- Start/Stop remain immediate.
- Completed is read-only in UI.
- Completed mutation paths are rejected below UI.
- Missing date blocks Complete.
- No closed session blocks Complete.
- One open session blocks Complete with correct Stop state.
- Two or more open sessions enter safe repair-required state.
- `end == start` blocks Complete.
- `end < start` blocks Complete.
- zero earnings blocks Complete.
- configurable platform earning > 0 can satisfy earnings requirement.
- tips > 0 can satisfy earnings requirement.
- bonuses > 0 can satisfy earnings requirement.

## Vehicle / Fuel

- same Area + two Vehicles never mixes fuel chains.
- same Vehicle across Areas shares the Vehicle chain.
- Workday with no Vehicle cannot Complete.
- historical unlinked fuel remains unknown/unlinked.
- edit/delete of a critical fill invalidates stale current fuel rate.
- Completed keeps pinned fuel basis.
- Draft uses the current applicable Vehicle fuel basis.
- changing current rate does not rewrite Completed history.

## Vehicle cost

- cost/wear is per Vehicle, not Area.
- fuel and Vehicle wear are independent.
- rate history/effective dating behaves correctly.
- two Vehicles in same Area do not accidentally share Vehicle rate.

## Platforms

- platform records are data-driven.
- arbitrary new platform record works without code changes.
- Company relation ownership is enforced.
- earnings are keyed by platform identity.
- deactivation does not destroy historical earnings.
- rule/config changes do not rewrite historical applicable truth.
- no hardcoded named-platform branch determines core behavior.

## Expenses

- linked Delivery cost is one shared Expense object.
- Area and Vehicle may both exist independently.
- fuel requires Vehicle for automatic Vehicle fuel-chain participation.
- inline Workday cost UX does not create duplicated financial truth.

## Database / RLS

- authenticated owner can perform intended CRUD/upsert.
- cross-owner reads/writes are blocked.
- unique keys have the grants required for intended upsert behavior.
- Completed invariants are enforced at appropriate boundaries.
- new client-editable tables have RLS.
- parser/repository/cache/export/sync paths include new data.
- no UI direct Supabase write path bypasses repository architecture.

---

# 7. D1 — MIGRATION CONSTRAINTS

## 0600

File:

`supabase/migrations/20260906060000_shift_invariants.sql`

Status:

**LIVE** — confirmed by direct read against production (7 Sep 2026): both
unique indexes (`items_one_shift_per_day_area`, `shift_sessions_one_open_per_shift`)
exist on `public`. A `create unique index` cannot succeed over conflicting
existing rows, so the previously-observed 15 simultaneous open
`shift_sessions` on one shift must have already been reduced before this
index was created — the owner decided and ran that data repair separately,
outside any session. See `docs/MIGRATII.md` for the resulting CLI drift
(same shape as 0700/D1 below: not in `supabase_migrations.schema_migrations`,
not idempotent, a future `db push` will try to reapply it and fail).

## 0700

File:

`supabase/migrations/20260906070000_pin_while_draft.sql`

Status:

**LIVE as of 2026-09-06** — applied manually by the owner via the Supabase SQL Editor against the `tasks-calendar` production project, not through `supabase db push`/CLI. See `docs/MIGRATII.md` for the resulting drift (missing from `supabase_migrations.schema_migrations`; a future CLI `db push` would try to reapply it and fail unless repaired first).

Normal migration order still encounters 0600 first for any future CLI-driven push.

## D1 migration (`20260907000000_delivery_data_foundation.sql`)

Status:

**LIVE as of 2026-09-06** — same manual path as 0700, same resulting CLI drift, documented in `docs/MIGRATII.md`.

Before this run, a real bug was found and fixed in this file: the two `shift_earnings` unique indexes were partial (`WHERE ... IS NOT NULL`), which Postgres cannot target from a plain `ON CONFLICT` clause without repeating the predicate — this caused `42P10` in CI (`check:rls`, 6/90 cases), never live. Fixed by making both indexes ordinary (non-partial); standard UNIQUE-NULL semantics already give the required separation.

Any further D1 migration work remains:

- local repo only until explicit approval, for anything not yet run
- data-preserving where possible
- explicit about RLS/grants/ownership
- honest in docs about live/not-live state

A Git push never authorizes a live Supabase migration.

---

# 8. D1 — COMPLETION GATE

Claude completes D1 locally.

Then ChatGPT performs **one full cumulative D1 implementation audit** against this frozen contract.

The audit is:

- baseline / approved parent → new D1 HEAD
- all relevant changed files
- interactions/regressions
- code vs docs claims
- tests vs actual behavior
- migrations/RLS
- historical data safety
- no push / no live Supabase

The audit must report all identified blockers in one pass.

The full D1 audit must explicitly search for Area hardcoding, including:

- `Delivery`, `Multi-App Delivery`, `Gig Work` or `Work` used as mutable-name identity;
- fixed Area-path assumptions;
- selectors/queries that find the Delivery Area by title instead of stable ID/link/configuration;
- routes/actions that silently bind themselves to a named Area;
- schema or migration defaults that turn the PLAN starting map into technical identity.

Literal names are allowed in documentation, user-visible default copy, fixtures, or seed/configuration data when they are not used as runtime identity.

### PASS

If D1 passes:

- D1 status → DONE locally
- Multi-App Delivery remains PARTIAL
- D2 becomes the next implementation stage
- production migration decisions remain separate
- Git push still requires the owner's literal `push`

### FAIL

If D1 fails:

- only actual bugs, regressions, frozen-contract violations, data/security/migration problems, or false test claims are blockers
- new nice-to-have product ideas do not move the acceptance gate
- Claude fixes the reported blockers
- full cumulative D1 is re-audited

Repeated audits must not redefine D2 or D3.

If the implementation fails to converge because of structural contradictions, stop coding and resolve the contradiction instead of inventing an endless stream of small audit rounds.

---

# 9. D2 — PAYOUT / CASH-OUT / SETTLEMENT

**Status: TODO**

D2 begins immediately after D1 is accepted.

## D2 objective

Implement the operational and financial settlement chain that connects Delivery earnings to Money without pretending platform-held money is a bank account.

Target semantic chain:

`earned/accrued → held/pending → scheduled payout OR cash-out requested → settled/received`

Additional event types:

- fee
- adjustment
- reversal

---

## D2.A — Minimum Money dependency

Implement only the Money foundation Delivery actually requires.

### Money Accounts

Accounts are Life Core Resources with explicit ownership/context, including separation where applicable between:

- personal
- self-employed
- company

Platform-held balance is **not** a Money Account.

### Money Transactions

Settlement into a real controlled Account creates or links the received Money Transaction exactly once.

Do not create duplicate income just because the same earning moves from held to received.

D2 does not require building the entire budgets/bills/debts product.

---

## D2.B — Platform settlement configuration

Use the effective platform rules established by D1.

Support:

- earning cycle
- automatic payout schedule
- payout destination Account/reference
- cash-out enabled/disabled
- cash-out settlement timing
- fee type
- fee value
- effective dates/version history

Schedules and settlement timing must be interpreted deterministically using an explicit/app timezone policy, not silently server UTC.

---

## D2.C — Held balance

Held/pending balance is derived operational state from earning and settlement events.

It is not:

- a manually maintained fake balance
- a bank/current Account
- a second income truth

The system must distinguish:

- earned
- held
- scheduled
- cash-out requested
- settled / received

---

## D2.D — Automatic payout

Automatic scheduled payout is a distinct settlement path.

It must preserve lineage from:

- platform
- earnings
- payout event
- received Money Transaction

Do not double-count income.

---

## D2.E — Cash-out

Cash-out is separate from automatic payout.

Support:

- enabled/disabled by platform rule
- partial cash-out
- settlement timing
- explicit fee
- correct held-balance reduction
- received Transaction linkage

Do not assume one universal cash-out fee behavior.

The effective platform configuration decides the rule.

---

## D2.F — Fees / Adjustments / Reversals

Model explicitly:

- cash-out/payout fees
- platform adjustments
- reversals

A reversal/adjustment must not fabricate a bank Transaction unless real money actually moved into/out of a controlled Account.

---

## D2 acceptance

D2 is accepted when:

- earning → held lineage is stable
- scheduled payout works semantically
- cash-out works semantically
- partial settlement is supported
- fee semantics are explicit
- settlement into controlled Account is represented exactly once
- held money is not modeled as a fake Account
- adjustments/reversals do not fabricate settlement
- historical platform rules are preserved
- RLS/repository/data integrity are complete
- D3 can consume these records without redesigning them

After D2:

- D1 → DONE
- D2 → DONE
- D3 → TODO / next
- Multi-App Delivery remains PARTIAL

---

# 10. D3 — FINAL DELIVERY EXPERIENCE

**Status: TODO**

D3 begins after D2 is accepted.

D3 builds the user-facing Delivery experience over the stable D1 + D2 model.

It must not create duplicate calculation engines or duplicate financial truth.

---

## D3.A — Dashboard

Useful ranges:

- today
- week
- month
- tax year
- custom

Show only metrics supported by real underlying data.

Useful Delivery metrics include:

- earned
- held
- received
- hours
- business/work km
- business/work miles
- platform breakdown
- gross/hour
- gross/km
- gross/mile
- fuel estimate
- Vehicle cost estimate
- direct expenses
- allocated/coverage expenses where valid
- profit
- Tax/NI preview where known
- a truthful "roughly yours" concept where the shared Money/Tax engine supports it

Do not fabricate old concepts such as "Available for Debt" as Delivery truth.

Tax preview may appear in Delivery, but HMRC/Tax configuration remains owned by Money → Tax.

---

## D3.B — Shifts / Workday history

History should use the D1 Workday truth.

Useful filters include:

- date/range
- Vehicle
- Draft / Completed
- platform
- earnings

Completed history shows historical pinned inputs, not current configuration substituted into old Workdays.

---

## D3.C — Platforms

Platforms experience should expose the configurable platform records established in D1 plus D2 settlement state.

Useful information may include:

- platform identity / Company
- active state
- earning cycle
- payout configuration
- cash-out configuration
- held amount
- scheduled payout
- received amount/history

Do not hardcode platform names/order/rules into the UI product model.

---

## D3.D — Earnings

Earnings experience uses the shared earning records.

Useful views:

- by Workday
- by platform
- by status
- by settlement lineage

The same earnings must not be recreated separately for Dashboard, Money or settlement.

---

## D3.E — Expenses

Delivery Expense experience uses shared Expense objects.

Useful filters:

- date/range
- Vehicle
- category
- Area
- coverage period when relevant

A Delivery expense is still the same underlying Expense that Money / Vehicle / Tax may display.

---

## D3.F — Fuel / Vehicle usage views

Delivery may show operational Vehicle data without taking ownership of Vehicle administration.

Fuel history may support:

- Vehicle
- date range
- full-tank filter

Useful derived metrics:

- fuel £/km
- litres/100km
- UK MPG
- relevant Vehicle usage/work-distance metrics

Vehicle master-data editing remains outside Delivery.

---

## D3.G — Performance

Performance uses the same calculation engines as Workday and Dashboard.

No duplicate formulas.

Useful dimensions may include:

- time
- Vehicle
- platform
- Workday
- revenue/profit efficiency
- km/mile efficiency

Only metrics backed by actual data are displayed.

---

## D3 acceptance

D3 is accepted when:

- Dashboard is based on D1/D2 truth
- Shifts history works over the final Workday model
- Platforms are data-driven
- Earnings show real lineage
- Expenses reuse shared financial objects
- Fuel/Vehicle views reuse shared Vehicle/fuel truth
- Performance reuses shared calculation engines
- no duplicate financial truth exists
- no hardcoded platform architecture returns
- Tax remains Money-owned
- Vehicle administration remains Vehicle-owned
- Delivery product criteria in PLAN/PROGRESS can truthfully be evaluated for DONE

---

# 11. OLD DELIVERY HUB REFERENCE — KEEP / ADAPT / REJECT

The old `Delivery Hub Manager 12(1).json` is a functional/UX/calculation reference only.

Do not port its architecture or Zite-specific storage design.

## Keep / adapt

- Workday
- WorkPeriods → Work sessions
- Draft / Completed history semantics
- Vehicle used on Workday
- Fuel purchases
- full-to-full fuel chain
- Car Expenses → shared Expense
- Dashboard concepts that are still truthful
- Workday History
- fuel history
- MPG / litres-per-100-km metrics
- useful filtering patterns

## Move to shared Life CC ownership

- VehiclesPage → Directory / Vehicles
- Tax / NI → Money / Tax
- financial Expenses → Money shared objects

## Remove / reject as target architecture

- hardcoded Uber / Deliveroo / Just Eat product columns
- flat manual Tax/NI configuration
- manual fuel-cost override as truth
- Area confused with Vehicle
- Vehicle reserve confused with actual Vehicle cost
- `amount transferred to debt`
- fabricated `available for debt`
- Delivery-owned Audit/Admin/Repair product pages
- Zite table/application architecture

Old reference features are evaluated by Life CC principles, not copied automatically.

---

# 12. NON-GOALS FOR THIS DELIVERY BACKLOG

The following are not required to close D1-D3 unless separately approved:

- full Money budgets
- full bills/debt system
- Employment module
- ACHU module
- Health
- full Documents system
- bank integrations
- platform scraping/API automation
- GPS/map tracking
- AI dependency
- fake platform-held bank Accounts
- manual fuel-rate override

Do not allow these to expand the acceptance gate.

---

# 13. DELIVERY DATA-INTEGRITY RULES

These apply across D1-D3.

- `Area` instances and their hierarchy are data; mutable Area names/path labels are never technical domain identity.
- Code may provide supported capabilities/engines, but the Area instance they operate on is supplied through stable data/configuration.
- Unknown is not zero.
- One fact is entered once.
- Same Expense is reused across contexts.
- Area and Vehicle are independent.
- Platform is configurable data.
- Mutable rules are versioned/effective-dated.
- Completed historical truth is pinned.
- Historical ambiguity is not guessed away.
- New client-editable tables require correct RLS/ownership.
- UI must not bypass repositories with direct Supabase mutation.
- settlement must not double-count earnings.
- platform-held money is not a bank Account.
- work session anomalies fail safe.
- production data repair requires explicit owner approval.
- Git push never authorizes live Supabase changes.

---

# 14. WORKFLOW / ACCEPTANCE RULES

## PLAN precedence

Before planning or implementing a new Delivery stage, read current `main` `docs/PLAN.md`.

This backlog must specialize and sequence PLAN; it may not silently redefine PLAN.

If code, this backlog, or a local implementation implies that `Multi-App Delivery` is a hardcoded Area/module identity while PLAN treats the user's Area structure as data/configuration, that implementation/backlog statement is wrong and must be corrected.

## Roles

### Owner

The owner controls:

- product decisions
- literal `push` authorization
- separate live Supabase approval
- decisions about ambiguous production data

### ChatGPT

ChatGPT:

- plans
- freezes acceptance contracts
- performs full implementation audits
- determines PASS/FAIL against the frozen contract
- does not add new nice-to-have blockers during audit
- verifies remote SHA / CI / Vercel after an authorized push

### Claude

Claude:

- implements code
- self-audits
- commits locally on `main`
- does **not** push until the owner explicitly authorizes it
- returns full cumulative diff and test metadata

---

## Full audit rule

Every new implementation HEAD is treated as a release candidate.

Audit the **complete relevant cumulative implementation diff**, not only the latest fix patch.

A blocker must be one of:

- actual bug
- regression
- frozen-contract violation
- data-integrity problem
- security/RLS problem
- migration problem
- false or unsupported test/implementation claim

A new nice-to-have product idea is backlog material, not a blocker for an already frozen stage.

---

## Push rule

Only the owner's literal message:

`push`

authorizes one push.

Permission is single-use.

After push:

1. verify `origin/main` SHA
2. verify GitHub CI
3. verify Vercel production deployment
4. do not call the release complete merely because Vercel is READY if CI is not green

---

## Supabase rule

Live Supabase mutation requires separate explicit owner approval.

A Git push never authorizes:

- applying migrations
- cleaning data
- modifying the 15 ambiguous sessions
- manipulating migration history

---

# 15. BACKLOG MAINTENANCE RULE

This file must remain useful, not become a diary.

When a stage changes:

- update its status
- record only concise acceptance outcome
- leave future stages intact
- do not paste audit storytelling into this file
- keep implementation truth synchronized with PLAN / PROGRESS / STAREA

Recommended status values:

- TODO
- IN PROGRESS
- BLOCKED
- AUDIT
- DONE

If a legitimate future Delivery requirement is approved after this freeze:

- add it explicitly to the appropriate phase or a clearly named future backlog section
- do not silently change acceptance criteria during an audit

---

# 16. ARCHIVE RULE

Do not delete this backlog when Delivery is complete.

After:

- D1 = DONE
- D2 = DONE
- D3 = DONE
- final Delivery completion review = PASS
- required production state is verified

move this file from its active location to:

`docs/archive/DELIVERY_MASTER_BACKLOG_<completion-date>.md`

Then ensure current truth remains reflected in:

- `docs/PLAN.md`
- `docs/PROGRESS.md`
- `docs/STAREA.md`
- `docs/MIGRATII.md`

The archived file becomes historical evidence of the implementation contract and sequence, not the current roadmap.

---

# 17. CURRENT SNAPSHOT

At creation of this backlog (2026-09-06):

- production / approved baseline previously verified:
  `2526b5e9be8ca9442349dc2a2e9a4e6afd510b16`
- Phase 1B was already closed before this Delivery freeze
- the Multi-App Delivery Area/domain work is PARTIAL
- D1 implementation is currently being worked on locally by Claude
- the configured Area hierarchy is data; no current D1 work is accepted if it relies on Area-name/path hardcoding
- D2 has not started
- D3 has not started
- migration `0600` is NOT LIVE
- migration `0700` is NOT LIVE
- the 15 ambiguous production open-session rows must remain untouched without separate explicit owner approval
- no current D1 local work is authorized for push merely by the existence of this document

**Update (2026-09-06, later the same day):**

- migration `0700` (`pin_while_draft`) is now **LIVE** — applied manually by the owner via Supabase SQL Editor against `tasks-calendar`. Not run through CLI; see `docs/MIGRATII.md` for the resulting drift.
- the D1 migration (`delivery_data_foundation`) is now **LIVE** — same manual path, same drift, documented in `docs/MIGRATII.md`. A real `ON CONFLICT`/partial-index bug in `shift_earnings` was found and fixed in the file before this run.
- migration `0600` remains **NOT LIVE**, untouched, for the same reason (15 ambiguous open sessions).
- the ChatGPT full-cumulative D1 audit described in Section 8 has **not** happened yet — D1 stays IN PROGRESS, not DONE, until it does.
- still no push: `origin/main` has not received today's two commits (migration fix + doc updates) — that still requires the owner's literal `push`.

**Update (2026-09-07):**

- migration `0600` (`shift_invariants`) is now confirmed **LIVE** — both
  unique indexes exist on production, verified directly by the owner. The
  15 ambiguous open-session rows were necessarily resolved before that index
  could be created; the owner ran that data repair separately, outside any
  session. Same manual-run CLI drift as `0700`/D1 above, documented in
  `docs/MIGRATII.md`.
- a second D1 audit (after the six migrations from Section 8's first audit)
  found four more real issues, three fixed this session: Completed Workday
  immutability now also covers a linked road-cost Expense (trigger on
  `expenses`, plus the `links` guard widened to check both link ends);
  `save_workday()` now validates every id in its payload against the
  Workday actually being saved, not just against `owner`; `platform_rules`
  gained `payout_destination_reference`. Save draft/Complete Workday's item
  patch (title/date/Area) landing outside the atomic `save_workday` RPC was
  left open here, by the owner's own choice — since fixed, see below.
- the two migrations above (`20260907070000_completed_expense_guard_and_scoped_save`,
  `20260907080000_platform_rules_payout_destination`) are now **LIVE** —
  run manually by the owner via the Supabase SQL Editor, same day. Same CLI
  drift as every other manually-run migration above.
- a third D1 audit (same day) found 5 more HIGH + 2 MEDIUM issues, all
  fixed: legacy platforms (Uber Eats/Deliveroo/Just Eat/Other) no longer
  offered for a fresh Draft, only once a real earning already exists on one;
  a configurable Platform's invalid earning is now validated the same as a
  legacy one, instead of silently dropped; Completed immutability now also
  covers the Workday's own `items` anchor (title/due/area_id/state/kind),
  not just its children tables; a sync failure after `save_workday` already
  committed is now `SyncPending` (soft success), not a plain error; the item
  patch itself moved inside the `save_workday` transaction with its own
  `expected_version` check — Save Workday is now atomic as one action, the
  gap left open two bullets above; a legacy road-cost field with no linked
  Expense can now actually be cleared (writes a real £0 Expense over it,
  never the frozen legacy column); two doc contradictions (0600's status in
  STAREA.md, the Platform foundation's live status in PROGRESS.md) fixed.
  The two migrations above
  (`20260907090000_completed_item_anchor_guard`,
  `20260907100000_atomic_item_patch`) are now **LIVE** — run manually by
  the owner via the Supabase SQL Editor, same day. Same CLI drift as every
  other manually-run migration above.
- committed on `main`, not pushed — still requires the owner's literal
  `push`.

**Update (2026-09-07, third D1 audit round):**

- a third cumulative D1 audit found several more real issues, fixed this
  session: `isTaskable()` (`src/repository/filters.ts`) now also excludes
  `kind === 'platform'`, so a configurable Platform's anchor stops showing up
  in task-oriented lists; a new `workdayDayOf()` (`src/shifts/draft.ts`)
  resolves the day a Vehicle's cost basis should actually price against
  (`draft.due`, else the persisted `item.due`, else today) instead of always
  using today, even for a retrospective Draft; reactivating an invalidated
  `vehicle_fuel_rates` row via `saveVehicleFuelRate` no longer silently fails
  (it now clears `deleted_at` explicitly, and a missing `insert (deleted_at)`
  grant is added); `save_workday()`'s existing-road-cost-Expense branch now
  updates the Expense's own `due` on every write (not only at creation), so a
  moved Workday date no longer leaves a linked parking/tolls/other Expense
  dated on the old day; recording a new configurable Platform is now one
  atomic RPC (`record_platform`) instead of two separate inserts that could
  leave an orphan `items` row; `save_workday()` now explicitly checks that
  `payload.item_id` names a `kind='shift'` item and that `vehicle_link_to`
  names a real Vehicle Entity, refused with `42501` otherwise. Four new
  migrations: `20260907110000_vehicle_fuel_rate_reactivation`,
  `20260907120000_road_cost_expense_day_tracks_workday`,
  `20260907130000_record_platform_rpc`, `20260907140000_save_workday_kind_guards`
  — all **NOT LIVE**, not yet run by the owner.
- also fixed, application code only (no migration): Money/Tax
  (`periodMoney`/`currentYearMoney`/`sliceOfYear`/`sliceFor`) no longer
  double-counts a road-cost category Expense already folded into a shift's
  own `directCostsPence`; a soft-deleted item's `links` rows no longer show
  up as a resolvable-but-stale neighbour in the generic "Joined to" UI
  (`liveNeighboursOf`, read-layer filter — no DB-level cascade-delete on
  `links`, deliberately, to avoid conflicting with the round-2 guarantee that
  a Completed Workday can still be soft-deleted).
- investigated and confirmed not a real bug: `done_at`/`waiting_since` are
  technically writable on a Completed shift item (the anchor guard only
  checks title/due/area_id/state/kind), but neither is ever read or written
  anywhere in the shift/Workday code path — an inert column, not a live bug.
- verified mechanically: local Postgres rebuilt from every migration file in
  order (0 errors); full RLS suite 109/109 cases green (including new cases
  in `scripts/lib/rls-record-platform.mjs` and
  `scripts/lib/rls-save-workday-guards.mjs`); `npm run check`
  (lint/typecheck/672 unit tests/build/structure/reachable/drops) fully
  green.
- still committed on `main` only where applicable, still no push authorized;
  the four new migrations above remain unapplied on live pending the
  owner's own decision.

---

# 18. NEXT ACTION

Current next action:

**Finish D1 locally → full D1 audit against this document → fix only real D1 blockers if any → D1 PASS.**

After D1 PASS:

**D2 — Payout / Cash-out / Settlement + minimum Money dependency**

After D2 PASS:

**D3 — Final Delivery Experience**

After D3 PASS:

**Delivery completion review → update source-of-truth docs → archive this backlog.**
