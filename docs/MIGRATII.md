# Migrațiile — ledger pentru baza live

Documentul ăsta ține un singur lucru: **ce este declarat ca aplicat pe baza
live și ce drift este cunoscut**.

Nu ține istoria dezvoltării și nu repetă conținutul SQL-ului. Fișierele din
`supabase/migrations/` sunt sursa tehnică pentru ce face fiecare migrație.

## Reguli

- O migrație aflată în repo nu înseamnă automat că a fost rulată pe live.
- O schimbare care **adaugă** structură trebuie să existe pe bază înainte ca
  producția să depindă de ea.
- O schimbare care **șterge** structură trebuie făcută numai după ce producția
  nu o mai folosește.
- Nu presupune că o migrație este atomică. `BEGIN`/`COMMIT` există numai dacă
  sunt scrise efectiv în fișierul SQL.
- Nu inventa o migrație nouă doar pentru a „da înapoi” una deja aplicată.
- Până când există automatizare explicită pentru live, proprietarul decide
  când se aplică SQL-ul de producție.

## Declarate ca aplicate pe live

| Migrație | Rol | Declarată aplicată |
|---|---|---|
| `20260904181500_items` | `items`, coloana vertebrală | 4 sep 2026 |
| `20260904231100_items_owner_cascade` | owner cascade | 4 sep 2026 |
| `20260905010137_items_insert_columns` | permisiuni INSERT pe coloane | 5 sep 2026 |
| `20260905073000_areas` | `areas` + `items.area_id` | 5 sep 2026 |
| `20260905090000_shifts` | shifts / sessions / earnings | 5 sep 2026 |
| `20260905100000_reserves` | reserves / running costs | 5 sep 2026 |
| `20260905110000_expenses` | expenses | 5 sep 2026 |
| `20260905120000_hmrc` | tax years / HMRC | 5 sep 2026 |
| `20260905130000_business_use` | business use / personal km | 5 sep 2026 |
| `20260905140000_class2` | Class 2 | 5 sep 2026 |
| `20260905150000_when` | payments on account / dates | 5 sep 2026 |
| `20260905160000_one_answer` | elimină modelul vechi de reserves din schema țintă | 5 sep 2026 |
| `20260905170000_upsert_keys` | chei/upsert + trigger protection | 5 sep 2026 |
| `20260905180000_entities_and_links` | `entities` + `links`, Life Core | 5 sep 2026 |
| `20260905190000_from_the_reference` | câmpuri adoptate din aplicația de referință | 5 sep 2026 |
| `20260905200000_waiting` | `items.waiting_since` + update grant | 6 sep 2026 |
| `20260906000000_journal` | `journal_entries` + `items.kind='journal'` | 6 sep 2026 |
| `20260906050000_quick_actions` | tabelul `quick_actions` | 6 sep 2026 |
| `20260906060000_shift_invariants` | cele două indexuri unice — o singură tură vie pe zi/Arie, o singură sesiune deschisă | dată de rulare necunoscută, confirmată aplicată live prin verificare directă 7 sep 2026 (manual, vezi drift) |
| `20260906070000_pin_while_draft` | `vehicle_fuel_rates` + `pin_shift_rates()` re-derivă rata de combustibil după Vehicul | 6 sep 2026 (manual, vezi drift) |
| `20260907000000_delivery_data_foundation` | `vehicle_cost_rates`, `platforms`, imutabilitate Completed, `shift_earnings.platform_item_id` | 6 sep 2026 (manual, vezi drift) |
| `20260907010000_workday_vehicle_uses_link` | `links_kind` + `uses`; `pin_shift_rates()` rezolvă Vehiculul doar prin `uses` | 7 sep 2026 (manual, vezi drift) |
| `20260907020000_road_cost_expenses` | `expenses_category` extinsă cu `parking`/`tolls` | 7 sep 2026 (manual, vezi drift) |
| `20260907030000_platform_rules` | tabelul `platform_rules` (effective-dated); scoate cele 7 coloane de regulă din `platforms` | 7 sep 2026 (manual, vezi drift) |
| `20260907040000_platform_item_kind` | trigger `require_item_kind()` pe `shift_earnings`/`platform_rules` | 7 sep 2026 (manual, vezi drift) |
| `20260907050000_pin_rate_by_workday_date` | `pin_shift_rates()` pinuiește după `items.due`, nu după `now()` | 7 sep 2026 (manual, vezi drift) |
| `20260907060000_save_workday_rpc` | funcția `save_workday(payload jsonb)` — RPC atomic pentru Save draft/Complete Workday | 7 sep 2026 (manual, vezi drift) |

Aceasta este evidența documentată, nu o verificare live făcută automat de
fișierul acesta.

