# Life Control Centre — sursa de adevăr a produsului

**Document viu. Actualizat: 6 septembrie 2026.**

Life CC este un **Life OS**: un singur control centre pentru viață, muncă, bani,
sănătate, proiecte, oameni, documente și obligații.

Nu este un task manager, un calendar, o aplicație de finanțe, un tracker de
sală și o aplicație de business lipite între ele. Acestea sunt **vederi și
domenii peste același sistem**.

Acest document este **sursa de adevăr pentru produsul țintă**: ce construim,
cum se leagă conceptele și în ce direcție evoluează aplicația.

Rolurile documentelor sunt strict separate:

- `docs/PLAN.md` — produsul țintă și regulile lui; documentul viu de aici;
- `docs/STAREA.md` — ce există și ce lipsește efectiv acum;
- `docs/MIGRATII.md` — ce migrații sunt declarate ca aplicate live și driftul;
- `CLAUDE.md` — cum are voie agentul să lucreze în repo;
- codul + migrațiile — adevărul tehnic despre implementarea curentă.

O implementare nu schimbă direcția produsului pe ascuns. Dacă o decizie nouă
contrazice acest plan, planul se actualizează explicit înainte sau împreună cu
implementarea. O felie implementată nu redefinește obiectivul părinte.

---

## 1. Rezultatul urmărit

Life CC trebuie să fie:

- singurul loc în care intră lucrurile importante din viață;
- rapid de folosit pe telefon, cu o mână;
- suficient de clar încât proprietarul să înțeleagă instant unde este și de ce;
- de încredere pentru date reale;
- capabil să spună **ce contează acum**, nu doar să depoziteze;
- capabil să lege bani, timp, persoane, companii, mașini, documente, proiecte
  și acțiuni fără duplicare;
- capabil să separe corect viața personală de activitatea self-employed și de
  companii precum ACHU LTD, dar să arate relațiile dintre ele;
- tolerant când nu este folosit câteva zile sau săptămâni;
- exportabil: utilizatorul își poate lua datele înapoi.

Fraza care descrie produsul:

> **Introduci un lucru o singură dată. Life CC îl arată automat peste tot unde
> contează.**

Exemplu:

> Car insurance renewal = acțiune + deadline + cost + document + mașină +
> companie + reminder + istoric, toate legate ca un singur lucru, nu șapte
> copii.

---

## 2. Regula de orientare: orice lucru răspunde la aceleași întrebări

Pentru orice obiect important, sistemul trebuie să poată spune:

1. **Ce este?** — task, expense, event, goal, document etc.
2. **Unde aparține?** — Area / Project.
3. **Despre cine sau ce este?** — persoană, companie, mașină, proprietate etc.
4. **Când contează?** — azi, deadline, interval, recurență.
5. **Are bani?** — sumă, cont, venit, cheltuială, transfer.
6. **Are ceva de făcut?** — action / next action.
7. **Trebuie să revină în atenție?** — reminder / waiting / deadline.

Utilizatorul nu trebuie să aleagă între „Delivery”, „Car”, „Finance” sau
„Calendar” ca și cum ar fi aplicații diferite. Același obiect poate avea toate
legăturile relevante simultan.

---

## 3. Modelul conceptual al Life Core

Nucleul produsului are concepte clare. Ele **nu obligă** la câte un tabel separat;
schema rămâne cât mai mică și se extinde numai pentru cazuri reale.

### 3.1 Item

Ancora comună pentru orice lucru important care trebuie găsit, legat, urmărit
sau sincronizat.

### 3.2 Action

Ceva ce trebuie făcut. Poate fi fără dată, programat, overdue, waiting sau done.

### 3.3 Event

Ceva care ocupă sau marchează timp: întâlnire, program, tură, appointment,
workout programat etc.

### 3.4 Entity

Un lucru cu identitate proprie în lumea reală:

- person;
- company;
- vehicle;
- property;
- mai târziu alte tipuri numai când există nevoie reală.

### 3.5 Resource

Ceva folosit, deținut sau atașat:

- bani;
- account;
- document;
- asset;
- informație relevantă.

### 3.6 Area

O responsabilitate continuă din viață. **Nu se termină** în mod normal.

Exemple: Health, Multi-App Delivery, ACHU LTD, Personal Finance.

### 3.7 Project

Un rezultat finit care are început și sfârșit.

Exemple: „Get first 10 recurring ACHU clients”, „Move house”, „12-week cut”.

### 3.8 Goal

O stare sau țintă către care utilizatorul vrea să ajungă, de regulă măsurabilă
sau evaluabilă.

Exemple: £5,000 emergency fund, 78 kg, Bench 100 kg, 10 recurring clients.

### 3.9 Reminder

Un mecanism comun care readuce orice obiect în atenție la momentul potrivit.
Nu este o aplicație separată.

---

## 4. Diferențele care nu trebuie amestecate

Aceste distincții sunt legi de produs:

- **Area** = responsabilitate continuă;
- **Project** = rezultat finit;
- **Goal** = unde vrei să ajungi;
- **Entity** = cine sau ce există independent;
- **Action** = ce trebuie făcut;
- **Event** = când se întâmplă ceva;
- **Resource** = bani/document/asset/informație;
- **Reminder** = când trebuie readus ceva în atenție.

Exemple:

- `ACHU LTD` = Area + Company Entity;
- `Get first 10 recurring clients` = Project în ACHU;
- `10 recurring clients` = Goal;
- `Send quote to John` = Action;
- `Meeting with accountant` = Event;
- `John` = Person Entity;
- `invoice-104.pdf` = Resource/Document.

Un singur obiect poate participa în mai multe relații fără a fi duplicat.

---

## 5. Legile coloanei vertebrale

1. Orice obiect important cu viață proprie are un item-ancoră când trebuie să
   fie găsit și legat.
