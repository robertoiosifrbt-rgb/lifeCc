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

## Schimbări manuale declarate

### 5 septembrie 2026 — cron vechi eliminat

A fost declarat eliminat manual:

- jobul `send-push-alarms-every-minute`;
- tabelul `private.push_config`.

Motivul: trimiteau către o Edge Function care nu mai exista și nu mai erau
folosite de codul curent.

## Drift cunoscut

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
