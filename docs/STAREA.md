# Starea curentă

**Actualizat:** 6 septembrie 2026.

Documentul ăsta spune numai ce există și ce lipsește **acum**. Nu ține istorie,
procente de progres sau explicații despre cum s-a ajuns aici.

## Ce există

### Nucleu și navigare

- autentificare cu email/parolă;
- snapshot/cache și sincronizare prin repository;
- export complet al datelor;
- navigația principală exprimă harta mentală țintă: Home / Plan / Areas /
  Money;
- ecran de arie;
- HMRC, expus acum ca `Tax` sub Money;
- Things (Person/Company/Vehicle/Property), etichetat clar în header ca
  „People, Companies, Vehicles & Property" și accesibil de acolo, nu din
  navigația principală;
- Journal — jurnal personal, MVP complet conform PLAN (secțiunea 33).

Landing-ul actual rămâne fostul `Today`, la ruta `/today`; el este acum
etichetat `Home` în navigație și își păstrează toate funcțiile (Inbox, Today,
Overdue, rezumatul Command Centre, Start shift, Money out). `Plan` este un
ecran nou cu Tasks (orice task activ, indiferent de dată — inclusiv cele
programate în viitor, nu doar due azi/overdue/nedatate) și Waiting, plus o
intrare spre Calendar (rămas ecran propriu la `/calendar`). `Money` este un
ecran nou care arată anul fiscal curent (Made/Put aside/Left, calculat printr-un
singur selector comun cu Home, `currentYearMoney`) și o intrare spre `Tax`
(fostul ecran HMRC, rută `/hmrc` neschimbată). Amândouă arată „Loading…" cât
timp snapshotul inițial nu s-a încărcat, ca să nu afișeze liste goale sau
£0.00 false. Când ești pe Calendar sau pe Tax, antetul și bara de jos arată
în continuare contextul corect (`Plan · Calendar`, respectiv
`Money · Tax`, cu tab-ul părinte aprins). Niciunul dintre aceste ecrane nu
introduce date sau modele noi — reexpun ce exista deja.

### Items

Ciclul principal există: capture/inbox → procesare → active → done → reopen →
soft-delete.

Calendarul și Today folosesc aceleași obiecte, nu copii separate.

Un item activ poate fi marcat ca „waiting" — aștepți un răspuns de la
altcineva. Nu este o a patra stare a ciclului: itemul rămâne `active` și ajunge
la `done` la fel ca oricare altul. E un singur câmp în plus, `waiting_since`,
o dată, la fel cum `due` este deja.

### Life Core

Există `Entity` și `links`.

Tipurile de Entity implementate acum sunt:

- person;
- company;
- property;
- vehicle.

Legăturile sunt item ↔ item și tipurile implementate acum sunt `about` și
`pays`.

### Journal

Jurnalul personal există complet, capăt la capăt: UI → repository →
Supabase → sync/cache → export, cu migrație și RLS proprii.

Ancora este un item nou, `kind='journal'`, permanent `active`, fără
due/done/waiting — exclus explicit din Today, Tasks, Waiting și Calendar.
Textul, titlul opțional și `journaled_at` (dată+oră) stau într-un tabel de
extensie propriu, `journal_entries`, cheiat pe `item_id`, la fel ca la
entities/expenses.

- creare foarte rapidă din Home (`Journal`, lângă Start a shift/Money out),
  direct la un composer focalizat la `/journal` (ecran intern, antet
  „Home · Journal", tab-ul Home rămâne aprins — nu e al cincilea tab);
- titlul introdus de utilizator e opțional; când lipsește, ancora primește un
  titlu derivat din prima linie a textului — detaliu intern, invizibil în UI;
- `journaled_at` se completează automat la creare și e editabil pentru o
  intrare retrospectivă; distinct semantic de `created_at`/`updated_at`;
- intrările sunt editabile ulterior, redeschizând din timeline;
- timeline cronologic (cea mai recentă intrare jurnalizată prima, nu cea mai
  recent creată) și căutare în titlu + text;
- o intrare poate exista fără nicio legătură; opțional poate primi o Arie (la
  creare) și legături `about`/`pays` către orice alt item (Person/Company/
  Vehicle/Property inclusiv), prin `links`-ul existent — fără mecanism nou;
- „Download everything" include acum textul jurnalului întreg (titlu, body,
  `journaled_at`), nu doar ancora — `exportFile`/`exportAll` citesc și
  `journal_entries`, alături de `items`, în același fișier.

### Vehicle

Vehicle are deja suport pentru:

- registration;
- make/model;
- fuel;
- odometer;
- MOT due;
- road tax due;
- insurance due;
- service due;
- oil change / oil due mileage.

Deci afirmațiile vechi „nu există modul pentru mașină” nu mai sunt adevărate.

### Delivery / Work

Există domeniul de livrări cu:

- shifts;
- shift sessions;
- earnings pe platforme;
- tips;
- kilometri de lucru și personali;
- expenses;
- fuel/full-tank tracking;
- business-use percentage;
- HMRC/tax-year calculations.

Din aplicația de referință au fost adoptate și câmpuri pentru:

- other platform earnings;
- bonuses;
- parking;
- tolls;
- other shift cost;
- break minutes;
- litres;
- expense coverage dates.

Plinurile pot ține litri; documentația veche care spunea contrariul era stale.

### Command Centre — partea existentă

Rezumatul din Today poate arăta date reale pentru:

- overdue;
- lucruri apropiate;
- inbox neprocesat;
- waiting — itemii activi care așteaptă pe altcineva, cel mai vechi întâi;
- tax-year `Made / Put aside / Left`.

Nu se consideră implementate doar pentru că au apărut într-un mockup:

- sold bancar / `Available`;
- `Committed` / `Safe to spend`;
- procente de progres ale ariilor.

Acestea cer date și definiții reale înainte să apară ca metrici.

## Ce lipsește încă din Life CC complet

- Home / Command Centre complet cu toate secțiunile țintă;
- Event ca obiect de produs complet, separat de simpla dată a unui item;
- Resource ca strat comun pentru bani/assets/informație;
- Files/Documents;
- People/Contacts ca experiență completă, dincolo de Entity;
- debts/bills ca flux complet;
- goals;
- health/habits/tracking;
- offline complet cu outbox și drafturi persistate.

Modulele viitoare trebuie să se lege de Life Core; nu se construiesc ca
aplicații paralele.

## Drift / blocaje cunoscute

- baza live este urmărită separat în `docs/MIGRATII.md`;
- `reserves` este declarat acolo ca drift live rămas după o reparație manuală;
- turele și ratele pot fi încă asociate unor containere de arie unde semantic
  nu au sens; validarea de domeniu nu este completă.

Pentru istorie: `docs/JURNAL.md` și `docs/audits/`.
Pentru produsul țintă: `docs/PLAN.md`.