2. Legăturile sunt **item ↔ item**, nu module ↔ module.
3. Datele de domeniu extind ancora lor; nu creează aplicații paralele.
4. `UI → repository → Supabase`; UI nu scrie direct în bază.
5. Un răspuns parțial nu este tratat ca adevăr complet.
6. Orice obiect creat are o cale clară prin care poate fi regăsit.
7. Ce poate garanta baza se garantează în bază, nu prin copii fragile în UI.
8. Identitatea și ownership-ul nu se mută între utilizatori.
9. Logica unui fapt există într-un singur loc.
10. Nu se inventează date sau formule pentru a umple un ecran.
11. Nu se adaugă infrastructură „pentru viitor” înaintea unei nevoi reale.
12. Fiecare tabel client-editabil are o strategie clară de sincronizare.
13. O informație este introdusă o singură dată și reutilizată prin relații.
14. Personal, self-employed și company money nu se amestecă semantic.
15. Un transfer între conturi nu devine venit doar pentru că intră bani într-un
    alt cont al aceluiași owner.
16. Modulele specializate trebuie să poată explica ce obiecte Life Core folosesc
    și unde reapar acele date.
17. **Configuration over hardcoding.** Codul oferă motorul; datele și
    configurația definesc sistemul schimbător al utilizatorului.
18. Structura și regulile de business care se pot schimba fără a schimba natura
    motorului nu se îngheață în cod: module/sections configurabile unde este
    cazul, platforme, categorii, conturi, reserve types, payout schedules,
    cash-out rules/fees, rates, thresholds, labels, display order, visibility,
    defaults și mappings/rules de business.
19. Regulile și valorile care se schimbă în timp au `effective_from` sau
    versionare echivalentă. O regulă nouă nu rescrie retrospectiv adevărul
    istoric decât printr-o acțiune explicită.
20. Configurația nu înseamnă cod arbitrar executat din bază. Motorul acceptă
    primitive sigure și cunoscute — de exemplu fixed amount, percentage,
    per-distance, transfer, allocation și date rule — iar configurația alege și
    parametrizează aceste primitive.
21. În cod rămân invariabilele dure: autentificare, security/ownership/RLS,
    repository/sync, integritatea datelor, primitivele financiare și de
    linking, validările fundamentale și componentele UI reutilizabile.
22. O schimbare normală a vieții sau a unei reguli externe nu trebuie să ceară
    modificarea aplicației dacă poate fi reprezentată corect ca date.
23. Configurabilitatea internă nu anulează invariabilele produsului: harta
    mentală `Home / Plan / Areas / Money`, ownership-ul și semantica Life Core
    rămân reguli de produs, nu setări arbitrare.

---

## 6. Navigația țintă

Navigația principală a produsului trebuie să fie ușor de explicat:

> **HOME | PLAN | AREAS | MONEY**

Numărul exact de controale sau forma vizuală poate fi adaptată pentru telefon,
dar **harta mentală** rămâne aceasta.

### HOME

„Ce contează acum?”

### PLAN

„Ce trebuie să fac și când?”

### AREAS

„În ce parte a vieții mele trăiește lucrul acesta?”

### MONEY

„Ce se întâmplă cu banii mei și ai entităților pe care le administrez?”

`Things` nu este un concept principal pentru utilizator. Entity rămâne în
nucleu, dar experiența devine explicită: People, Companies, Vehicles,
Properties etc.

HMRC nu este navigație principală. Este o zonă specializată din Money / Tax.

Calendarul este o vedere din Plan peste aceleași obiecte, nu o lume separată.

### Shell secundar: More, Settings, Capture

Regulile aprobate pentru shell-ul Fazei 1, valabile pe orice ecran:

- header-ul global normal conține doar titlul ecranului curent și un control
  compact „More" (minimum 44px); nu mai expune email de cont, Sign out,
  resync, Download everything sau Directory pe fiecare ecran;
- „More" deschide o foaie secundară cu exact trei uși: Journal, Directory,
  Settings — nu este un al cincilea tab principal;
- Journal rămâne semantic parte din Home, chiar dacă e reachable din More;
  Directory este un director de entități cross-cutting; Settings este
  configurare de aplicație/cont;
- Settings ține utilitățile globale existente reexpuse (nu duplicate):
  email de cont, status sync, Sync again, configurare Quick Actions,
  Download everything, Sign out;
- încrederea în sync nu dispare din header: cât timp sync-ul e sănătos,
  header-ul nu ține o zonă mare de status; când sync-ul are o problemă reală,
  header-ul arată un afordanță compactă, vizibilă, care duce spre Settings —
  nu ascunde niciodată tăcut un eșec de sync;
- Capture rămâne universal și la o singură atingere distanță, dar nu mai
  domină ecranul: un control compact (minimum 44×44px), nu un bloc lat pe
  toată lățimea; nu devine un al cincilea tab;
- Directory expune explicit People / Companies / Vehicles / Properties —
  niciodată „Things" ca termen orientat spre utilizator; ruta `/things` și
  modelul intern pot rămâne neschimbate, doar UX-ul se schimbă;
- harta mentală principală rămâne exclusiv Home / Plan / Areas / Money, cu
  patru tab-uri; Directory și Settings sunt ecrane secundare, nu tab-uri.

---

## 7. HOME / Command Centre

Home este experiența principală și punctul de intrare.

Trebuie să răspundă la întrebarea: **„Ce cere atenție acum?”**

Ținta include, numai din date reale:

- Daily Focus;
- Top priorities / Today;
- programul zilei;
- overdue;
- deadlines apropiate;
- reminders;
- Inbox neprocesat;
- Quick Journal pentru scriere imediată;
- Next Actions;
- Waiting;
- bani care ies curând;
- bani care intră curând;
- bills / commitments apropiate;
- goal-uri care cer atenție;
- următorul workout / Health action când există;
- starea ariilor numai când există o metrică definită.

