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

- `TODO` — navigația/experiența principală exprimă clar Home / Plan / Areas / Money;
- `TODO` — `Things` nu mai este termen principal de UI;
- `TODO` — HMRC este expus semantic sub Money / Tax;
- `PARTIAL` — Area / Project / Goal / Entity sunt definite clar în produs; UI-ul încă nu le exprimă complet;
- `TODO` — funcțiile existente sunt reexpuse coerent fără duplicare sau pierdere;
- `TODO` — Journal MVP: quick entry, text liber, dată+oră, editare, timeline/search și legături opționale conform PLAN.

**Scor fază: 0.5 / 6 = 8%**

### Criterii suplimentare

- _Adaugă aici criterii noi aprobate pentru Faza 1._

---

## FAZA 2 — Areas reale

- `PARTIAL` — Work → Gig Work → Multi-App Delivery;
- `TODO` — Work → Employment;
- `TODO` — Work → Business → ACHU LTD;
- `TODO` — Health;
- `TODO` — Home & Life Admin;
- `TODO` — Personal Finance.

**Scor fază: 0.5 / 6 = 8%**

### Criterii suplimentare

- _Adaugă aici criterii noi aprobate pentru Faza 2._

---

## FAZA 3 — Money Core

- `TODO` — accounts cu owner clar personal/company;
- `PARTIAL` — transactions generale; există date financiare de domeniu, dar nu Money Core complet;
- `PARTIAL` — income / expenses ca model comun;
- `TODO` — transfers;
- `TODO` — bills / commitments;
- `TODO` — budgets;
- `TODO` — separare completă și explicită personal vs company în Money.

**Scor fază: 1 / 7 = 14%**

### Criterii suplimentare

- _Adaugă aici criterii noi aprobate pentru Faza 3._

---

## FAZA 4 — Income & Tax

- `PARTIAL` — Gig / self-employed;
- `TODO` — Employment / PAYE;
- `TODO` — dividends;
- `TODO` — ACHU company-side finances/tax context;
- `PARTIAL` — Self Assessment personal; există HMRC/tax-year logic, dar nu agregarea completă;
- `TODO` — company tax obligations separat de persoană.

**Scor fază: 1 / 6 = 17%**

### Criterii suplimentare

- _Adaugă aici criterii noi aprobate pentru Faza 4._

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

**Scor fază: 3.5 / 9 = 39%**

### Criterii suplimentare

- _Adaugă aici criterii noi aprobate pentru Faza 8._

---

# Progres total curent

Criterii urmărite: **45**

Puncte curente: **8 / 45**

**Progres mecanic: 18%**

**Rămas mecanic: 82%**

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
6. nu se șterg criterii doar ca procentul să arate mai bine.

# Extensii viitoare

## Criterii noi neîncadrate încă

- _Spațiu pentru criterii aprobate care trebuie repartizate într-o fază._

## Faze noi aprobate

- _Spațiu pentru faze care vor fi adăugate ulterior în PLAN._