### Notă despre versiunea din istoricul live pentru `quick_actions`

Istoricul de migrații Supabase înregistrează această migrație ca
`version = 20260906075956`, `name = quick_actions` — un timestamp diferit de
prefixul `20260906050000` din numele fișierului din repo. Corespondența este
verificată din înregistrarea de migrații live însăși, nu doar afirmată:
rândul de mai sus se referă la
`supabase/migrations/20260906050000_quick_actions.sql`, singura migrație din
repo cu numele `quick_actions`. Diferența de timestamp vine din ora la care
fișierul a fost efectiv rulat pe live față de ora din numele lui în repo —
nu este drift de schemă și nu schimbă ce face migrația.

`20260906060000_shift_invariants` **este acum aplicată live** — confirmat
direct (7 sep 2026): ambele indexuri unice (`items_one_shift_per_day_area`,
`shift_sessions_one_open_per_shift`) există pe `public`. Existența lor
dovedește că cele cincisprezece rânduri `shift_sessions` cu `ended_at IS NULL`
simultan pe aceeași tură (blocajul cunoscut, vezi `docs/STAREA.md`) au fost
deja reduse înainte ca indexul să fi putut fi creat — reparația de date a
fost decisă și rulată de proprietar, în afara acestei sesiuni.

`20260906070000_pin_while_draft` este acum în tabelul de mai sus, aplicată
manual pe live (vezi drift mai jos pentru cum anume). Rescrie
`pin_shift_rates()` (funcție deja existentă din
`20260905100000_reserves`/`20260905160000_one_answer`) ca să repinuiască rata
de cost a unui Workday încă Draft la fiecare scriere, în loc s-o lase înghețată
din prima scriere — comportamentul pentru un Workday Completed rămâne exact cel
de dinainte. Adaugă și tabelul `vehicle_fuel_rates`: rata de combustibil se
citește acum după Vehiculul legat de Workday (via `links`/`entities`), nu după
Aria lui. La momentul acestei migrații, `rate_vehicle_per_km` (uzura) rămăsese
încă citită din `running_costs` după Arie — corectat de migrația D1 de mai jos.
Un audit ulterior a mai găsit și reparat o greșeală de ordine `grant`/`revoke`
pe `vehicle_fuel_rates` din acest fișier (`revoke all` rula după un `grant`
țintit și îl ștergea silențios); fișierul a fost rescris pe loc **înainte** de
rularea manuală de mai jos, deci versiunea rulată pe live este cea corectată.

`20260907000000_delivery_data_foundation` este acum în tabelul de mai sus,
aplicată manual pe live (vezi drift mai jos). Adaugă `vehicle_cost_rates`
(istoricul de cost pe km al unui Vehicul, înlocuind `running_costs` pentru
acest rol — vezi corecția de mai sus), imutabilitate Completed impusă prin
trigger-e noi pe `shifts`/`shift_sessions`/`shift_earnings`/`links`
(independent de `shift_invariants`), tabelul `platforms` (fundație de date,
neconectat încă în UI-ul de Earnings) și o extindere a `shift_earnings` (id
surogat, `platform_item_id` opțional alături de enumul `platform` existent,
fără să-l înlocuiască). Vezi `docs/STAREA.md`, secțiunea „Migrație nouă (D1)”,
pentru detalii.

**Bug reparat înainte de rularea live, niciodată live cu el.** Cele două
indexuri unice de la pasul 5 (`shift_earnings_legacy_platform_unique`,
`shift_earnings_platform_item_unique`) erau scrise inițial ca indexuri
parțiale (`where platform is not null` / `where platform_item_id is not
null`). Postgres nu poate ținti un index parțial dintr-un `ON CONFLICT` fără
să repete predicatul acolo, iar `.upsert(..., { onConflict: 'item_id,platform'
})` din cod nu face asta — eroare `42P10`, prinsă de `check:rls` în CI
(6 din 90 cazuri picate), niciodată live. Fișierul a fost rescris pe loc
**înainte** de rularea manuală de mai jos: indexurile sunt acum obișnuite
(fără `where`), ceea ce e suficient — semantica NULL standard a UNIQUE deja
separă un rând legacy (`platform` setat) de unul cu `platform_item_id`
(reciproc), fără predicat.

**`0600` (`shift_invariants`) este acum aplicată live**, separat de toate
astea — vezi mai sus. Incidentul cu 15 rânduri `shift_sessions` simultan
deschise (`docs/STAREA.md`) a fost rezolvat de proprietar înainte ca indexul
să poată fi creat; nimic din reparația de date sau rularea lui `0600` nu s-a
făcut în această sesiune.