Dacă o valoare nu poate fi calculată din date reale, nu se afișează o valoare
ghicită.

### Daily Focus

Home poate începe cu un mesaj scurt și puternic, orientat spre progres, nu spre
„streak shame”. Exemplele sunt stil, nu texte obligatorii:

> Slow enough to understand. Fast enough to progress.

> You don't need another perfect day. You need another day you didn't quit.

La început mesajele pot veni dintr-o bibliotecă locală bună. Mai târziu pot fi
contextuale, dar fără dependență obligatorie de AI.

### Home Quick Actions

Quick Actions-urile de pe Home sunt **configurabile de utilizator**, aplicarea
directă a Legii 17 (configuration over hardcoding) la ecranul de intrare.

- codul aplicației expune un registru finit și sigur de acțiuni suportate
  (de exemplu: `journal.new`, `money.expense`, `delivery.work`);
- datele/configurația deținute de utilizator decid: care Quick Actions apar pe
  Home, eticheta afișată, ordinea lor, contextul relevant (de exemplu o Arie
  pentru Delivery) și vizibilitatea/prezența lor;
- eticheta este opțională și doar de afișaj: null înseamnă numele implicit
  din cod, un text propriu îl înlocuiește; nu schimbă niciodată `action_key`
  sau ce face acțiunea la execuție — pentru `delivery.work`, starea
  (Start/Resume/Open) rămâne exclusiv decizia codului după starea reală a
  zilei, eticheta proprie oferă cel mult subiectul din text;
- o acțiune specifică unui domeniu (de exemplu Delivery) nu apare niciodată
  pentru un utilizator care nu a configurat-o explicit;
- configurația nu înseamnă niciodată cod, SQL sau expresii arbitrare executate
  din bază (Legea 20): un rând numește o acțiune din registru, niciodată cum
  se execută ea;
- un `action_key` necunoscut sau nesuportat nu se execută niciodată — nici
  dacă ar ajunge cumva într-un rând;
- contextul de Arie al lui `delivery.work` este `area_id`-ul configurat, nu o
  potrivire după numele ariei (Delivery, Multi-App Delivery, Gig Work etc.):
  numele ariei este dată a utilizatorului, nu un identificator de domeniu;
- dacă utilizatorul nu are nicio Quick Action configurată, Home nu recreează
  tăcut un set implicit și nu arată acțiuni de domeniu irelevante — arată o
  cale clară, mică, spre configurare;
- trebuie să existe un punct de intrare clar din Home spre gestionarea Quick
  Actions (adăugare, ascundere/eliminare, schimbarea ordinii, alegerea
  contextului necesar).

---

## 8. PLAN

Plan reunește toate perspectivele de timp și execuție asupra acelorași obiecte.

Vederi țintă:

- Today;
- Tasks / Next Actions;
- Calendar;
- Projects;
- Waiting;
- Goals.

Exemplu: `Renew car insurance` poate apărea simultan:

- în Today dacă trebuie făcut azi;
- în Tasks;
- pe data relevantă în Calendar;
- în Area `Multi-App Delivery` dacă este cost/context de business;
- pe pagina mașinii;
- în Money dacă implică o plată.

Este **același lucru**, nu copii.

---

## 9. AREAS — harta vieții

Areas sunt contexte de viață, nu silozuri de date.

Structura inițială țintă:

```text
LIFE
│
├── Work
│   ├── Gig Work
│   │   └── Multi-App Delivery
│   ├── Employment
│   │   └── [Employer / Job]
│   └── Business
│       └── ACHU LTD
│           ├── Operations
│           ├── Sales & Marketing
│           ├── Clients
│           └── Admin & Compliance
│
├── Health
│   ├── Gym
│   ├── Nutrition
│   └── Health Tracking
│
├── Home & Life Admin
├── Relationships / Family
├── Learning & Development
└── Personal Finance
```

Aceasta este o hartă de pornire, nu o interdicție asupra altor Areas.
Sub-areas se adaugă când există responsabilitate reală, nu pentru a umple
arborele.

O arie nu primește automat procent de progres. O astfel de metrică există numai
după ce definiția este stabilită și datele o susțin.

---

## 10. Work / Gig Work / Multi-App Delivery

Delivery este un domeniu al Life CC, nu o aplicație separată.

Experiența internă poate include:

- Dashboard;
- Shifts;
- Platforms;
- Earnings;
- Expenses;
- Performance.

HMRC / Tax nu locuiește în Delivery. Vehicle management nu locuiește în
Delivery. Domeniul Delivery produce și leagă datele relevante; Money / Tax și
Vehicle le consumă din aceleași obiecte.

### Work data

- shifts;
- shift sessions;
- start / end;
- breaks;
- hours worked;
- platform earnings;
- other platform earnings;
- tips;
- bonuses.

### Workday lifecycle

Un Workday este un `Item` de kind `shift`, cu ciclul de viață Life Core deja
existent — `active` înseamnă Draft, `done` înseamnă Completed. Nu există un
al doilea status paralel doar pentru Delivery.

- **Draft**: editabil — title, date, Area, sesiuni, câștiguri, odometru,
  costuri de drum. Cât e Draft, apare corect în Overdue/active work dacă are
  o dată trecută și nimeni nu l-a completat.
- **Completed**: `state='done'`, `done_at` setat automat de regula generică
  a item-ului. Iese din Overdue/active work ca orice alt item terminat.
  Rămâne read-only pentru datele operaționale, dar rămâne descoperibil în
  istoric.
- **Start / Stop** rămân exclusiv despre sesiunea de lucru curentă
  (`shift_sessions`) — Stop nu completează niciodată workday-ul.
- **Complete Workday** e o acțiune separată și explicită, blocată dacă există
  o sesiune deschisă (mesaj: „Stop the active session first.”). Nu inventează
  o oră de final — ora vine numai din sesiunea reală, închisă prin Stop.
