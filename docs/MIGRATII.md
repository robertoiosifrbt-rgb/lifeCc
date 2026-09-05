# Migrațiile — ce e pe baza live, și în ce ordine se rulează

Sesiunile nu ajung la baza de producție: n-au nici acces, nici rețea către ea.
Deci orice schimbare de structură se scrie ca migrație în `supabase/migrations/`
și **o rulează proprietarul de mână**, din SQL Editor.

Fișierul ăsta e singurul loc unde scrie **ce a fost rulat**. Repo-ul ține ce
*trebuie* rulat — un fișier de migrație arată la fel indiferent dacă baza l-a
văzut sau nu. Iar tabelul de evidență din bază,
`supabase_migrations.schema_migrations`, ține numai ce i s-a spus că e aplicat.

## 🔴 Ordinea. Se greșește în amândouă felurile, și fiecare costă altceva

**O migrație care ADAUGĂ: SQL-ul întâi, codul după.** Codul nou cere o coloană
care nu există încă, iar ecranele care o cer dau eroare până rulezi SQL-ul.
📜 S-a întâmplat pe 5 septembrie 2026: cinci migrații scrise, aplicația de pe
telefon cerea `areas` și `items.area_id` de la o bază care nu le avea. Patru
ecrane, moarte, până la Run.

**O migrație care ȘTERGE: codul întâi, SQL-ul după.** Aplicația care rulează
încă cere lucrul șters, și moare în secunda în care apeși Run.
📜 S-a întâmplat în aceeași zi, câteva ore mai târziu: SQL-ul dat
proprietarului ștergea `reserves`. Migrația era curată — toate 12 rulau de la
zero pe PostgreSQL 16 — și codul care nu mai avea nevoie de tabel era scris și
testat. Dar era scris **în container**, iar telefonul rula ce e pe GitHub, și
acela cerea `reserves` la fiecare sincronizare. A rulat SQL-ul și aplicația a
murit pe loc: „Fetching the reserves".

⛔ **Nicio verificare de dinainte nu putea prinde asta.** Baza și codul erau
corecte fiecare în parte. Greșeala era în **ordinea dintre două lucruri care nu
pleacă împreună**: migrația se duce în bază când o rulezi tu, codul se duce la
un push. De-aia există `npm run check:drops`, care compară ștergerile din
migrații cu codul de pe ramura din care se construiește aplicația.

## Cum se rulează una

1. Supabase → **SQL Editor** → **New query**
2. Lipești tot blocul, apeși **Run**
3. Trebuie să scrie **Success**
4. Spui sesiunii că ai rulat-o, ca să fie trecută mai jos

Scripturile sunt scrise ca să pice în întregime dacă o linie dă eroare —
`begin` la început, `commit` la sfârșit — deci o rulare picată nu lasă baza pe
jumătate.

## Aplicate pe baza live

| Migrație | Ce aduce | Rulată |
|---|---|---|
| `20260904181500_items` | tabelul `items`, coloana vertebrală | 4 sep, de mână din SQL Editor |
| `20260904231100_items_owner_cascade` | ștergerea contului își ia itemii | 4 sep, de mână |
| `20260905010137_items_insert_columns` | INSERT pe coloană | 5 sep |
| `20260905073000_areas` | `areas`, plus `items.area_id` | 5 sep |
| `20260905090000_shifts` | `shifts`, `shift_sessions`, `shift_earnings` | 5 sep |
| `20260905100000_reserves` | `reserves`, `running_costs`, ratele înghețate | 5 sep |
| `20260905110000_expenses` | `expenses`, `kind='expense'` | 5 sep |
| `20260905120000_hmrc` | `tax_years`, un rând pe an fiscal | 5 sep |
| `20260905130000_business_use` | `expenses.business_pct`, `shifts.personal_km` | 5 sep |
| `20260905140000_class2` | pragul mic și costul unui an de Class 2 | 5 sep |
| `20260905150000_when` | pragul ratelor în avans, și ce s-a plătit deja | 5 sep |
| `20260905160000_one_answer` | șterge `reserves` și procentele înghețate | 5 sep |
| `20260905170000_upsert_keys` | coloanele-cheie devin scriibile și fixate de trigger | 5 sep, seara |
| `20260905180000_entities_and_links` | `entities` și `links` — nucleul | 5 sep, seara |
| `20260905190000_from_the_reference` | coloanele din aplicația de referință | 5 sep, seara |

## Rulat de mână, în afara migrațiilor

Nu tot ce e pe baza live vine dintr-un fișier din `supabase/migrations/`. Ce s-a
scos sau pus direct din SQL Editor se trece aici, fiindcă altfel nu lasă urmă
nicăieri.

**5 septembrie 2026 — scos cronul de push și tabelul lui.** Rămășițe de dinainte
de golirea repo-ului, găsite de auditul din 5 septembrie uitându-se în baza
live, deschise ca [#38](https://github.com/robertoiosifrbt-rgb/lifeCc/issues/38):
un job `send-push-alarms-every-minute`, `* * * * *`, activ, care făcea
`net.http_post` către Edge Function-ul `send-push-alarms` — care nu mai există.
Plus tabelul `private.push_config`. Nimic din repo nu le descria și niciun rând
de cod nu le cerea, deci regula de ordine era deja satisfăcută.

```sql
select cron.unschedule('send-push-alarms-every-minute');
drop table private.push_config;
```

Verificat după: `select count(*) from cron.job` → `0`,
`to_regclass('private.push_config')` → `null`.

Extensiile `pg_cron` și `pg_net` au rămas instalate, și schema `private` a rămas.
Niciuna nu costă nimic nefolosită.

## 🔴 Baza live NU se potrivește cu migrațiile

**`reserves` există pe baza live, deși ultima migrație îl șterge.**

Ce s-a întâmplat, în ordine: a rulat migrația care îl șterge → aplicația de pe
telefon a murit, fiindcă încă îl cerea → i s-a dat un bloc SQL care îl pune la
loc, ca aplicația să meargă până ajunge codul nou sus.

Codul nou e acum livrat și nu-l mai cere. Deci tabelul poate fi șters din nou,
iar până atunci stă acolo, gol, ignorat de tot ce rulează.

⚠️ **Nu se rezolvă cu o migrație nouă.** `20260905160000` e deja trecută ca
aplicată în evidența bazei; o a doua care șterge același lucru ar fi un fișier
care descrie o stare pe care baza n-o mai are. Se rulează blocul de mai jos, o
dată, când proprietarul vrea:

```sql
drop table if exists public.reserves;
```
