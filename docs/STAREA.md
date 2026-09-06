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
- Journal — jurnal personal, MVP complet conform PLAN (secțiunea 33);
- Home Quick Actions — configurabile de utilizator, nu hardcodate (detaliat
  mai jos).

Landing-ul actual rămâne fostul `Today`, la ruta `/today`; el este acum
etichetat `Home` în navigație și își păstrează toate funcțiile (Inbox, Today,
Overdue, rezumatul Command Centre). Ce apare pe Home ca acțiune rapidă nu mai
e fixat în cod — vezi „Home Quick Actions" mai jos. `Plan` este un
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

### Areas

Ariile sunt înregistrări obișnuite în baza de date, nu constante din cod: un
arbore configurabil de utilizator, de orice adâncime și cu orice nume, ținut
în tabelul `areas` (owner, parent_id, name), cu chei compuse (id, owner) care
fac structural imposibil ca un arbore să treacă printre doi utilizatori.

- se pot crea la rădăcină sau sub orice arie existentă, direct din ecranul
  Areas;
- se pot redenumi;
- se pot muta sub o altă arie, sau la rădăcină, din ecranul ariei —
  lista de părinți posibili exclude aria însăși și tot ce e dedesubtul ei, iar
  un ciclu mai adânc este refuzat de baza de date;
- se pot șterge (soft-delete); ce era dedesubt dispare din vedere odată cu ea
  și revine dacă aria e restaurată;
- fiecare arie creată are propria rută, `/areas/:id`, unde apare tot ce ține
  de ea.

Nu există niciun caz special legat de un nume de arie în cod: arborele țintă
din plan (Work → Gig Work → Multi-App Delivery, Work → Employment, Work →
Business → ACHU LTD, Health, Home & Life Admin etc.) se poate construi în
întregime din ecranul existent, ca date, fără nicio modificare de cod. Nu
există încă un modul propriu pentru Employment sau ACHU LTD ca business —
doar aria însăși, ca loc unde pot fi puse lucruri.

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

- creare foarte rapidă din Home, prin Quick Action-ul `journal.new` când e
  configurat, direct la un composer focalizat la `/journal` (ecran intern,
  antet „Home · Journal", tab-ul Home rămâne aprins — nu e al cincilea tab);
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

### Home Quick Actions

Home nu mai are trei butoane fixate în cod. Ce apare, în ce ordine, cu ce
context și sub ce nume este configurație a utilizatorului, ținută într-un
tabel propriu, `quick_actions` (owner, `action_key`, `area_id` opțional,
`position`, `label` opțional), cu cursor/sync/cache proprii, RLS și
soft-delete — la fel ca `areas`.

`label` este text opțional, doar afișaj: null înseamnă numele implicit din
cod; un text propriu, curățat de spații și refuzat dacă e gol/doar spații
(normalizat pe client, verificat identic și de o constrângere în bază); nu
schimbă niciodată `action_key` sau comportamentul — pentru `delivery.work`,
starea (Start/Resume/Open) rămâne exclusiv decizia lui `deliveryStateOf`,
eticheta proprie oferă doar subiectul din text.

Codul are un registru finit, sigur, cu trei acțiuni suportate acum:
`journal.new`, `money.expense`, `delivery.work`. Un `action_key` din afara
registrului este refuzat și de baza de date (`check` pe coloană) și de
`fromRow` la parsare — nu ajunge niciodată să fie „executat".

- fiecare acțiune configurată se poate adăuga, ascunde/elimina (soft-delete)
  și reordona (mutare sus/jos) dintr-un ecran propriu, `/quick-actions`,
  reachable din Home; o mutare este o singură scriere cu verificare de
  versiune, pe rândul mutat — `position` e un rang (`double precision`), nu
  un index care ar cere schimbarea a două rânduri deodată, așa că un
  conflict pe acea singură scriere nu poate lăsa ordinea pe jumătate
  schimbată; ordinea afișată sortează după `position` și, la egalitate
  (de exemplu două adăugări simultane de pe două dispozitive), după `id` —
  niciodată după ordinea rândurilor din cache — iar o mutare care ar cădea
  exact pe o egalitate deja existentă este refuzată curat, nu prefăcută;
- fără nicio Quick Action configurată, Home nu inventează un set implicit și
  nu arată acțiuni de domeniu — arată o legătură clară spre configurare;
- `delivery.work` cere o Arie aleasă la configurare (`area_id`); baza refuză
  un rând `delivery.work` fără arie și un rând non-delivery cu arie
  (`check` pe coloană, oglindit în `fromRow`); nu există nicio potrivire
  după numele ariei (Delivery, Multi-App Delivery, Gig Work etc.) — numele
  rămâne pur și simplu date ale utilizatorului;
- pentru `delivery.work`, starea zilei se rezolvă după zi **și** aria
  configurată, niciodată doar după dată: „Start delivery work" (nu există
  încă un shift azi în acea arie — creează shift-ul și îi pornește imediat
  prima sesiune, apoi îl deschide), „Resume delivery work" (shift-ul zilei
  există, nimeni nu e „out" — pornește o sesiune nouă, apoi deschide),
  „Open delivery shift" (o sesiune e deja pornită **sau** starea sesiunii nu
  se poate confirma local încă — niciodată nu pornește o sesiune nouă dintr-o
  stare necunoscută; doar deschide);