- **Delete Workday** e soft-delete pe ancora item (aceeași regulă ca oriunde
  în Life Core), blocat la fel dacă există o sesiune deschisă.
- **Save draft**: formularul editează întâi o stare locală; preview-ul de sus
  (Made/Driven/Roughly yours etc.) se recalculează imediat din acea stare
  locală, folosind aceeași logică (`takeHome`) ca varianta persistată — nu o a
  doua formulă pentru „cât timp tastezi”. Nimic nu se scrie pe server până la
  Save draft sau Complete Workday. Start/Stop rămân excepția: sunt evenimente
  reale și se scriu imediat.
- **Fuel cost** nu mai este un input manual în Workday. Se citește automat
  din calculul full-tank-to-full-tank existent (`fuelRate`/`fillsOf`), ținut
  strict per Vehicle (fuel expenses legate de acel Vehicle, niciodată de
  Area), afișat ca „Automatic · £x.xxxx/km” sau „Not enough full-tank data
  yet” — niciodată £0 ca și cum ar fi un cost real.
- **Vehicle rate** este o configurare per Vehicle, cu istoric datat
  (`vehicle_cost_rates`), independentă de fuel — nu o configurare a Ariei
  (`running_costs`) și nu o formulă automată inventată aici. Se editează
  dintr-o acțiune secundară, „Configure vehicle cost”, separată de
  completarea normală a turei.
- **Vehicle folosit** este el însuși deferred la Save draft/Discard, la fel
  ca orice alt câmp al turei — alegerea lui nu scrie nimic pe server până la
  Save draft. Complete Workday cere un Vehicle unic și neambiguu legat.
- Vechiul Delivery Hub Manager e folosit ca referință de **funcționalitate**
  recuperată (Draft/Completed, Save draft, Complete workday, live preview),
  nu ca arhitectură de reprodus — fără tabele Zite, fără status paralel,
  fără flat tax/NI, fără platforme hardcodate ca structură nouă.

### Platforms

Uber Eats, Deliveroo, Just Eat și alte platforme sunt Companies / income
sources. Nu devin automat Areas separate și nu sunt coloane sau cazuri
hardcodate în produs.

Fiecare platformă este un record configurabil. O platformă nouă trebuie să
poată fi adăugată fără modificarea codului aplicației.

Configurația unei platforme poate include, când este relevant:

- company/entity link;
- earning cycle;
- platform-held balance;
- automatic payout schedule;
- payout destination account;
- cash-out enabled / disabled;
- cash-out settlement timing;
- cash-out fee type;
- cash-out fee value;
- alte reguli specifice platformei care pot fi exprimate prin primitivele
  sigure ale motorului.

Exemplu de configurație, nu valoare hardcodată:

```text
Platform: Uber Eats

Earning cycle
Monday 00:00 → Sunday 23:59

Automatic payout
Wednesday 23:59

Cash out
Enabled: Yes
Settlement: Instant
Fee type: Fixed
Fee: £0.50 per transaction
```

### Earned, held și received

Delivery păstrează separat faptul că banii au fost câștigați de faptul că au
ajuns efectiv într-un cont controlat de utilizator.

Stări/concepte necesare:

- earned / accrued through work;
- pending / held by platform;
- scheduled for payout;
- cash-out requested, când există;
- settled / received;
- adjusted / reversed, când platforma modifică suma înainte de settlement.

Exemplu:

```text
Earned / worked for      £420
Held by platforms        £135
Actually received        £285
```

În Money, `received income` reprezintă banii ajunși efectiv într-un cont
controlat. Soldul ținut de platformă nu este modelat ca un current/savings
account obișnuit al utilizatorului doar pentru a face un transfer să pară
simplu.

Aceasta este o semantică de produs și de cash visibility, nu o definiție
automată a momentului fiscal HMRC. Tax aplică separat regulile fiscale și de
accounting relevante.

Automatic payout și manual cash-out sunt evenimente distincte. Ajustările sau
reversările înainte de settlement trebuie să poată fi reprezentate fără a
inventa tranzacții bancare false.

Exemplu conceptual de cash-out:

```text
Platform balance pending: £300
Cash-out requested:       £100
Bank receives:            £100
Cash-out fee:             £0.50
```

Efectul exact asupra ledgerului și asupra platform-held balance este definit de
regula platformei; PLAN nu îngheață prematur o schemă contabilă unică.

### Vehicle usage

- vehicle used;
- work mileage;
- personal mileage;
- odometer;
- fuel/full-tank tracking;
- litres;
- business-use percentage.

### Delivery expenses

- fuel;
- parking;
- tolls;
- maintenance;
- phone / business costs;
- other shift costs;
- expense coverage dates.

Cheltuielile se leagă simultan de Area, vehicle, account și tax context atunci
când este cazul.

Exemplu:

```text
£70 fuel
Type: Expense
Area: Multi-App Delivery
Vehicle: My Car
Account: Personal Current
Category: Fuel
Business use: relevant percentage
```

Aceeași intrare contribuie la istoricul mașinii, Delivery profit, Money și tax.

Cheltuiala rămâne vizibilă în Delivery pentru că este necesară pentru costul și
profitabilitatea muncii, dar este **același obiect financiar** văzut și în
Money, nu o copie separată.

---

## 11. Employment

Employment este separat semantic de Gig Work.

Un employment record poate avea:

- employer;
- job title;
- contract;
- salary / hourly rate;
- shifts;
- overtime;
- hours;
- gross pay;
- PAYE tax deducted;
- NI;
- pension;
- holiday;
- payslips;
- documents;
- reminders;
- calendar events.

Dacă există mai multe joburi, fiecare are propriul context, dar toate intră în
Money și în poziția fiscală personală relevantă.

---