`20260907010000_workday_vehicle_uses_link`, `20260907020000_road_cost_expenses`,
`20260907030000_platform_rules`, `20260907040000_platform_item_kind`,
`20260907050000_pin_rate_by_workday_date` și `20260907060000_save_workday_rpc`
sunt acum în tabelul de mai sus, aplicate manual pe live (vezi drift mai jos).
Toate șase sunt reparațiile de audit D1 descrise în `docs/STAREA.md`, secțiunea
„Audit D1 (ChatGPT)”:

- `uses` ca link kind propriu pentru relația Workday→Vehicul, în loc de
  `about`-ul generic folosit și de un fuel Expense;
- `parking`/`tolls` adăugate la enumul de categorii al `expenses`, ca aceste
  costuri să poată deveni Expense-uri reale (coloanele vechi de pe `shifts`
  rămân neatinse — vezi `docs/STAREA.md` pentru regula dual-path);
- tabelul nou `platform_rules` (effective-dated, ca la `vehicle_cost_rates`)
  și cele 7 coloane de regulă scoase din `platforms`;
- trigger-ul `require_item_kind()`, care leagă `platform_item_id` de un item
  chiar de kind `platform`, nu doar de același owner;
- `pin_shift_rates()` rescrisă să pinuiască rata de cost după `items.due` al
  turei, nu după `now()`;
- funcția `save_workday(payload jsonb)`, un RPC apelat o singură dată în locul
  secvenței de până la nouă scrieri separate ale Save draft/Complete Workday.

Fără date live de migrat pentru niciuna dintre ele.

`20260907070000_completed_expense_guard_and_scoped_save` și
`20260907080000_platform_rules_payout_destination` **nu sunt aplicate live** —
scrise după cele șase de mai sus, ca reparație la un audit D1 ulterior:

- gardă nouă, la nivel de trigger, pe `expenses`: un Expense de cost-de-drum
  legat `about` de un Workday Completed nu mai poate fi modificat/șters prin
  nicio cale (inclusiv un ecran general de Expenses, nu doar prin sheet-ul
  Workday-ului) — același principiu deja aplicat pe `shifts`/`shift_sessions`/
  `shift_earnings`/`links`, extins acum și la Expense-ul legat;
- garda de pe `links` (`reject_link_change_on_completed_shift`) verifică acum
  ambele capete ale legăturii, nu doar `from_id` — o legătură `about` cu tura
  la `to_id` (cazul Expense-urilor de drum) era neacoperită înainte;
- `save_workday()` verifică acum că fiecare id din payload (link de Vehicul,
  sesiune, Expense existent) chiar aparține Workday-ului salvat, nu doar
  aceluiași owner — un payload care numește un id real, dar al altui Draft al
  aceluiași om, este ignorat (link/sesiune) sau refuzat explicit (Expense),
  nu mai aplicat orbește;
- `platform_rules` primește coloana `payout_destination_reference` (text
  simplu, ca `cashout_settlement`) — fundația de date nu putea reprezenta deloc
  o referință de destinație a payout-ului, deși `docs/PLAN.md` o cere explicit
  în lista de câmpuri ale unei Platforme.

Verificat mecanic: toate migrațiile (inclusiv acestea două) aplicate în ordine
pe un Postgres 16 local construit manual (fără Docker în acest sandbox, schemă
`auth` minimală); `check:rls` — 100/100 cazuri, incluzând patru cazuri noi
pentru exact aceste reparații; lint/typecheck/659 teste/build/structure/
reachable/drops — toate verzi.

## Schimbări manuale declarate

### 5 septembrie 2026 — cron vechi eliminat

A fost declarat eliminat manual:

- jobul `send-push-alarms-every-minute`;
- tabelul `private.push_config`.

Motivul: trimiteau către o Edge Function care nu mai exista și nu mai erau
folosite de codul curent.

## Drift cunoscut

### `20260906060000_shift_invariants` — rulată manual, nu prin CLI

Confirmată aplicată live prin verificare directă (7 sep 2026, vezi mai sus),
nu prin `supabase db push`/CLI. Același drift ca celelalte migrații manuale
de mai jos:

- **nu apare** în `supabase_migrations.schema_migrations` — din perspectiva
  CLI-ului, migrația este încă „neaplicată”;
- fișierul n-are `if not exists` pe niciunul din cele două `create unique
  index` — un `db push` viitor, în ordinea normală a fișierelor, va încerca
  s-o reaplice și va eșua (`relation "items_one_shift_per_day_area" already
  exists` / echivalent pe celălalt index).

Aceeași remediere ca mai jos rămâne necesară înainte de orice `db push`
viitor. Nu s-a făcut aici.

### `20260906070000_pin_while_draft` — rulată manual, nu prin CLI