- dacă aria configurată pentru `delivery.work` nu mai există în arborele viu
  (ștearsă, sau ascunsă pentru că un strămoș e șters), acțiunea nu se
  execută deloc — Home arată o legătură spre `/quick-actions` în locul
  butonului, iar acolo aria se poate schimba direct pe rândul deja
  configurat (fără să ștergi acțiunea și să ghicești ce avea înainte);
- o eroare la „Start"/„Resume delivery work" apare vizibil pe Home, sub
  butoane — aplicația nu pretinde niciodată că tura sau sesiunea a pornit
  când scrierea a eșuat;
- clock-on (din Quick Action sau din interiorul turei) recuperează singur
  un shift care are ancora dar nu și extensia (`shifts`), scriind-o mai
  întâi, idempotent — nu pornește sesiunea dacă acest pas eșuează; ambele
  cazuri folosesc aceeași secvență (`runStartSessionSafely`): asigură
  extensia, pornește sesiunea, apoi o singură sincronizare completă — nu
  câte una pentru fiecare scriere;
- dacă sesiunea chiar a pornit pe server dar doar sincronizarea finală
  eșuează (rețea, cache local), scrierea nu este raportată ca eșuată — un
  semnal dedicat (`SyncPending`) cere o resincronizare ulterioară prin
  arhitectura de sync deja existentă, la fel cum `NotCached` o face pentru
  celelalte scrieri; o a doua sesiune nu se pornește niciodată pe baza
  acestui semnal;
- migrația din repo adaugă / schema țintă va impune, la nivel de schemă: cel
  mult o tură vie pe owner+zi+arie, și cel mult o sesiune deschisă pe tură —
  migrație separată, nu o editare a celei deja live (nu este încă aplicată
  live — vezi mai jos);
- „Download everything" include acum și configurația Quick Actions întreagă
  (inclusiv rândurile șterse soft) — `exportFile`/`exportAll` citesc și
  `quick_actions`, alături de `items` și `journal_entries`, în același
  fișier; nu e duplicată în `items`.

Există în repo două fișiere de migrație, complete și explicit atomice
(`BEGIN`/`COMMIT` scrise în fișier, nu presupuse):

- `20260906050000_quick_actions` — tabelul `quick_actions` însuși;
- `20260906060000_shift_invariants` — cele două invariante de mai sus.

**`20260906050000_quick_actions` este aplicată pe baza live**, aprobată
explicit de proprietar și aplicată live în afara acestei sesiuni.
`docs/MIGRATII.md` o ține acum ca aplicată (6 sep 2026), cu nota despre
discrepanța de timestamp față de istoricul de migrații Supabase. Tabelul
`quick_actions` există deci pe live, și configurația Quick Actions se poate
scrie și citi acolo.

**Implementarea frontend a acestui task (Phase 2B) este deja pe producție.**
Vercel production rulează deja commit-ul
`10d6e92b5b7b050689232b7f44aa2a968e302fc2`, cu deployment-ul în stare READY.
Nu mai există un deploy de frontend care așteaptă `shift_invariants` — codul
e deja livrat; ce lipsește este strict invarianta de bază de mai jos.

**`20260906060000_shift_invariants` rămâne neaplicată.** Nu poate fi aplicată
azi fără o decizie separată: un read-only check pe baza live a găsit o tură
(owner+zi+arie, data 2026-09-05) cu **cincisprezece** `shift_sessions` cu
`ended_at IS NULL` simultan — indexul unic
`shift_sessions_one_open_per_shift` ar refuza exact acest caz. Cele
cincisprezece rânduri rămân neatinse; alegerea sesiunii „reale" dintre ele
este o decizie a proprietarului, nu ceva de decis sau executat automat aici.

Ordinea corectă rămasă, doar pe partea de bază de date: proprietarul decide
cum se repară cele cincisprezece sesiuni deschise → aprobare explicită pentru
reparația de date → reparația chiar rulează → `20260906060000_shift_invariants`
rulează pe live → `docs/MIGRATII.md`/`docs/PROGRESS.md`/acest document se
actualizează din nou cu starea live reală. Fără a doua migrație, baza nu
garantează încă cele două invariante (o singură tură vie pe zi/Arie, o
singură sesiune deschisă) — criteriul corespunzător din `docs/PROGRESS.md`
rămâne `PARTIAL`, nu `DONE`, exact din acest motiv, chiar dacă frontend-ul
este deja livrat.

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