## 12. ACHU LTD — businessul și persoana sunt două lucruri diferite

ACHU trebuie modelat în două perspective legate.

### 12.1 ACHU ca business

Compania în sine poate avea:

- business bank accounts;
- revenue;
- expenses;
- clients;
- quotes;
- invoices;
- suppliers;
- subscriptions;
- staff;
- marketing;
- assets;
- documents;
- cashflow;
- profit;
- company tax obligations;
- VAT numai dacă devine relevant.

### 12.2 Proprietarul ca persoană care primește bani de la ACHU

Fluxurile personale sunt distincte:

- salary / PAYE;
- dividends;
- reimbursements sau alte fluxuri reale când există.

Exemplu conceptual:

```text
ACHU LTD
→ Dividend paid £X
→ Company cash decreases

PERSONAL
→ Dividend received £X
→ Personal income increases
→ Relevant to Self Assessment
```

Cele două capete sunt legate. Nu se introduc manual ca două adevăruri fără
relație.

La fel, salary este cost/payroll pe partea companiei și PAYE employment income
pe partea persoanei.

---

## 13. MONEY — nucleul financiar

Money trebuie să devină un sistem financiar personal + business, nu doar un
ecran HMRC.

### 13.1 Accounts

Conturile sunt resurse cu owner clar.

**Personal** poate include:

- current accounts;
- savings;
- cash;
- credit cards;
- loans / liabilities.

**Business** poate include:

- ACHU current account;
- ACHU savings/reserve;
- business cards și alte conturi reale.

Owner-ul este explicit: persoană sau company.

Soldurile ținute de platforme de delivery nu sunt introduse aici ca bank
accounts controlate. Ele au semantică de `platform-held / pending` și devin bani
într-un cont controlat numai la settlement.

### 13.2 Reserves

O rezervă nu este bani imaginari și nici simplul rezultat al unei formule.
Sistemul separă explicit:

- required / target reserve;
- actually funded reserve;
- contul real sau pot/allocation unde se află banii finanțați;
- available / unreserved money.

O rezervă poate fi legată de un current/savings account real sau de un pot /
allocation virtual în interiorul acelui cont, în funcție de implementarea Money.

Exemplu:

```text
Chase actual balance     £2,400

Available                £1,350
Tax reserved               £700
Vehicle reserved           £250
Other reserved             £100
```

Trebuie să poată exista și o obligație de rezervă încă nefinanțată pentru că
banii sunt încă ținuți de platformă:

```text
Tax required              £25
Tax funded                 £0
Awaiting settlement       £25
```

`Required` nu este prezentat ca și cum ar fi deja cash pus deoparte.

Regulile de funding/allocation ale rezervelor sunt configurabile și versionate,
nu `if`-uri hardcodate pe categorii.

Exemplu de regulă:

```text
Rule: Vehicle maintenance
Applies to: Expense
Categories: MOT, Service, Repair, Tyres
Funding source: Vehicle Reserve
Effective from: [date]
Active: Yes
```

Rate precum vehicle reserve per business mile/km sunt tot configurație cu
effective dating, nu constante în cod.

### 13.3 Transactions

Tipuri de bază:

- income;
- expense;
- transfer;
- refund;
- salary;
- dividend;
- debt payment;
- adjustment numai dacă există motiv explicit.

Transferul dintre două conturi controlate ale aceluiași owner nu este
income/expense.

Settlement-ul unei platforme de delivery este tratat separat de acest caz:
platform-held pending balance nu este modelat ca încă un bank account controlat.
La settlement sistemul trebuie să păstreze relația dintre earnings pending și
banii efectiv received, fără dublare.

### 13.4 Bills / commitments

- rent;
- subscriptions;
- insurance;
- phone;
- finance agreements;
- tax obligations;
- alte plăți recurente sau viitoare.

### 13.5 Budgets

Bugetele pot exista pe contexte reale:

- personal monthly budget;
- Area budget;
- Project budget;
- business budget.

Exemple: groceries, ACHU marketing, Delivery costs, 12-week cut.

### 13.6 Metrici financiare

`Available`, `Committed`, `Safe to spend` sau alte metrici apar numai după ce
există accounts, transactions, commitments și formule definite corect.
Nu se copiază valori din mockup.

---

## 14. TAX — personal și company fără amestec

Tax este o zonă specializată din Money.

### 14.1 Personal / Self Assessment

Poziția fiscală personală trebuie să poată agrega, după regulile anului fiscal
relevant:

```text
Employment PAYE income
        +
Self-employed / Gig profit
        +
Dividends
        +
Other relevant taxable personal income
        ↓
Personal tax position
```

Trebuie să țină cont, când datele există, de:

- personal allowance;
- PAYE tax already deducted;
- self-employed profit;
- dividend income;
- income tax;
- NI relevant;
- payments on account;
- paid / remaining;
- deadlines.

### 14.2 Company tax

Corporation Tax și alte obligații ale ACHU sunt ale companiei și **nu se bagă
în Self Assessment-ul personal**.

### 14.3 Regula pentru formule fiscale

Planul definește relațiile, nu îngheață cifre fiscale în timp. Ratele,
threshold-urile și formulele trebuie versionate pe tax year și susținute de
surse/reguli reale. Nu se ghicesc și nu se copiază dintr-un exemplu vechi.

Distincția Delivery/Money dintre `earned`, `held by platform` și `received`
servește vizibilității financiare a utilizatorului. Ea nu decide singură când
HMRC consideră un venit recunoscut fiscal. Tax aplică regulile relevante pentru
tax year și metoda contabilă aplicabilă, fără ca Delivery să hardcodeze această
decizie.

---

## 15. Vehicles

Mașina există o singură dată ca Entity/Asset.

Delivery poate lega shift-uri, mileage, fuel și expenses de această entitate,
dar nu deține o copie proprie a mașinii. MOT, insurance, service, documents,
reminders și istoricul asset-ului rămân datele comune ale Vehicle view.

