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

### Platforms

Uber Eats, Deliveroo, Just Eat și alte platforme sunt Companies / income
sources. Nu devin automat Areas separate.

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

### 13.2 Transactions

Tipuri de bază:

- income;
- expense;
- transfer;
- refund;
- salary;
- dividend;
- debt payment;
- adjustment numai dacă există motiv explicit.

Transferul dintre două conturi ale aceluiași owner nu este income/expense.

### 13.3 Bills / commitments

- rent;
- subscriptions;
- insurance;
- phone;
- finance agreements;
- tax obligations;
- alte plăți recurente sau viitoare.

### 13.4 Budgets

Bugetele pot exista pe contexte reale:

- personal monthly budget;
- Area budget;
- Project budget;
- business budget.

Exemple: groceries, ACHU marketing, Delivery costs, 12-week cut.

### 13.5 Metrici financiare

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

---

## 15. Vehicles

Mașina există o singură dată ca Entity/Asset.

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

Fără avalanșă de feature-uri noi.

- stabilim experiența `Home / Plan / Areas / Money`;
- eliminăm `Things` ca termen principal de UI;
- HMRC intră semantic în Money / Tax;
- clarificăm peste tot Area vs Project vs Goal vs Entity;
- păstrăm datele existente și le reexpunem coerent.

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
- Daily Focus face parte din Home.
- `PLAN.md` este document viu și sursa de adevăr pentru produsul țintă.

### Decizii încă deschise

Agentul nu le decide singur fără un caz real sau instrucțiune explicită:

- metoda de import/sync pentru tranzacții bancare reale;
- furnizorul și canalul exact pentru push notifications/reminders;
- nivelul exact de automatizare la clasificarea Inbox-ului;
- integrarea cu health/device APIs;
- storage provider și UX final pentru documente;
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
**Home** le adună pe toate și spune ce contează acum.

Asta este coloana vertebrală a Life Control Centre.