Migrația a fost rulată direct din SQL Editor Supabase pe proiectul de
producție (`tasks-calendar`), nu prin `supabase db push`/CLI. Consecințe
confirmate, nu ipotetice:

- **nu apare** în `supabase_migrations.schema_migrations` — din perspectiva
  CLI-ului, migrația este încă „neaplicată”;
- fișierul nu are `if not exists` pe `create table public.vehicle_fuel_rates`
  și nu are `or replace` pe `create trigger` — o rulare viitoare prin
  `supabase db push`, în ordinea normală a fișierelor, va încerca s-o
  reaplice și va eșua (`relation "vehicle_fuel_rates" already exists` /
  eroare echivalentă pe trigger);
- ordinea standard de migrații (vezi paragraful de mai jos) pune
  `20260906060000_shift_invariants` înaintea acesteia; acel fișier este acum
  aplicat live, dar cu același drift CLI (vezi subsecțiunea lui, mai sus) —
  un `db push` viitor tot va eșua întâi pe `0600` (aceleași indexuri deja
  existente), apoi, dacă acela s-ar rezolva, pe aceasta.

Înainte de orice `supabase db push` viitor, cineva trebuie fie să marcheze
această migrație ca aplicată în istoricul CLI (`supabase migration repair`
sau echivalent), fie să adapteze fișierul să fie idempotent. Nu s-a făcut
niciuna dintre astea aici — doar constatarea.

### `20260907000000_delivery_data_foundation` — rulată manual, nu prin CLI

Același drift ca mai sus, pentru aceleași motive:

- rulată din SQL Editor Supabase pe `tasks-calendar`, nu prin `supabase db
  push`/CLI — **nu apare** în `supabase_migrations.schema_migrations`;
- fișierul n-are `if not exists`/`or replace` pe niciuna dintre structurile
  noi (`vehicle_cost_rates`, `platforms`, coloanele/indexurile adăugate pe
  `shift_earnings`, funcțiile și trigger-ele de imutabilitate Completed) — un
  `db push` viitor, în ordinea normală a fișierelor, va încerca s-o reaplice
  și va eșua;
- ordinea standard de migrații pune `0600` (`shift_invariants`, aplicată live
  acum, dar cu același drift CLI) înaintea acesteia — un `db push` viitor tot
  va eșua întâi pe `0600`, apoi pe aceasta.

Aceeași remediere ca mai sus rămâne necesară înainte de orice `db push`
viitor: `supabase migration repair` (sau echivalent) pe toate trei, sau
fișiere idempotente. Nu s-a făcut aici.

### `20260907010000` - `20260907060000` — rulate manual, nu prin CLI

Același drift, pentru aceleași motive, pe toate șase migrațiile de audit D1
rulate pe 7 sep 2026:

- rulate din SQL Editor Supabase pe `tasks-calendar`, nu prin `supabase db
  push`/CLI — **nu apar** în `supabase_migrations.schema_migrations`;
- majoritatea instrucțiunilor lor nu sunt idempotente (`alter table ... drop
  constraint`/`add constraint` fără `if exists`, `create table
  public.platform_rules` fără `if not exists`, `create function
  require_item_kind()`/`create trigger ..._platform_kind` fără `or replace`)
  — un `db push` viitor, în ordinea normală a fișierelor, va încerca să le
  reaplice și va eșua pe cel puțin una dintre ele;
- ordinea standard de migrații pune `0600` (`shift_invariants`, aplicată live
  acum, cu același drift CLI) și cele două de mai sus înaintea tuturor — un
  `db push` viitor eșuează mai întâi acolo, indiferent dacă se ajunge sau nu
  la acestea.

Aceeași remediere ca mai sus rămâne necesară înainte de orice `db push`
viitor, pe toate cele nouă migrații rulate manual până acum (`0600`, cele
două de mai sus, plus aceste șase). Nu s-a făcut aici.

### `reserves`

`20260905160000_one_answer` descrie schema țintă fără `reserves`, dar tabelul a
fost recreat manual temporar după un incident de ordine între SQL și cod.

Conform evidenței existente:

- codul curent nu îl mai folosește;
- tabelul poate exista încă pe live;
- acesta este drift, nu o nouă cerință de produs.

Înainte de orice curățare pe live se verifică starea reală a bazei. Nu se
presupune din documentație că tabelul există sau lipsește.

## Cum se actualizează ledger-ul

Se modifică numai când proprietarul confirmă o schimbare reală pe live sau
când o verificare directă a live-ului o dovedește.

Nu se actualizează doar pentru că a fost creat un fișier nou de migrație.
Nu se adaugă povestea incidentului; aceea aparține istoricului, nu ledger-ului.