Pagina unui vehicle poate agrega:

- registration;
- make/model;
- fuel type;
- odometer;
- MOT due;
- road tax due;
- insurance due;
- service due;
- oil change / oil due mileage;
- related expenses;
- related documents;
- reminders;
- work vs personal usage;
- linked companies, policies și tasks.

Exemplu:

```text
MY CAR

MOT          21 Nov
Road tax     01 Dec
Insurance    20 Sep
Service      due in 2,300 miles

Recent expenses
Fuel         £70   → Multi-App Delivery
Service      £320  → Multi-App Delivery
Car wash     £18   → Personal
```

Cheltuiala poate aparține Delivery, dar este în același timp **despre mașină**.
Aceste dimensiuni nu se exclud.

---

## 16. People / Contacts / Companies

Life CC trebuie să aibă o experiență completă pentru relațiile reale, dincolo
de un generic `Things`.

Un contact poate fi:

- person;
- company;
- client;
- employer;
- accountant;
- insurer;
- landlord;
- GP;
- supplier etc.

Date posibile:

- phone;
- email;
- addresses;
- notes;
- documents;
- tasks;
- events;
- payments;
- related projects;
- related Areas;
- history.

Exemplu: o companie de asigurări poate fi legată de vehicle, policy document,
renewal action și expense fără duplicare.

---

## 17. Projects

Un Project are un rezultat finit și aparține de regulă unei Area.

Poate conține:

- desired outcome;
- status;
- start / target end;
- tasks / next actions;
- milestones;
- people / companies;
- budget;
- files;
- notes;
- events;
- linked goals.

Home nu trebuie să arate tot proiectul; arată numai ce cere atenție acum.

---

## 18. Goals

Goal este rezultatul urmărit, nu lista de pași.

Exemple:

- Emergency fund £5,000;
- 10 recurring ACHU clients;
- 78 kg;
- Bench 100 kg;
- English C1.

Un goal poate avea:

- target;
- current value;
- deadline;
- Area;
- related Projects;
- milestones;
- tracking history.

Exemplu:

```text
GOAL: 78 kg
Current: 84.2 kg
Target: 78 kg
Deadline: 1 Dec

Project: 12-week cut
Today: Push workout / nutrition target / steps
```

---

## 19. HEALTH — un domeniu complet, nu un habit tracker minimal

Health trebuie să poată funcționa ca o aplicație serioasă în interiorul Life CC.

Structura țintă:

> **Overview | Gym | Nutrition | Progress**

### 19.1 Gym

Funcții țintă:

- exercise library;
- workout plans;
- workout templates;
- scheduled workouts;
- sets;
- reps;
- weight;
- RPE/RIR dacă este folosit;
- rest timer;
- notes;
- PRs;
- exercise history;
- progression;
- volume;
- previous workout comparison.

Exemplu de Today:

```text
TODAY — PUSH

Bench Press
Last: 80 kg × 8
Target: 80 kg × 9

Incline DB
...

Start Workout
```

Workout-ul salvat rămâne în Health history și poate apărea și în Calendar / Home.

### 19.2 Nutrition

Ținta poate include:

- calorie target;
- protein / carbs / fats;
- meal plan;
- meals;
- favourite meals;
- food diary;
- weight goal;
- shopping list;
- meal prep;
- water.

Un nutrition plan poate fi legat de un Goal sau Project, de exemplu `12-week
cut`.

### 19.3 Health tracking

Pe măsură ce devine necesar:

- weight;
- waist / measurements;
- progress photos;
- sleep;
- steps;
- resting HR;
- blood pressure sau alte valori numai dacă utilizatorul chiar le urmărește.

Nu se construiește toată infrastructura din prima doar fiindcă este posibilă.

---

## 20. Reminders

Reminders sunt un serviciu comun întregii aplicații.

Se pot lega de:

- task;
- event;
- bill;
- MOT;
- insurance;
- project milestone;
- workout;
- weigh-in;
- document expiry;
- person/company;
- tax deadline;
- orice alt obiect care are nevoie să revină în atenție.

Exemplu:

```text
Insurance expires 20 Sep
Remind: 30 days before / 7 days before / 1 day before
```

Un reminder ratat nu trebuie să dispară în tăcere; obiectul trebuie să poată
intra în Attention până este rezolvat sau reprocesat.

Canalul tehnic exact al notificării este o decizie de implementare separată,
dar modelul de produs este comun.

---

## 21. Inbox — intrarea universală

Inbox este **intrarea**, nu o categorie de viață.

Utilizatorul trebuie să poată captura rapid:

- `Admiral insurance £740 due 20 September`;
- `Call accountant Monday`;
- `Spent £65 diesel today for delivery`;
- `Goal: bench 100 kg by December`.

Nu trebuie să decidă înainte în ce „modul” intră informația.

Fluxul este:

```text
CAPTURE → INBOX → PROCESS → LINK → ACT / TRACK / ARCHIVE
```

Pe viitor, aceeași intrare universală poate primi:

- text;
- voice;
- receipt photo;
- PDF;
- scan;
- forwarded email.

Aceste extensii se construiesc numai când există flux complet pentru ele.

---

## 22. Files / Documents

Un document trebuie să fie legat de lucrul despre care este, nu duplicat în
foldere separate ale fiecărui modul.

Exemple:

- insurance policy → Vehicle + Insurer + Renewal;
- payslip → Employer + Employment period + PAYE + Tax year;
- ACHU invoice → ACHU + Client + Income + Job/Project.

Storage-ul se implementează când există primul flux real complet de documente.

---

## 23. Exemplu complet de legare

```text
£350 SERVICE

Type        Expense
Account     Personal Current
Area        Multi-App Delivery
Vehicle     My Car
Category    Maintenance
Business %  80%
Date        6 Sep
```

