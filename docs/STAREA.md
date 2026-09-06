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
  Money, exact patru tab-uri;
- header-ul global normal e curat: doar titlul ecranului curent și un control
  compact „More" (minimum 44px); email de cont, Sign out, resync și Download
  everything nu mai apar pe fiecare ecran — au un loc propriu, Settings;
- „More" e o foaie secundară cu exact trei uși: Journal, Directory, Settings —
  niciun al cincilea tab;
- Settings (`/settings`) ține utilitățile globale reexpuse, fără logică nouă:
  email de cont, status sync, „Sync again", link spre configurare Quick
  Actions, „Download everything", Sign out;
- încrederea în sync rămâne vizibilă fără să ocupe header-ul: sănătos, nu ține
  loc; cu o problemă reală, header-ul arată o afordanță compactă spre
  Settings — niciun eșec de sync nu e ascuns tăcut;
- Capture universal, la o atingere distanță, dar compact (buton „+", minimum
  44×44px) — nu mai domină ecranul cu un bloc pe toată lățimea;
- ecran de arie, cu context corect în header/bara de jos (`/areas/:id` ține
  tab-ul Areas aprins și titlul „Areas", fără să cadă pe titlul generic);
- HMRC, expus acum ca `Tax` sub Money;
- Directory (`/things` neschimbat ca rută/model intern) — People / Companies /
  Vehicles / Properties explicit ca secțiuni, fără cuvântul „thing" în UX;
  reachable din More, nu din navigația principală;
- Journal — jurnal personal, MVP complet conform PLAN (secțiunea 33);
  reachable din More, rămâne semantic parte din Home;
- Home Quick Actions — configurabile de utilizator, nu hardcodate (detaliat
  mai jos); configurarea rămâne reachable atât din Home cât și din Settings.

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
`Money · Tax`, cu tab-ul părinte aprins); la fel și pe pagina unei arii
(`/areas/:id`), unde antetul spune acum „Areas" (nu titlul generic vechi) și
tab-ul Areas rămâne aprins, în timp ce AreaScreen însuși continuă să arate
calea/numele real al ariei. Niciunul dintre aceste ecrane nu introduce date
sau modele noi — reexpun ce exista deja.

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

Workday-ul (sheet-ul unui `Item` de kind `shift`) are acum un lifecycle clar,
recuperat din vechiul Delivery Hub Manager ca funcționalitate, nu ca arhitectură:

- **Draft / Completed**, pe `item.state` existent (`active`/`done`) — fără
  status paralel nou. Draft e complet editabil: title, date, Area, sesiuni,
  câștiguri, odometru, costuri de drum. Completed e read-only pentru datele
  operaționale, fără Start/Resume, dar rămâne descoperibil normal.
- Formularul editează întâi o stare locală (draft); preview-ul de sus (Made,
  Roughly yours, Worked, Driven, Fuel and wear, road costs, Tax and NI) se
  recalculează imediat din acea stare locală, la fiecare tastă, folosind
  exact `takeHome`/`kilometres`/`minutesWorked` — aceeași logică pe care o
  folosește și varianta persistată, nu o formulă separată pentru preview.
  Nimic nu se scrie pe server până la „Save draft” sau „Complete workday”.
  Dacă sheet-ul e închis cu modificări nesalvate, apare o confirmare explicită
  înainte să fie pierdute.
- Cât timp e Draft, costul folosit de preview este rata curentă a Ariei
  arătate în formular (automat pentru fuel, configurat pentru vehicle),
  niciodată rata veche pinuită pe rândul `shifts` — schimbarea Ariei în draft
  nu poate arăta o rată calculată pentru ea în timp ce totalul încă socotește
  cu rata Ariei vechi. Odată Completed, exact rata pinuită a turei rămâne
  folosită, înghețată, indiferent ce se schimbă ulterior în configurarea
  Ariei.
- Slice-ul de tax/NI folosit de preview urmărește data din draft, nu data
  încă persistată — mutarea datei recalculează imediat Tax/NI/Roughly yours.
  Profitul propriu al turei editate este exclus din „ce a făcut anul înainte
  de asta” (`before`), ca să nu se numere de două ori când data ei traversează
  un prag din an.
- „Start”/„Stop” rămân singurele acțiuni imediate (scriu direct sesiunea);
  totul altceva e Save draft/Complete workday — inclusiv ștergerea unei
  sesiuni greșite (×), care marchează sesiunea pentru ștergere în draft și o
  șterge abia la Save draft/Complete workday, nu la click. × apare **numai**
  pe o sesiune deja închisă (`ended_at` setat) — o sesiune deschisă nu poate
  fi niciodată marcată pentru ștergere din draft, nici măcar din date de
  draft malformate: `saveWorkday` refuză defensiv orice id de sesiune
  deschisă găsit acolo, nu doar UI-ul.
