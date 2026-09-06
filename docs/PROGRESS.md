# Life Control Centre — progres

**Tracker viu al execuției.**

Acest fișier răspunde la trei întrebări:

- unde suntem;
- ce este terminat;
- ce a rămas din planul actual.

`docs/PLAN.md` rămâne sursa de adevăr pentru produsul țintă. Acest fișier nu
repetă explicațiile produsului; doar urmărește criteriile executabile din plan.
`docs/STAREA.md` rămâne snapshot-ul scurt al capabilităților existente și al
blocajelor curente.

## Regula de status

- `DONE` = implementat și verificat;
- `PARTIAL` = există o parte reală, dar criteriul nu este complet;
- `TODO` = nu este implementat ca cerință completă.

Pentru scorul mecanic:

- `DONE` = 1 punct;
- `PARTIAL` = 0.5 puncte;
- `TODO` = 0 puncte.

Procentul arată **criterii de produs acoperite**, nu timp, efort sau linii de
cod. Dacă se adaugă criterii noi în PLAN, procentul poate scădea fără ca munca
făcută să dispară.

## Baseline existent — nu se punctează separat

Există deja fundație reutilizabilă:

- auth;
- repository + cache/sync;
- export;
- item lifecycle;
- Inbox / Today / Calendar;
- Areas;
- Entity + links;
- Vehicle;
- Delivery / shifts / earnings / expenses / mileage / fuel;
- HMRC / tax-year calculations parțiale;
- Waiting;
- Command Centre parțial.

Aceste capabilități contribuie la fazele de mai jos acolo unde criteriul lor
este efectiv satisfăcut.

---

## FAZA 1 — Reorganizarea produsului

Țintă din PLAN: experiența coerentă `Home / Plan / Areas / Money`, fără a
construi încă modulele viitoare.