Aceeași intrare poate afecta:

- Delivery profit;
- Vehicle history;
- monthly spending;
- budget;
- HMRC / tax records;
- account cash position.

**O intrare. Mai multe perspective.** Asta este Life CC.

---

## 24. Mockup-uri, cifre și metrici

Mockup-urile descriu structură și intenție, nu creează automat date sau formule.

O cifră precum `£1,840`, `72%` sau `3 lucruri` este exemplu dacă nu este declarată
explicit ca cerință sau formulă.

Nu se construiește un sold bancar, `Safe to spend`, procent de „sănătate a
ariei” sau altă metrică doar pentru că apare într-un desen.

Când datele reale există, ecranul le folosește. Când nu există, nu minte.

---

## 25. Fundația tehnică

`items` rămâne coloana comună pentru lucrurile care trebuie urmărite și legate.

Principii obligatorii:

- fără DELETE fizic din client;
- ownership verificat prin RLS;
- coloanele de identitate/versionare nu sunt controlate liber de client;
- `done_at` reprezintă ce s-a întâmplat, `due` ce a fost planificat;
- Inbox înseamnă „încă neprocesat”, nu un tip artificial de obiect;
- datele de domeniu stau în extensii ale itemului când sunt necesare;
- links folosesc ownership compatibil la ambele capete;
- repository-ul rămâne singura cale de date pentru UI.

Repository-ul este responsabil pentru:

- citire completă și delta fără pierderea snapshot-ului;
- paginare;
- cache per utilizator;
- patch-uri;
- conflict/version handling;
- soft-delete;
- filtrare comună;
- export complet.

Un fetch eșuat nu golește cache-ul. Un delta gol înseamnă „nimic nou”, nu
„șterge tot”. Un snapshot complet și valid poate fi gol.

---

## 26. Offline adevărat

Când este construit, offline înseamnă complet:

- scrieri fără internet;
- outbox;
- drafturi persistate;
- retry;
- rezolvare de conflicte;
- lifecycle de update pentru aplicație.

Până atunci UI spune adevărul despre ce este și ce nu este salvat.

---

## 27. Ordinea de construcție

Ordinea trebuie păstrată ca să nu mai apară module fără hartă mentală.

### FAZA 1 — Reorganizarea produsului

Fără avalanșă de feature-uri noi. **Excepția explicită este Journal MVP**, care
este cerință de bază și trebuie implementat de la început.

- stabilim experiența `Home / Plan / Areas / Money`;
- eliminăm `Things` ca termen principal de UI;
- HMRC intră semantic în Money / Tax;
- clarificăm peste tot Area vs Project vs Goal vs Entity;
- păstrăm datele existente și le reexpunem coerent;
- implementăm Journal MVP conform secțiunii 33.

### FAZA 2 — Areas reale

- Work → Gig Work → Multi-App Delivery;
- Work → Employment;
- Work → Business → ACHU LTD;
- Health;
- Home & Life Admin;
- Personal Finance;
- alte Areas numai după nevoi reale.

### FAZA 3 — Money Core

- accounts;
- transactions;
- income / expenses;
- transfers;
- reserves: required vs funded și legătura cu bani reali;
- platform settlement / received money fără a transforma platform-held balance
  într-un bank account controlat;
- bills / commitments;
- budgets;
- owner personal vs company.

### FAZA 4 — Income & Tax

- Gig / self-employed;
- Employment / PAYE;
- dividends;
- ACHU company side;
- Self Assessment personal;
- company tax obligations separat.

### FAZA 5 — Projects + Goals + Reminders

Construim ciclul complet, nu doar ecrane izolate.

### FAZA 6 — Contacts + Documents

People, Companies, Files și istoricul lor legat de Life Core.

### FAZA 7 — Health OS

- Gym complet;
- Nutrition;
- Progress / tracking;
- health goals;
- Daily Focus integration.

### FAZA 8 — Home final

După ce sursele de date există, Home agregă real:

- Attention;
- Today;
- Next Actions;
- Waiting;
- Money;
- Goals;
- Health;
- Areas;
- Daily Focus.

Home final nu se construiește cu cifre inventate pentru module care încă nu
există.

---

## 28. Ce nu construim implicit

Nu adăugăm fără nevoie reală:

- event sourcing;
- audit log complet;
- framework generic de sync;
- tabele „pentru viitor”;
- metrici fără definiție;
- duplicate ale acelorași date între module;
- a doua aplicație sau a doua cale de scriere pentru același adevăr;
- categorii și sub-areas doar ca să pară sistemul complet;
- AI ca dependență pentru funcții care pot fi robuste fără el.

„Configuration over hardcoding” nu justifică un meta-framework construit fără
cazuri reale. Se adaugă configurația necesară pentru reguli reale, nu o limbă de
programare generică în baza de date.

---

## 29. Regula înainte de orice feature nou

Înainte de implementare trebuie să putem răspunde scurt:

1. Ce obiect Life Core este?
2. Care este Area / Project context?
3. Cu ce Entity / Resource se poate lega?
4. Unde îl găsesc după ce l-am creat?
5. Ce alte vederi trebuie să-l reflecte?
6. Are efect financiar, temporal sau de reminder?
7. Există deja același adevăr în altă parte?
8. Ce parte este invariantă de cod și ce parte este configurație schimbătoare?

Dacă răspunsurile nu sunt clare, nu se construiește încă un modul izolat.

---

## 30. Decision log — decizii de produs confirmate

Această secțiune ține numai deciziile de produs care trebuie să rămână stabile.
Istoria tehnică nu se copiază aici.

### Confirmate

