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
| `20260906070000_pin_while_draft` | `vehicle_fuel_rates` + `pin_shift_rates()` re-derivă rata de combustibil după Vehicul | 6 sep 2026 (manual, vezi drift) |
| `20260907000000_delivery_data_foundation` | `vehicle_cost_rates`, `platforms`, imutabilitate Completed, `shift_earnings.platform_item_id` | 6 sep 2026 (manual, vezi drift) |

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

`20260906060000_shift_invariants` **nu** este aplicată live și nu apare în
tabelul de mai sus. Vezi `docs/STAREA.md` pentru motivul blocajului.

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

**`0600` (`shift_invariants`) rămâne neaplicată live**, separat de toate
astea. Codul Workday poate fi logic independent de invariantele din
`20260906060000_shift_invariants`, dar fișierul ei tot n-a fost rulat —
blocată de incidentul live cunoscut cu 15 rânduri `shift_sessions` simultan
deschise (vezi `docs/STAREA.md`). Repararea celor 15 sesiuni și aplicarea lui
`0600` rămân decizii separate, explicite, ale proprietarului — nu s-a făcut
nimic din astea aici.

`20260907010000_workday_vehicle_uses_link` **nu** este aplicată live și nu
apare în tabelul de mai sus. Reparație de audit D1: relația Workday→Vehicul
folosea kind-ul generic `about` (același folosit și de un fuel Expense către
Vehicul), ceea ce permitea confuzia unei mențiuni oarecare cu Vehiculul chiar
folosit. Adaugă `uses` la `links_kind` și rescrie `pin_shift_rates()` să
rezolve Vehiculul doar după o legătură `uses`. Fără date live de migrat — nicio
legătură Workday→Vehicul (de orice fel) nu a fost încă exercitată pe live.

`20260907020000_road_cost_expenses` **nu** este aplicată live și nu apare în
tabelul de mai sus. Altă reparație de audit D1: `parking`/`tolls`/`other_cost`
trăiau ca numere pe `shifts` (din `20260905190000_from_the_reference`, deja
live) — al doilea adevăr financiar interzis de contract. Adaugă `parking` și
`tolls` la enumul de categorii al `expenses`, ca aceste costuri să poată deveni
Expense-uri reale, legate de Workday prin `about`. Coloanele vechi de pe
`shifts` **nu sunt atinse și nu sunt șterse** — pot avea deja valori reale pe
live; vezi `docs/STAREA.md` pentru regula dual-path (Expense legat câștigă
peste coloana veche, niciodată conversie automată).

`20260907030000_platform_rules` **nu** este aplicată live și nu apare în
tabelul de mai sus. A treia reparație de audit D1: regulile unei Platforme
(earning cycle, payout schedule, cash-out) stăteau ca o singură linie mutabilă
pe `platforms` (deja live, din D1) — contractul cere effective-dating, exact
ca la `vehicle_cost_rates`. Adaugă tabelul nou `platform_rules` (o linie per
Platformă per dată de la care regula a intrat în vigoare) și scoate cele 7
coloane de regulă din `platforms`, care rămâne doar identitate (`active`,
`display_order`). Fără date live de migrat — nicio Platformă n-a avut vreodată
o valoare reală în acele coloane, neexistând încă niciun ecran de configurare
a Platformelor (D3).

## Schimbări manuale declarate

### 5 septembrie 2026 — cron vechi eliminat

A fost declarat eliminat manual:

- jobul `send-push-alarms-every-minute`;
- tabelul `private.push_config`.

Motivul: trimiteau către o Edge Function care nu mai exista și nu mai erau
folosite de codul curent.

## Drift cunoscut

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
  `20260906060000_shift_invariants` înaintea acesteia; acel fișier tot **nu**
  este aplicat live, deci un `db push` viitor va încerca întâi `0600`, apoi va
  eșua pe `0700` din motivul de mai sus, indiferent dacă `0600` reușește sau
  nu.

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
- ordinea standard de migrații pune `0600` (`shift_invariants`, tot
  neaplicată live) înaintea acesteia — un `db push` viitor va eșua întâi pe
  `0600` (dacă rămâne blocată) sau, dacă `0600` s-ar rezolva vreodată, imediat
  după, pe aceasta.

Aceeași remediere ca mai sus rămâne necesară înainte de orice `db push`
viitor: `supabase migration repair` (sau echivalent) pe ambele migrații, sau
fișiere idempotente. Nu s-a făcut aici.

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