- `DONE` — navigația/experiența principală exprimă clar Home / Plan / Areas / Money (exact patru tab-uri; Directory și Settings sunt secundare, reachable din More, niciodată un al cincilea/șaselea tab; `/areas/:id` păstrează contextul Areas în antet/bara de jos în loc să cadă pe titlul generic);
- `DONE` — `Things` nu mai este termen principal de UI (verificat acum și la nivel de copy din ecran, nu doar de etichetă în header: „Nothing here yet"/„Add a thing" au fost înlocuite, secțiunile explicite sunt People/Companies/Vehicles/Properties);
- `DONE` — HMRC este expus semantic sub Money / Tax;
- `PARTIAL` — Area / Project / Goal / Entity sunt definite clar în produs; UI-ul încă nu le exprimă complet;
- `DONE` — funcțiile existente sunt reexpuse coerent fără duplicare sau pierdere (header global curățat la titlu + „More"; email de cont, Sign out, resync și Download everything mutate în Settings, cu aceleași handlere/state, reachable din More; Capture rămâne universal ca un control compact, nu mai domină ecranul);
- `DONE` — Journal MVP: quick entry din Home, text liber, titlu opțional, `journaled_at` editabil separat de created_at/updated_at, editare ulterioară, timeline cronologic, căutare, legături opționale (Area + links existente), fără a deveni un al cincilea tab — end-to-end UI → repository → Supabase → sync/cache → export, cu migrație, RLS și teste.

**Scor fază: 5.5 / 6 = 92%**

### Criterii suplimentare

- _Adaugă aici criterii noi aprobate pentru Faza 1._

---

## FAZA 2 — Areas reale

- `PARTIAL` — Work → Gig Work → Multi-App Delivery (Workday recuperat cu lifecycle clar Draft/Completed pe item.state existent, Save draft cu live preview, Complete/Delete workday blocate corect de o sesiune deschisă, fuel automat din full-tank data, vehicle rate mutat într-o configurare separată — dar platformele configurabile, earning cycle/payout/cash-out rămân TODO, vezi criteriul suplimentar de mai jos);
- `TODO` — Work → Employment;
- `TODO` — Work → Business → ACHU LTD;
- `TODO` — Health;
- `TODO` — Home & Life Admin;
- `TODO` — Personal Finance.

**Scor fază: 0.5 / 7 = 7%**

### Criterii suplimentare

- `TODO` — platformele Multi-App Delivery sunt records configurabile, cu earning cycle, payout schedule, cash-out behaviour și fees configurabile/effective-dated, fără cazuri Uber/Deliveroo/Just Eat hardcodate.

---

## FAZA 3 — Money Core

- `TODO` — accounts cu owner clar personal/company;
- `PARTIAL` — transactions generale; există date financiare de domeniu, dar nu Money Core complet;
- `PARTIAL` — income / expenses ca model comun;
- `TODO` — transfers;
- `TODO` — bills / commitments;
- `TODO` — budgets;
- `TODO` — separare completă și explicită personal vs company în Money.

**Scor fază: 1 / 10 = 10%**

### Criterii suplimentare

- `TODO` — reserves separă required/target de actually funded și leagă funding-ul de bani reali aflați într-un cont/pot controlat;
- `TODO` — platform-held/pending earnings sunt separate de received money, cu settlement/cash-out fără a transforma soldul platformei într-un bank account controlat;
- `TODO` — regulile/ratele financiare schimbătoare sunt configuration-first și effective-dated/versionate, cu invariabilele financiare păstrate în cod.

---

## FAZA 4 — Income & Tax

- `PARTIAL` — Gig / self-employed;
- `TODO` — Employment / PAYE;
- `TODO` — dividends;
- `TODO` — ACHU company-side finances/tax context;
- `PARTIAL` — Self Assessment personal; există HMRC/tax-year logic, dar nu agregarea completă;
- `TODO` — company tax obligations separat de persoană.

**Scor fază: 1 / 7 = 14%**

### Criterii suplimentare

- `TODO` — Tax aplică independent regulile fiscale/accounting relevante; semantica Delivery/Money `earned / held / received` nu decide singură momentul fiscal.

---

## FAZA 5 — Projects + Goals + Reminders

- `TODO` — Projects cu ciclu complet;
- `TODO` — Goals cu target/current/deadline și legături;
- `TODO` — Reminders ca serviciu comun peste obiectele Life Core.

**Scor fază: 0 / 3 = 0%**

### Criterii suplimentare

- _Adaugă aici criterii noi aprobate pentru Faza 5._

---

## FAZA 6 — Contacts + Documents

- `PARTIAL` — People; există Person Entity, dar nu experiența completă Contacts;
- `PARTIAL` — Companies; există Company Entity, dar nu experiența completă;
- `TODO` — Files / Documents cu flux complet;
- `PARTIAL` — istoric și relații legate de Life Core; links există, experiența completă nu.

**Scor fază: 1.5 / 4 = 38%**

### Criterii suplimentare

- _Adaugă aici criterii noi aprobate pentru Faza 6._

---

## FAZA 7 — Health OS

- `TODO` — Gym complet;
- `TODO` — Nutrition;
- `TODO` — Progress / health tracking;
- `TODO` — health goals + Daily Focus integration.

**Scor fază: 0 / 4 = 0%**

### Criterii suplimentare

- _Adaugă aici criterii noi aprobate pentru Faza 7._

---

## FAZA 8 — Home final

- `PARTIAL` — Attention;
- `DONE` — Today există ca experiență funcțională;
- `PARTIAL` — Next Actions / active work există parțial;
- `DONE` — Waiting;
- `PARTIAL` — Money summary; există doar date financiare/tax parțiale;
- `TODO` — Goals integration;
- `TODO` — Health integration;
- `TODO` — Areas aggregation în Home final;
- `TODO` — Daily Focus.

**Scor fază: 4.0 / 10 = 40%**

### Criterii suplimentare

- `PARTIAL` — Home Quick Actions sunt configurabile de utilizator: registru
  finit și sigur în cod (`journal.new`, `money.expense`, `delivery.work`); ce
  apare pe Home, ordinea și contextul (Arie, pentru delivery.work) sunt date
  ale utilizatorului, nu butoane hardcodate; zero configurate → fără acțiuni
  de domeniu inventate, cu o cale clară de configurare; `delivery.work`
  rezolvă starea reală (Start/Resume/Open) după zi *și* Aria configurată,
  fără potrivire după numele ariei, cu invariante de bază (o singură tură
  vie pe zi/Arie, o singură sesiune deschisă) și recuperare sigură când
  extensia shift-ului lipsește. Implementarea și migrațiile există complet
  în repo, cu RLS scrise pentru ele. `20260906050000_quick_actions` este
  acum confirmată aplicată pe baza live (vezi `docs/MIGRATII.md`), deci
  tabelul `quick_actions` există în producție — dar criteriul rămâne
  `PARTIAL`, nu `DONE`: `20260906060000_shift_invariants` nu este aplicată,
  iar fără ea baza nu garantează încă cele două invariante de mai sus.
  Blocajul rămâne cel cunoscut din `docs/STAREA.md` — cincisprezece
  `shift_sessions` deschise simultan pe o singură tură din live, neatinse,
  în așteptarea deciziei proprietarului.

---

# Progres total curent

Criterii urmărite: **51**

Puncte curente: **13.5 / 51**

**Progres mecanic: 26%**

**Rămas mecanic: 74%**

Acest procent nu este estimare de timp. Fundația tehnică deja existentă poate
face unele criterii viitoare mult mai rapide decât sugerează numărul brut.

---

# Regula de actualizare

După o implementare verificată:

1. se schimbă numai criteriile afectate;
2. `PARTIAL` nu devine `DONE` doar pentru că există un ecran sau o migrație;
3. `DONE` cere ca fluxul cerut de PLAN să fie complet și verificat;
4. se recalculează scorul fazei și totalul;
5. dacă apare o cerință nouă de produs, se adaugă mai întâi în `PLAN.md`, apoi
   aici ca criteriu;
6. nu se șterg criterii doar ca procentul să arate mai bine;
7. un task care schimbă acoperirea unui criteriu urmărit nu este declarat gata
   până când statusul și scorurile din acest fișier au fost actualizate;
8. pentru economie de context, agentul citește numai faza relevantă și totalul,
   nu întregul tracker, exceptând recalculările globale.

# Extensii viitoare

## Criterii noi neîncadrate încă

- _Spațiu pentru criterii aprobate care trebuie repartizate într-o fază._

## Faze noi aprobate

- _Spațiu pentru faze care vor fi adăugate ulterior în PLAN._