- Life CC este un Life OS, nu o colecție de aplicații independente.
- Navigația mentală țintă este `Home / Plan / Areas / Money`.
- Areas sunt responsabilități continue; Projects sunt finite; Goals sunt ținte.
- `Things` nu rămâne termen principal de navigație.
- Vehicle este Entity/Asset, nu Area.
- Delivery este Area/domain; expenses pot fi legate simultan de Delivery și
  Vehicle.
- Gig Work, Employment și Business sunt contexte diferite sub Work.
- ACHU ca business și proprietarul ca persoană sunt două contexte financiare
  separate, legate prin fluxuri reale precum salary/dividends.
- PAYE, self-employed income/profit și dividends pot contribui la poziția
  fiscală personală; company tax rămâne separat.
- Accounts au owner explicit personal sau business.
- Budgets fac parte din Money.
- Health trebuie să includă Gym, Nutrition și Progress/Tracking ca experiență
  serioasă, nu doar habits minimale.
- Reminders sunt un serviciu comun, nu un modul separat.
- Inbox este intrarea universală.
- Journal este o capabilitate personală de bază și intră în Faza 1.
- Daily Focus face parte din Home.
- `PLAN.md` este document viu și sursa de adevăr pentru produsul țintă.
- Configuration over hardcoding: codul oferă motorul și invariabilele; structura
  și regulile schimbătoare ale utilizatorului trăiesc ca date/configurație unde
  pot fi exprimate sigur.
- Platformele de delivery sunt records configurabile, cu propriile earning
  cycles, payout schedules, cash-out behaviour și fees; Uber/Deliveroo/Just Eat
  nu sunt cazuri hardcodate.
- Delivery separă `earned`, `held by platform` și `received`; platform-held
  balance nu este un bank account controlat. Această semantică nu decide singură
  momentul fiscal HMRC.
- Reserves separă suma required de suma actually funded și leagă funding-ul de
  bani reali aflați într-un cont/pot controlat.
- Regulile și ratele schimbătoare sunt effective-dated/versionate și nu rescriu
  automat trecutul.
- Header-ul global normal ține doar titlul ecranului și un control „More";
  utilitățile de cont/export/sync trăiesc în Settings, reachable din More, nu
  pe fiecare ecran de domeniu.
- Journal, Directory și Settings sunt destinații secundare, reachable din
  More — niciodată un al cincilea sau al șaselea tab principal.
- Capture rămâne la o atingere distanță de oriunde, dar ca un control compact
  (minimum 44×44px), nu un bloc ce domină ecranul.

### Decizii încă deschise

Agentul nu le decide singur fără un caz real sau instrucțiune explicită:

- metoda de import/sync pentru tranzacții bancare reale;
- furnizorul și canalul exact pentru push notifications/reminders;
- nivelul exact de automatizare la clasificarea Inbox-ului;
- integrarea cu health/device APIs;
- storage provider și UX final pentru documente;
- schema/ledgerul exact pentru platform settlement, cash-out fees și reserve
  allocations, atât timp cât semantica confirmată mai sus este păstrată;
- orice formulă financiară sau fiscală care depinde de reguli externe
  schimbătoare și nu este încă implementată/versionată.

Când una dintre aceste decizii este luată, se mută în `Confirmate` și se
actualizează secțiunea relevantă a planului.

---

## 31. Cum se menține documentul viu

- Nu se rescrie pentru a face implementarea curentă să pară completă.
- `STAREA.md` se schimbă când se schimbă realitatea implementată.
- `PLAN.md` se schimbă când se schimbă intenția produsului.
- O fază rămâne deschisă până când toate componentele cerute ale fazei sunt
  terminate sau planul este modificat explicit.
- Dacă se implementează doar o felie, documentația spune „felia este gata”, nu
  „obiectivul este gata”.
- Deciziile noi care afectează arhitectura sau comportamentul de produs se
  reflectă aici, astfel încât următoarea sesiune să nu reinventeze produsul.

---

## 32. Definiția scurtă a Life CC

**Areas** spun unde trăiește ceva.  
**Entities** spun despre cine sau ce este.  
**Money** spune ce s-a întâmplat cu banii.  
**Plan** spune ce și când faci.  
**Projects** spun ce încerci să termini.  
**Goals** spun unde vrei să ajungi.  
**Reminders** readuc lucrurile în atenție.  
**Journal** păstrează ce vrei să notezi și să regăsești în timp.  
**Home** le adună pe toate și spune ce contează acum.

Asta este coloana vertebrală a Life Control Centre.

---

## 33. Journal — jurnal personal

Journal este o capabilitate de bază a Life CC și trebuie să existe **din Faza 1**,
nu ca extensie târzie. Este jurnalul personal din aplicație și este complet
separat de `docs/JURNAL.md`, care rămâne document tehnic al repo-ului.

### MVP obligatoriu

- creare foarte rapidă a unei intrări din Home / quick action;
- text liber; titlul este opțional;
- data și ora jurnalizată se completează automat la creare;
- utilizatorul poate schimba data și ora pentru o intrare retrospectivă;
- momentul jurnalizat rămâne distinct semantic de `created_at` și `updated_at`;
- intrările pot fi editate ulterior;
- timeline cronologic;
- căutare în jurnal;
- legături opționale cu Area, Project, Goal, Person, Company, Vehicle sau alte
  Entity relevante;
- o intrare poate exista și fără nicio legătură;
- textul din Journal nu devine automat task, event sau goal doar fiindcă a fost
  scris acolo;
- datele Journal urmează aceeași cale `UI → repository → Supabase`, aceeași
  regulă de ownership, sync și export ca restul Life CC.

Journal nu trebuie să devină obligatoriu un al cincilea concept de navigație
principală. Cerința este să fie **mereu ușor de accesat pentru scriere** și să
existe o experiență clară pentru regăsirea intrărilor.

Mood tracking, AI summaries, tags sofisticate, voice transcription sau alte
extensii nu fac parte din MVP decât dacă sunt aprobate ulterior explicit.