- „Stop” închide numai sesiunea curentă. Cu exact o sesiune deschisă, apare
  „Stop” (nu „Start”), fără ×; cu **două sau mai multe** sesiuni deschise
  simultan — incidentul cunoscut din live — nu apare nici „Start”, nici
  „Stop”, nici ×, nici Complete, nici Delete: apare mesajul „Multiple active
  sessions were found. This workday needs data repair before it can
  continue.” Nimic nu alege automat „sesiunea reală” dintre ele.
  „Complete workday” e o acțiune separată și explicită, blocată cu mesaj
  clar („Stop the active session first.” pentru o sesiune, mesajul de mai sus
  pentru ambiguitate) — la fel și „Delete workday” (soft-delete pe ancoră, ca
  oriunde în Life Core, și închide sheet-ul numai la succes). Nicio oră de
  final nu e inventată — vine numai din sesiunea reală, închisă prin Stop.
- Validarea pentru Complete Workday e separată de validarea pentru Save
  draft. Save draft rămâne permisiv — un Draft incomplet se salvează exact
  cum e tastat. Complete Workday cere în plus: dată nevidă, cel puțin o
  sesiune de lucru încheiată, ambele citiri de odometru, rata automată de
  fuel cunoscută și rata vehicle configurată — verificate separat
  (`validateCompletion`), afișate distinct în sheet. Anul fiscal (HMRC) nu e
  cerut pentru Complete — un an nesetat rămâne vizibil doar ca „missing” pe
  rezumat, nu blochează finalizarea zilei.
- Data unui Workday se editează ca `due` pe aceeași ancoră (nu se creează un
  al doilea shift) — mutarea pe altă zi îl scoate/introduce corect din
  Overdue/ziua respectivă, prin filtrele generice deja existente.
- „Fuel £/km” nu mai e input manual în Workday: se citește automat din
  calculul full-tank-to-full-tank existent (`fuelRateForArea`, peste
  `fuelRate`/`fillsOf`), afișat „Automatic · £x.xxxx/km” sau „Not enough
  full-tank data yet” — niciodată £0 ca și cum ar fi un cost real. „Vehicle
  £/km” rămâne o configurare a Ariei (`running_costs`), mutată într-o acțiune
  secundară „Configure vehicle cost”, care se resetează corect la valoarea
  Ariei curente când Aria draft-ului se schimbă (remount pe cheia Ariei),
  nu mai apare ca input banal al turei zilnice.
- Un câștig salvat pe o platformă poate fi șters efectiv (nu doar golit
  vizual): golirea casetei și Save draft șterge rândul `shift_earnings`
  corespunzător, nu scrie un £0 fals — „necunoscut” rămâne diferit de „zero”.

Repo-ul poate acum randa componente React în teste. `jsdom` este devDependency
(vitest rămâne pe `environment: 'node'` global, ca să nu încetinească restul
suitei; fișierele care chiar randează pun `// @vitest-environment jsdom` în
capul fișierului). Nu s-a adăugat `@testing-library/react` — un helper mic,
`src/shifts/domTestHelpers.ts`, montează prin `react-dom/client` direct.
Exemple: `ShiftHours.test.tsx`, `DrivingCostBasis.test.tsx`,
`ShiftActions.test.tsx`, `ShiftSheet.test.tsx` (acesta din urmă randează
sheet-ul întreg pentru Delete succes/eșec/blocat, cu `MemoryRouter` în jur —
`ShiftSummary` leagă spre `/hmrc`).

### Migrație nouă: pinuirea ratei în timp ce e Draft

`pin_shift_rates()` (déjà existentă, din `20260905100000_reserves` +
`20260905160000_one_answer`) pinuia rata o singură dată, numai dacă coloana
era încă `null`. Corect pentru o tură Completed, dar greșit pentru o tură
Draft a cărei Arie se corectează: ziua n-a fost niciodată lucrată sub rata
Ariei vechi, deci păstrarea acelei rate nu e istorie, e o greșeală scrisă
prima.

`supabase/migrations/20260906070000_pin_while_draft.sql` **rescrie aceeași
funcție** (`create or replace`, ca și migrația anterioară) ca să aibă două
reguli: Draft — repinuiește mereu la rata curentă a Ariei (sau null, dacă
tura n-are Arie); Completed — comportamentul vechi, neschimbat, rata rămâne
înghețată orice s-ar întâmpla ulterior în `running_costs`. Testat manual,
comportamental, pe un Postgres local efemer (nu Supabase, nicio conexiune
live) — cele patru scenarii (pinuire inițială, repinuire la schimbarea
Ariei, îngheț după Completed, null fără Arie) s-au comportat exact așa.

**Nu este aplicată live** și nu apare încă în `docs/MIGRATII.md` ca aplicată.

Migrația `20260906060000_shift_invariants` rămâne neaplicată live, exact ca
înainte (vezi mai jos) — acest task nu a atins-o și nu depinde de ea: UI-ul
nou tratează fail-safe orice tură cu sesiuni deschise ambigue (una sau mai
multe), fără să pornească vreodată o sesiune nouă peste o stare neclară.

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
