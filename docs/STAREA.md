# Starea curentă

**Actualizat:** 7 septembrie 2026.

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
  creare, și acum editabilă și după salvare — un singur item patch, alături
  de titlul recalculat, dacă amândouă s-au schimbat) și legături `about`/
  `pays` către orice alt item (Person/Company/Vehicle/Property inclusiv),
  prin `links`-ul existent — fără mecanism nou;
- o intrare se poate șterge (soft-delete pe ancoră, la fel ca orice alt item)
  — buton „Delete" pe ecranul de editare; entry-urile șterse dispar din
  timeline, dar rămân în cache pentru sync, la fel ca peste tot în aplicație;
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
- schema impune acum, la nivel de bază: cel mult o tură vie pe owner+zi+arie,
  și cel mult o sesiune deschisă pe tură — `20260906060000_shift_invariants`,
  migrație separată, **aplicată live** (confirmat direct, vezi mai jos);
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

**`20260906060000_shift_invariants` este acum aplicată live.** Confirmat
direct, prin citire pe live (7 sep 2026): ambele indexuri
(`items_one_shift_per_day_area`, `shift_sessions_one_open_per_shift`) există
pe `public`. Un `create unique index` nu poate reuși peste date deja
conflictuale — faptul că `shift_sessions_one_open_per_shift` există dovedește
că cele cincisprezece rânduri `shift_sessions` cu `ended_at IS NULL` simultan
(găsite anterior pe aceeași tură, owner+zi+arie, 2026-09-05) au fost deja
reduse la cel mult una înainte ca indexul să fie creat — proprietarul a decis
și a rulat reparația de date separat, în afara acestei sesiuni; detaliile
exacte ale acelei reparații nu sunt cunoscute aici.

Cu ambele invariante acum garantate de bază (o singură tură vie pe zi/Arie, o
singură sesiune deschisă), criteriul corespunzător din `docs/PROGRESS.md`
poate trece din `PARTIAL` în `DONE` — actualizat acolo.

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

Un Vehicle poate fi acum și „folosit” de un Workday, sau ținta unui fuel
expense — prin `links` de tip `about`, nu printr-un câmp nou pe `shifts`/
`expenses`. Vezi secțiunea Delivery/Work mai jos pentru cum se leagă exact.

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
- Cât timp e Draft, costul folosit de preview este: fuel — rata curentă a
  **Vehiculului legat** de Workday (`fuelRateForVehicle`, peste
  `fuelRate`/`fillsOf`); vehicle wear — rata curentă configurată pe același
  **Vehicul**, dintr-un istoric datat propriu (`vehicle_cost_rates`, cea mai
  recentă intrare cu `effective_from` ≤ azi). Niciodată rata Ariei, niciodată
  rata veche pinuită pe rândul `shifts`. Odată Completed,
  `DrivingCostBasis` arată **numai** rata pinuită a turei (etichetată
  „Pinned”, cu „Not recorded” pentru o valoare pinuită `null`) — nu mai arată
  rata curentă a Ariei/Vehiculului, care ar putea deja fi alta.
- Slice-ul de tax/NI folosit de preview urmărește data din draft, nu data
  încă persistată — mutarea datei recalculează imediat Tax/NI/Roughly yours.
  Profitul propriu al turei editate este exclus din „ce a făcut anul înainte
  de asta” (`before`), ca să nu se numere de două ori când data ei traversează
  un prag din an. O dată goală **nu** mai înseamnă „azi” pentru acest calcul —
  `sliceFor` întoarce direct un slice necunoscut, iar mesajul arătat e „Add a
  workday date to calculate Tax and NI.”, distinct de mesajul pentru anul
  fiscal nesetat.
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
  sesiune de lucru încheiată, ambele citiri de odometru cu finalul **strict**
  peste început (un Draft poate încă avea end === start, netastat; Complete
  refuză explicit egalitatea, nu doar mersul înapoi), un **Vehicul folosit
  neambiguu**, rata automată de fuel cunoscută, rata vehicle configurată și
  **cel puțin un câștig efectiv** (platformă, tip sau bonus > 0 — un draft
  complet gol de câștiguri, sau cu £0 explicit peste tot, nu poate fi
  Completed) — toate verificate separat (`validateCompletion`), afișate
  distinct în sheet. Anul fiscal (HMRC) nu e cerut pentru Complete — un an
  nesetat rămâne vizibil doar ca „missing” pe rezumat, nu blochează
  finalizarea zilei.
- Data unui Workday se editează ca `due` pe aceeași ancoră (nu se creează un
  al doilea shift) — mutarea pe altă zi îl scoate/introduce corect din
  Overdue/ziua respectivă, prin filtrele generice deja existente.
- **Vehicul folosit**, pe Workday: un `<select>` propriu, separat de Arie.
  Alegerea lui este acum **deferred la Save draft**, exact ca orice alt câmp
  al turei — nu mai scrie imediat. Save draft leagă/înlocuiește/șterge
  legătura `uses` de la item-ul turei către `Item`/`Entity` de tip Vehicle
  (același mecanism `links`, fără model paralel) numai dacă draftul chiar a
  schimbat alegerea; Discard nu scrie nimic. O ambiguitate deja persistată
  (2+ legături) nu este niciodată „rezolvată” automat ca efect secundar al
  salvării unui alt câmp — draftul pornește gol pentru un Vehicul ambiguu, iar
  golul acela înseamnă explicit „neatins”, nu „șterge legăturile”. Nicio
  legătură, sau mai mult de una simultan, înseamnă „niciun Vehicul
  neambiguu” — Complete Workday e blocat cu mesaj explicit.
- „Fuel £/km” nu mai e input manual în Workday: se citește automat din
  calculul full-tank-to-full-tank existent (`fuelRateForVehicle`, peste
  `fuelRate`/`fillsOf`), urmărind fill-up-urile legate (prin `about`, către
  Vehicul — kind distinct de `uses`, vezi mai jos) de **Vehiculul folosit**,
  niciodată de Aria turei — două vehicule din aceeași
  Arie nu-și amestecă niciodată lanțul de fuel, iar un vehicul folosit în mai
  multe Arii își păstrează un singur lanț corect. Afișat „Automatic ·
  £x.xxxx/km” sau „Not enough full-tank data yet” — niciodată £0 ca și cum ar
  fi un cost real. Un fuel expense fără Vehicul legat (sau cu unul ambiguu)
  rămâne în afara oricărui calcul — nu e reasignat automat niciunui vehicul,
  nici măcar istoricul deja scris. „Vehicle £/km” este acum o configurare per
  **Vehicul**, cu istoric datat (`vehicle_cost_rates`), complet independentă
  de fuel — nu mai e o configurare a Ariei (`running_costs`), care nu mai e
  scrisă de acest cost. Se editează dintr-o acțiune secundară „Configure
  vehicle cost”, care citește mereu valoarea curentă la deschidere (nu doar
  la schimbarea Vehiculului) și blochează Complete Workday cât timp scrierea
  ei e în curs.
- Rezumatul turei (Made/Roughly yours/etc.) distinge acum de ce lipsește
  costul pe km: fuel necunoscut, cost vehicul neconfigurat, sau amândouă —
  trei mesaje diferite, niciodată „scrie fuel” când fuel e deja cunoscut.
- Un câștig salvat pe o platformă poate fi șters efectiv (nu doar golit
  vizual): golirea casetei și Save draft șterge rândul `shift_earnings`
  corespunzător, nu scrie un £0 fals — „necunoscut” rămâne diferit de „zero”.

Schema minimă nouă pe care se bazează Vehiculul folosit — Entity de tip
`vehicle` + `links` de tip `about` — există deja live, din
`20260905180000_entities_and_links`; nimic din ce descrie acest task nu cere
o migrație nouă pentru asta. Singura migrație nouă e cea de mai jos, pentru
rata de fuel pinuită pe Vehicul.

Repo-ul poate acum randa componente React în teste. `jsdom` este devDependency
(vitest rămâne pe `environment: 'node'` global, ca să nu încetinească restul
suitei; fișierele care chiar randează pun `// @vitest-environment jsdom` în
capul fișierului). Nu s-a adăugat `@testing-library/react` — un helper mic,
`src/shifts/domTestHelpers.ts`, montează prin `react-dom/client` direct.
Exemple: `ShiftHours.test.tsx`, `DrivingCostBasis.test.tsx` (inclusiv afișarea
„pinned” la Completed, și deschiderea editorului mereu cu valoarea curentă),
`ShiftActions.test.tsx`, `ShiftSummary.test.tsx` (mesajele distincte pentru
dată lipsă/an nesetat/fuel necunoscut/vehicle cost neconfigurat),
`ShiftSheet.test.tsx` (Delete succes/eșec/blocat, Complete blocat fără Vehicul
neambiguu, Complete blocat cât timp o salvare de vehicle cost e în curs), cu
`MemoryRouter` în jur — `ShiftSummary` leagă spre `/hmrc`.

### Migrație nouă: pinuirea ratei în timp ce e Draft, și rata de fuel pe Vehicul

`pin_shift_rates()` (déjà existentă, din `20260905100000_reserves` +
`20260905160000_one_answer`) pinuia rata o singură dată, numai dacă coloana
era încă `null`. Corect pentru o tură Completed, dar greșit pentru o tură
Draft a cărei Arie se corectează: ziua n-a fost niciodată lucrată sub rata
Ariei vechi, deci păstrarea acelei rate nu e istorie, e o greșeală scrisă
prima.

`supabase/migrations/20260906070000_pin_while_draft.sql` **rescrie aceeași
funcție** (`create or replace`, ca și migrația anterioară) ca să aibă două
reguli: Draft — repinuiește mereu la rata curentă; Completed — comportamentul
vechi, neschimbat, rata rămâne înghețată orice s-ar întâmpla ulterior în
`running_costs`/`vehicle_fuel_rates`.

Un al doilea audit a găsit greșit ce conta drept „rata curentă” pentru fuel:
prima versiune a acestei migrații (nu a fost niciodată live) citea fuel tot
din `running_costs`, adică tot după Arie — exact ipoteza greșită „Aria =
Vehiculul”. Fișierul a fost **rescris pe loc** (fiind neaplicată încă, nu e
nimic live de păstrat): adaugă tabelul nou `vehicle_fuel_rates` (o rată de
fuel per Vehicul, cache-ul trigger-ului — nimic din cod nu-l mai citește
înapoi, ecranul recalculează mereu direct din expenses), și rescrie
`pin_shift_rates()` să rezolve Vehiculul legat de tura respectivă printr-un
join `links`⋈`entities` cu verificare explicită de unicitate (exact 1 →
folosit; 0 sau ≥2 → `null`, niciodată o alegere ghicită), pinuind fuel de
acolo. La acel moment, `rate_vehicle_per_km` (uzura) rămăsese încă citit din
`running_costs` după Arie — corectat ulterior de migrația D1 de mai jos, care
rescrie `pin_shift_rates()` din nou ca să citească uzura tot per Vehicul.

Testat manual, comportamental, pe un Postgres local efemer (nu Supabase,
nicio conexiune live): Vehicul neambiguu → fuel din Vehicul; niciun Vehicul
legat → fuel `null`; două Vehicule legate (ambiguu) → fuel `null`; Completed
→ rata înghețată, neatinsă chiar și după ce configurarea curentă a
Vehiculului se schimbă sau legătura e ștearsă.

Un audit ulterior (rundă D1) a găsit o greșeală de `grant`/`revoke` în acest
fișier: `revoke all` pe `vehicle_fuel_rates` rula **după** un `grant` țintit,
ștergându-l silențios pe cel din urmă — exact ordinea inversă față de
migrația live `entities_and_links`, care revocă întâi și acordă apoi. Fără
reparație, upsert-ul pe `vehicle_fuel_rates` ar fi eșuat mereu din lipsă de
`UPDATE` pe `vehicle_item_id`. Fișierul a fost **rescris pe loc** (nefiind
niciodată live, nimic de păstrat): revoke-ul precede acum toate grant-urile.

**Este acum aplicată live**, dar manual (SQL Editor Supabase, pe proiectul
`tasks-calendar`), nu prin `supabase db push`/CLI — apare în
`docs/MIGRATII.md` ca aplicată, cu drift documentat acolo: nefiind trecută
prin CLI, nu apare în `supabase_migrations.schema_migrations`, iar fișierul
n-are `if not exists`/`or replace trigger`, deci un `db push` viitor, în
ordinea normală a fișierelor, va încerca s-o reaplice și va eșua. Asta trebuie
rezolvat (`supabase migration repair` sau fișier idempotent) înainte de orice
`db push` viitor — nu s-a făcut aici.

**`shift_invariants` (0600) este acum aplicată live**, confirmat direct (7 sep
2026, vezi mai sus) — cele cincisprezece rânduri `shift_sessions` simultan
deschise au fost reduse înainte ca indexul unic să poată fi creat. Rămâne
totuși același drift CLI ca la `0700`: rulată manual, deci nu apare în
`supabase_migrations.schema_migrations`, iar fișierul n-are `if not exists` pe
cele două `create unique index` — un `db push` viitor prin CLI, în ordinea
normală, va încerca s-o reaplice și va eșua exact ca la `0700`. Rezolvarea
acelui drift CLI (pentru `0600` și `0700` deopotrivă) rămâne o decizie separată
a proprietarului — nu s-a făcut aici.

### Migrație nouă (D1): fundația de date pentru Delivery

`supabase/migrations/20260907000000_delivery_data_foundation.sql` este a doua
migrație nouă a acestei runde. **Este acum aplicată live**, manual (SQL
Editor Supabase, pe `tasks-calendar`), nu prin CLI — vezi drift-ul documentat
în `docs/MIGRATII.md`. Conține patru bucăți independente:

- **`vehicle_cost_rates`** — istoricul de cost pe km al unui Vehicul, cheie
  `(vehicle_item_id, effective_from)`, exact tabelul citit acum de
  `pin_shift_rates()` pentru uzură (vezi mai sus). Înlocuiește
  `running_costs` pentru acest rol; `running_costs` rămâne neschimbat pentru
  restul rolului lui (costurile Ariei, neatinse aici).
- **Imutabilitate Completed impusă la nivel de bază, nu doar în UI** — două
  funcții trigger noi, `reject_write_to_completed_shift()` (pe `shifts`,
  `shift_sessions`, `shift_earnings`) și `reject_link_change_on_completed_shift()`
  (pe `links`, pentru legătura Vehicul-Workday), care refuză orice scriere pe
  o tură deja `done`. Independent de invariantele din `shift_invariants`
  (0600) — nu depinde de aplicarea ei.
- **`platforms`** — a cincea ancoră de tip `entities`/`links`: un `item` de
  kind nou `'platform'` + o extensie proprie, cu exact același `touch_anchor()`/
  `pin()` generic ca `entities`. Relația cu o Companie se face prin `links`
  existent, fără coloană nouă. Acesta este **doar fundația de date** —
  configurarea platformelor ca înregistrări (fără Uber/Deliveroo/Just Eat
  hardcodate în cod) există acum în schemă și în repository/cache, dar
  **nu e încă legată în UI-ul de Earnings al unui Workday**; asta rămâne
  pentru D3, conform roadmap-ului (D1 date → D2 payout/cash-out/settlement →
  D3 experiența finală Delivery).
- **`shift_earnings` extins** — `id` surogat, `platform`/`platform_item_id`
  ambele nullable cu un `CHECK` de exact-unul-dintre-ele, două indexuri unice
  obișnuite (unul pentru enumul vechi, unul pentru legătura la o Platformă
  configurabilă), `pin()` extins să acopere ambele. Coloana enum
  `platform` existentă **nu e ștearsă, redenumită sau reasignată** — coexistă
  cu calea nouă, exact regula „nicio istorie ghicită sau distrusă”.

**Bug găsit în CI, reparat înainte de rularea live.** Cele două indexuri de
mai sus au fost scrise inițial ca indexuri *parțiale* (`where platform is not
null` / `where platform_item_id is not null`). Postgres nu poate ținti un
index parțial dintr-un `ON CONFLICT` fără să repete predicatul acolo, iar
`.upsert(..., { onConflict: 'item_id,platform' })` din cod nu face asta —
eroare `42P10`, prinsă de `check:rls` (6 din 90 cazuri picate), niciodată pe
vreo bază live. Fișierul a fost rescris pe loc, înainte de rularea manuală de
mai jos: indexurile sunt acum obișnuite, fără `where` — semantica NULL
standard a UNIQUE (fiecare NULL distinct) dă deja separarea dorită între un
rând legacy și unul cu `platform_item_id`, fără predicat.

Verificat comportamental pe același Postgres local efemer (nu Supabase):
scenarii pentru fiecare trigger de imutabilitate și pentru `CHECK`-ul
exact-unul-dintre-ele — toate au trecut, înainte de reparația de mai sus.
**Este acum aplicată live** (vezi drift-ul din `docs/MIGRATII.md` — rulată
manual, nu prin CLI). `0600` (`shift_invariants`) este, separat, tot aplicată
live acum (vezi mai sus) — incidentul cu cele 15 rânduri `shift_sessions`
simultan deschise a fost rezolvat înaintea ei, nu de nimic din migrația asta.

Ce rămâne neschimbat de această rundă: D2 (payout/cash-out/settlement) și D3
(experiența finală Delivery — Dashboard/Shifts/Platforms/Earnings/Expenses/
Fuel/Performance) nu sunt implementate. Criteriul Multi-App Delivery din
`docs/PROGRESS.md` rămâne `PARTIAL`, nu `DONE`.

### Audit D1 (ChatGPT) — blocaje reparate după fundația de mai sus

Auditul complet cerut de contractul din `docs/DELIVERY_MASTER_BACKLOG.md` a
găsit blocaje reale, în afara celor de mai sus:

- **Vehicul folosit via `about`, nu `uses`** — `about` era același kind
  folosit și de o mențiune oarecare (ex. un fuel Expense, sau un task despre
  o reînnoire de asigurare legat de aceeași mașină), deci putea fi confundat
  cu Vehiculul chiar folosit de Workday. Reparat: `links_kind` are acum și
  `uses`, iar `pin_shift_rates()`/`vehicleLinkOf` (repository) cer explicit
  kind-ul — Workday-ul citește/scrie `uses`, un fuel Expense rămâne pe
  `about`. Migrație: `20260907010000_workday_vehicle_uses_link` (aplicată live, 7 sep 2026, manual).
- **`parking`/`tolls`/`other_cost` erau al doilea adevăr financiar** —
  numere direct pe `shifts`, nu Expense-uri. Reparat cu o regulă dual-path,
  aleasă explicit de proprietar: coloanele vechi de pe `shifts` rămân
  neatinse (pot avea deja valori reale, live, din `from_the_reference`) și
  se citesc doar ca fallback; din momentul în care un câmp e atins din nou,
  scrierea merge exclusiv pe un Expense real, legat de Workday prin `about`
  (categoria `parking`/`tolls`, sau `other` pentru „altceva”). Nicio
  conversie automată a valorilor vechi — asta ar fi ghicit un titlu și un
  `business_pct` pe care nimeni nu le-a introdus. Îmbinarea „ce e efectiv
  valabil acum” se face într-un singur loc, `withRoadCostExpenses`
  (`repository/shift.ts`), apelat din `items/snapshot.ts` — restul motorului
  de calcul (`takeHome`, toate ecranele) citește `shift.parking` exact ca
  înainte, fără să știe că un Expense e implicat. Migrație:
  `20260907020000_road_cost_expenses` (extinde enumul de categorii,
  aplicată live, 7 sep 2026, manual).
- **Platforms neconectat în UI-ul de Earnings, plus un bug critic găsit pe
  drum** — `ShiftEarnings` arăta doar lista veche hardcodată (Uber Eats/
  Deliveroo/Just Eat/Other); o Platformă configurată n-avea cum să primească
  un câștig. Reparat: câte un câmp per Platformă activă a utilizatorului
  (plus una dezactivată dacă tura are deja un câștig pe ea), scriind prin
  `platform_item_id`. Pe drum, a ieșit la iveală un bug independent, mai grav:
  `repository/item.ts` nu recunoștea `kind: 'platform'` — orice cont cu o
  singură Platformă ar fi picat complet sincronizarea (nimic nu s-ar mai fi
  încărcat, nicăieri). Reparat în același commit.
- **Regulile Platformei (earning cycle/payout/cash-out) nu erau
  effective-dated** — o singură linie mutabilă pe `platforms`, deși
  contractul D1.F cere explicit istoric versionat, exact ca la
  `vehicle_cost_rates`. Reparat: tabel nou `platform_rules` (o linie per
  Platformă per dată de la care regula a intrat în vigoare); `platforms`
  rămâne doar identitate (`active`, `display_order`). Migrație:
  `20260907030000_platform_rules` (aplicată live, 7 sep 2026, manual; nicio
  Platformă n-a avut vreodată o valoare reală în coloanele scoase — niciun
  ecran de configurare a Platformelor nu există încă, e D3).
- **`platform_item_id` verifica doar proprietarul, nu felul item-ului** —
  FK-ul `(platform_item_id, owner) references items (id, owner)` pe
  `shift_earnings` și `platform_rules` dovedea doar că item-ul e al aceluiași
  owner, nu că e chiar o Platformă — nimic nu oprea o legătură către un Task
  sau altă ancoră a aceluiași om (o constrângere CHECK nu poate rula un
  subquery). Reparat cu un trigger generic, `require_item_kind()` (parametrizat
  cu numele coloanei și felul așteptat, la fel ca `pin()`), pus pe ambele
  tabele. Migrație: `20260907040000_platform_item_kind` (aplicată live,
  7 sep 2026, manual). Gaură similară, nefixată aici — în afara acestui blocaj —:
  `vehicle_cost_rates.vehicle_item_id`/`vehicle_fuel_rates.vehicle_item_id` au
  exact aceeași limitare (FK pe owner, nu pe `entity_kind='vehicle'`).
- **`vehicle_cost_rates` se pinea după data scrierii, nu după ziua turei** —
  `pin_shift_rates()` compara `effective_from` cu `now()`; o tură completată
  la mult timp după ziua efectivă (sau editată ulterior) primea rata validă
  azi, nu rata în vigoare chiar în ziua lucrată. Reparat: comparația folosește
  acum `items.due` al turei înseși (aceeași coloană setată de
  `createDated`/`createShift`), cu fallback la data curentă doar dacă `due`
  ar lipsi. `vehicle_fuel_rates` nu are nevoie de aceeași reparație — e un
  rând mutabil unic, fără istoric de date. Migrație:
  `20260907050000_pin_rate_by_workday_date` (aplicată live, 7 sep 2026, manual).
- **„Download everything" excludea aproape tot, nu doar tabelele D1** —
  `exportAll`/`exportFile` citeau doar `items`, `journal_entries` și
  `quick_actions`; un shift, un Expense, un istoric de `vehicle_cost_rates`,
  o Platformă și regulile ei nu ajungeau niciodată în fișier. Reparat:
  `exportFile` primește acum un obiect `ExportData` cu toate cele 13 tabele
  citite de `readSnapshot` (`formatVersion` 1→2); `exportAll` le adună
  printr-un nou modul, `repository/export-data.ts` (`readExportData`), ca să
  nu care `items.ts` însuși toate importurile tabelelor. Nicio migrație: pur
  TypeScript, fără schimbare de schemă.
- **Save draft/Complete Workday scriau secvențial, niciodată atomic** —
  până la nouă cereri de rețea separate (item, legătura de Vehicul, tura,
  câștiguri legacy și configurabile, pauze, ștergeri de sesiune, costuri de
  drum) pentru un singur Save; o cădere la mijloc lăsa prima jumătate scrisă
  și restul nescris — nici salvat, nici nesalvat. Reparat cu o funcție nouă
  Postgres, `save_workday(payload jsonb)`, apelată o singură dată prin RPC
  (`supabase.rpc('save_workday', { payload })`): o singură invocare de
  funcție e o singură tranzacție, deci fiecare instrucțiune din ea reușește
  împreună cu toate celelalte sau niciuna. `security invoker` (implicit,
  numit explicit în fișier): rulează ca rolul `authenticated` chemat, cu
  `auth.uid()` din cerere, exact ca azi — toate RLS/grant/trigger-ele
  existente (`pin_shift_rates`, `reject_write_to_completed_shift`, garda de
  `kind` pe `platform_item_id`) se aplică neschimbate, nimic nu e duplicat.
  Patch-ul propriu al item-ului (titlu/dată/Arie) **nu** intră în această
  funcție — rămâne pe propriul apel version-checked (`applyPatch`), o grijă
  diferită (o editare concurentă pe ancoră) de „a ajuns tura ca o singură
  bucată”. Client: `WorkdayWriters` are acum doar `onUpdateItem` +
  `onCommit`; `ShiftSheet`/`AppShell` au un singur prop nou,
  `onCommitWorkday`, în locul celor nouă separate; funcțiile repository
  individuale rămase fără apelant (`saveShift`, `setEarning`,
  `removeEarning`, `setPlatformEarning`, `removePlatformEarning`,
  `setSessionBreak`, `removeSession`, `setRoadCost`) nu au fost șterse —
  rămân primitive testate separat, doar nemaifolosite de acest flux.
  Migrație: `20260907060000_save_workday_rpc` (aplicată live, 7 sep 2026, manual).
- **Reseed-ul draft-ului după Save citea `links`-ul dinainte de salvare, nu
  cel de după** — `ShiftSheet`'s `onSaveDraft` reconstruia draft-ul din
  rezultat cu `props.links`, care nu reflectă încă salvarea (resincronizarea
  e asincronă, componenta-părinte nu s-a re-randat încă); dacă tocmai s-a
  schimbat Vehiculul, selectorul revenea vizual la vechiul Vehicul (sau la
  „niciunul") imediat după un Save reușit. Reparat: `saveWorkday` întoarce
  acum și `links`-ul cum va fi după salvare (aceeași idee ca la `item`/
  `shift` deja întoarse), calculat local din `vehiclePatch`; reseed-ul
  folosește acest rezultat, nu prop-ul vechi. Nicio migrație: pur TypeScript.
- **Antetele `0700`/D1 se contraziceau cu `docs/MIGRATII.md`** —
  `20260906070000_pin_while_draft.sql` și
  `20260907000000_delivery_data_foundation.sql` începeau cu „NOT APPLIED
  LIVE... not declared applied in docs/MIGRATII.md until it is", deși
  ledger-ul chiar declară ambele aplicate manual pe live (6 sep 2026 — vezi
  „Drift cunoscut" din `MIGRATII.md`). Corectat: antetele spun acum „APPLIED
  LIVE (manually...)" și trimit la secțiunea de drift din `MIGRATII.md`
  pentru ce anume înseamnă asta (nu apar în
  `supabase_migrations.schema_migrations`, niciun `if not exists`/`or
  replace`, un `db push` viitor le va încerca din nou și va eșua). La
  momentul acestui fix, celelalte șase migrații ale rundei D1 (`0710` până
  la `0760`) spuneau încă, corect, „NOT APPLIED LIVE" despre ele însele —
  toate șase au fost rulate manual pe live ulterior, în aceeași zi, și
  antetele lor au primit aceeași corecție (vezi bulletul de mai jos despre
  rularea lor). Nicio schimbare de comportament: doar text.
- **Toate cele șase migrații de audit D1 de mai sus, aplicate pe live** —
  proprietarul a rulat manual, prin SQL Editor Supabase, cele șase fișiere
  `20260907010000_workday_vehicle_uses_link` până la
  `20260907060000_save_workday_rpc`, într-un singur block, în ordine. Toate
  șase apar acum ca aplicate în `docs/MIGRATII.md` (7 sep 2026, manual) și
  au primit aceeași corecție de antet ca `0700`/D1 (`APPLIED LIVE`, cu
  trimitere la secțiunea de drift). Consecință directă: Platforms
  configurabile, atomicitatea Save Workday și restul reparațiilor de mai sus
  sunt acum reale pe live, nu doar în cod.

Verificat mecanic (Postgres local construit manual, fără Docker în acest
sandbox): toate migrațiile aplicate în ordine, `check:rls` — 96/96 cazuri
(incluzând un caz nou care demonstrează direct atomicitatea: un payload cu o
parte refuzată nu lasă nimic scris); typecheck, lint, build, structure,
reachable, 655 teste unitare — toate verzi. La momentul acestei runde,
`check:drops` semnala 7 coloane vechi ale lui `platforms` (drop-ate de
`20260907030000_platform_rules`) ca „încă numite” în `platform-record.ts` —
fals pozitiv, verificatorul nu lega numele de coloană de tabelul lui.
**Reparat ulterior** (`scripts/lib/drops.mjs`: `dropsIn()` exclude acum orice
nume pe care aceeași migrație îl (re)dă unei alte tabele) — `check:drops`
trece azi curat pe `main`.

### Audit D1 (a doua rundă) — blocaje reparate

Un audit ulterior, pe starea reală de după cele șase migrații de mai sus, a
găsit patru probleme reale în plus:

- **Un Expense de cost-de-drum legat de un Workday Completed nu era protejat
  la nivel de bază** — `shifts`/`shift_sessions`/`shift_earnings`/`links`
  refuză toate o scriere odată ce tura e `done` (fundația D1 de mai sus), dar
  `expenses` nu era în listă: un Expense legat `about` de o tură terminată
  putea fi modificat sau șters prin orice cale generală de Expenses, nu doar
  prin sheet-ul Workday-ului (care deja refuza să-l deschidă pentru editare,
  dar asta e grijă de UI, nu o constrângere). Reparat cu un trigger nou pe
  `expenses` (`reject_write_to_completed_linked_expense`), simetric cu cel de
  pe `shifts`; garda de pe `links` a fost și ea lărgită să verifice ambele
  capete ale legăturii (`from_id` sau `to_id`), nu doar `from_id` — o legătură
  `about` cu tura la `to_id` (cazul Expense-urilor de drum) nu era acoperită.
- **`save_workday()` verifica doar `owner`, niciodată că id-ul chiar aparține
  Workday-ului salvat** — un link de Vehicul, o sesiune sau un Expense
  existent, numite în payload, erau șterse/actualizate doar pe baza
  `owner = auth.uid()`; un id real al aceluiași om, dar al altui Draft, trecea
  identic. Reparat: fiecare ștergere/actualizare e acum condiționată explicit
  de apartenența la `v_item_id` (Workday-ul curent) — un link/sesiune al altui
  Workday e pur și simplu ignorat (nu găsit), iar un Expense al altui Workday
  e refuzat explicit (eroare), nu rescris orbește.
- **Lipsea payout destination reference** — `docs/PLAN.md` cere explicit ca
  fundația de date a unei Platforme să poată reprezenta o „payout destination
  account”, alături de earning cycle/payout schedule/cash-out; `platform_rules`
  nu avea niciun câmp pentru asta. Adăugat `payout_destination_reference`
  (text simplu, ca `cashout_settlement` — nicio Platformă nu are încă vreun
  ecran de configurare, execuția rămâne D2/D3).
- **Save Draft/Complete Workday se rupea în două — reparat acum, vezi runda a
  doua de mai jos.** Item patch-ul (titlu/dată/Arie) a fost mutat înăuntrul
  RPC-ului `save_workday`, cu propriul version-check.

Migrații: `20260907070000_completed_expense_guard_and_scoped_save`,
`20260907080000_platform_rules_payout_destination` — **aplicate live** acum
(rulate manual de proprietar, 7 sep 2026, vezi `docs/MIGRATII.md` pentru
drift-ul CLI rezultat).

Verificat mecanic: aceleași migrații de mai sus plus acestea două, aplicate în
ordine pe un Postgres 16 local (construit manual, fără Docker); `check:rls` —
100/100 cazuri, incluzând patru cazuri noi (garda de Completed pe Expense și
pe link, plus cross-Workday pe link de Vehicul și pe Expense existent);
lint/typecheck/659 teste unitare/build/structure/reachable/`check:drops` —
toate verzi.

### Audit D1 — a doua rundă (7 sep 2026, după runda de mai sus)

Un al doilea audit cumulativ, pe HEAD-ul de după runda anterioară, a găsit
încă 5 blocaje HIGH și 2 MEDIUM. Reparate:

- **Platformele hardcodate încă puteau crea date noi** — `ShiftEarnings`
  arăta necondiționat un câmp pentru fiecare din Uber Eats/Deliveroo/Just
  Eat/Other, pe orice Draft, chiar unul complet nou, contrar contractului D1
  („platforme finale = records configurabile, legacy = doar compatibilitate
  istorică"). Reparat: un câmp legacy apare acum doar dacă tura *are deja* un
  câștig real stocat pe acel platform (`legacyPlatformsInUse`, calculat din
  `shift.earnings`, nu din draft) — un Draft nou oferă doar Platforme
  configurabile.
- **Un earning invalid pe o Platformă configurabilă se pierdea în tăcere** —
  `validateDraft()` valida doar cele patru platforme legacy, niciodată
  `draft.platformEarnings`; `platformEarningsPatchOf` sare peste o valoare
  care nu se parsează, deci o valoare greșită dispărea fără eroare și fără
  să oprească Save/Complete. Reparat: fiecare intrare din
  `draft.platformEarnings` e validată la fel ca una legacy.
- **Completed Workday nu era imutabil la nivelul propriei ancore `items`** —
  garda exista pe `shifts`/`shift_sessions`/`shift_earnings`/`links`/Expense
  legat, dar `authenticated` putea încă `UPDATE` `title`/`due`/`area_id`/
  `state`/`kind` direct pe `items`, confirmat printr-o verificare read-only pe
  live. Reparat: trigger nou, `items_reject_completed_shift_write` — refuză
  orice schimbare pe acele coloane odată ce `state = 'done'`. `deleted_at`
  rămâne explicit neafectat: ștergerea unui Workday Completed rămâne permisă,
  la fel ca la un Draft.
- **Un RPC reușit putea fi arătat ca eșec** — `saveWorkdayAtomic()` rula
  `save_workday` (deja comis), apoi trei sincronizări; dacă una din ele
  eșua, se arunca o eroare simplă, nu semnalul `SyncPending` deja folosit
  pentru exact acest caz în altă parte (`clockOn`). Reparat: o sincronizare
  eșuată după commit e acum `SyncPending`, tratată de `write()` ca succes
  soft (numerele sunt pe server; doar dispozitivul n-a putut reciti), nu ca
  motiv de reîncercare care ar fi putut crea un al doilea Expense de cost de
  drum peste cel deja scris.
- **Save Workday nu era atomic ca acțiune completă** — item patch-ul
  (titlu/dată/Arie) rula separat, înaintea RPC-ului; un eșec al RPC-ului
  după ce item patch-ul reușise lăsa un Workday salvat pe jumătate. Reparat:
  item patch-ul e acum parte din aceeași tranzacție `save_workday`, scris
  înaintea rândului din `shifts` (ordinea rămâne necesară — `pin_shift_rates()`
  citește `items.due` la scrierea turei). Protecția la editare concurentă nu
  s-a pierdut: `expected_version` verifică versiunea în aceeași tranzacție —
  o versiune învechită respinge tot Save-ul (nimic parțial aplicat), cu un
  mesaj clar, fără reîncercarea automată/merge-ul pe care `writeChecked` îl
  oferă altor patch-uri de item.
- **Un road cost legacy fără Expense legat nu putea fi golit** — dacă
  `shifts.parking`/`tolls`/`other_cost` avea o valoare veche fără niciun
  Expense legat, iar utilizatorul golea câmpul, nimic nu se scria (coloana
  legacy nu mai poate fi scrisă niciodată, per `20260907020000`, iar
  `roadCostsToRemoveOf` cere un Expense existent de șters) — valoarea
  reapărea la redeschidere. Pe live, 0 astfel de valori neacoperite la
  momentul auditului. Reparat: golirea unui asemenea câmp creează acum un
  Expense real de £0, pe care `withRoadCostExpenses` îl preferă oricum în
  fața coloanei legacy — valoarea veche nu mai reapare, fără să ghicească
  vreun titlu/business_pct și fără să atingă vreodată coloana înghețată.
- **Documentație contrazicea codul/live-ul** — `STAREA.md` mai spunea într-un
  loc că `shift_invariants` nu e aplicată live (era, corect, mai jos);
  `PROGRESS.md` spunea că fundația Platformelor (`platforms`,
  `shift_earnings.platform_item_id`) e neaplicată live, deși `MIGRATII.md` o
  declara deja aplicată manual. Ambele corectate.

Migrații: `20260907090000_completed_item_anchor_guard` (garda pe `items`) și
`20260907100000_atomic_item_patch` (`create or replace` pe `save_workday`, cu
item patch + `expected_version`) — **aplicate live** (rulate manual de
proprietar, 7 sep 2026, vezi `docs/MIGRATII.md` pentru drift-ul CLI rezultat).

Verificat mecanic: toate migrațiile (inclusiv acestea două) aplicate în
ordine pe un Postgres 16 local; `check:rls` — 104/104 cazuri, incluzând șase
cazuri noi (item patch în aceeași comitere, versiune învechită refuzată,
garda Completed pe `items`, ștergerea încă permisă pe un Workday Completed);
lint/typecheck/662 teste unitare/build/structure/reachable/`check:drops` —
toate verzi. `check:layout`/`check:quick-actions-row` nu au putut rula în
acest sandbox (fără server real de Supabase Auth).

### Audit D1 — a treia rundă (7 sep 2026, după runda de mai sus)

Un al treilea audit cumulativ, pe HEAD-ul de după runda a doua, a găsit încă
blocaje reale. Reparate, cu patru migrații noi — **toate patru confirmate
aplicate live** (7 sep 2026, rulate de proprietar prin SQL Editor Supabase,
ca un singur bloc concatenat; vezi `docs/MIGRATII.md` pentru drift):

- **Item-urile de Platformă apăreau ca sarcini** — `isTaskable()`
  (`src/repository/filters.ts`) excludea `'entity'`/`'journal'`, dar nu și
  `'platform'`, deci ancora unei Platforme configurabile putea apărea în
  liste orientate pe sarcini unde nu are ce căuta. Reparat: `'platform'`
  exclus și el. Nicio migrație — pur TypeScript.
- **Baza de cost a Vehiculului folosea rata de azi, nu ziua Workday-ului
  însuși** — `costBasisOf()` primea mereu „azi” ca dată, chiar și pentru un
  Draft retrospectiv (scris azi, despre o zi anterioară). Reparat: un
  `workdayDayOf()` nou (`src/shifts/draft.ts`) rezolvă ziua de care e vorba
  Workday-ul — `draft.due`, apoi `item.due` persistat, abia apoi azi —
  trecut ca `asOf` în `useWorkdayComputations`. Nicio migrație — pur
  TypeScript.
- **Reactivarea unei rate de combustibil invalidate eșua tăcut** —
  `saveVehicleFuelRate` făcea upsert fără să șteargă un `deleted_at` anterior,
  deci `.upsert()` compila într-un `ON CONFLICT DO UPDATE` pe care grant-ul de
  `deleted_at` nu-l acoperea pentru INSERT. Reparat pe partea de client
  (valorile includ acum `deleted_at: null`) și cu o migrație care adaugă
  grant-ul lipsă (`insert (deleted_at)`). Migrație:
  `20260907110000_vehicle_fuel_rate_reactivation.sql`.
- **`due`-ul unui Expense de cost-de-drum nu urmărea data mutată a
  Workday-ului** — `save_workday()`'s branch pentru un Expense de cost-de-drum
  deja existent actualiza suma/categoria/business_pct, dar nu și `due`-ul
  item-ului — numai un Expense *nou creat* primea `day`-ul corect. Mutarea
  datei unui Workday deja salvat lăsa Expense-ul legat datat tot pe ziua
  veche, ieșind tăcut din luna/anul fiscal în care Workday-ul chiar cade acum.
  Reparat: `due`-ul se actualizează acum la fiecare scriere de
  `road_cost_set`, inclusiv o intrare de „refresh” cu aceeași sumă pe care
  clientul (`roadCostDayRefreshOf`, `src/shifts/draftPatches.ts`) o trimite
  acum pentru fiecare Expense de cost-de-drum deja legat, de fiecare dată când
  data Workday-ului se schimbă, chiar dacă suma însăși nu s-a schimbat.
  Migrație: `20260907120000_road_cost_expense_day_tracks_workday.sql`.
- **Înregistrarea unei Platforme noi nu era atomică** — două cereri de rețea
  separate (insert în `items`, apoi insert în `platforms`), care puteau lăsa
  un rând `items` orfan de `kind='platform'` dacă legătura pica între ele.
  Reparat cu o funcție nouă, `record_platform(p_title text) returns
  public.items`, care face ambele inserturi într-o singură tranzacție.
  `recordPlatform()` din `src/repository/platforms.ts` și noua
  `supabaseRecordPlatform` din `src/repository/platform-source.ts` cheamă
  acum acest RPC. Migrație: `20260907130000_record_platform_rpc.sql`.
- **`save_workday()` nu verifica felul item-ului la `item_id`/Vehicul** —
  proprietatea era deja impusă prin FK, dar nimic nu verifica explicit că
  `payload.item_id` chiar numește un item de `kind='shift'`, nici că
  `vehicle_link_to` chiar numește un Vehicul real, viu. Reparat: ambele
  verificate explicit, refuzate cu `errcode 42501` dacă greșite. Migrație:
  `20260907140000_save_workday_kind_guards.sql`.
- **Money/Tax numărau de două ori un cost de drum** — `periodMoney()`/
  `currentYearMoney()`/`sliceOfYear()`/`sliceFor()` (din `src/repository/
  period.ts`, `slice.ts` și `src/shifts/liveSummary.ts`) treceau printr-o
  buclă separată de „cheltuit”, care mai număra o dată un Expense de categorie
  cost-de-drum deja împăturit în `directCostsPence`-ul propriu al turei, prin
  `withRoadCostExpenses()`. Reparat: toate patru funcțiile cer acum un
  parametru `links` obligatoriu și sar peste un asemenea Expense în bucla
  separată; toate punctele de apel din aplicație au fost actualizate. Nicio
  migrație — pur TypeScript.
- **Legături rămase agățate după un soft-delete** — soft-delete pe un item
  (de exemplu `removeExpense()`) nu atingea niciodată tabelul `links`, deci o
  săgeată agățată putea încă apărea în UI-ul generic „Joined to”
  (`src/things/JoinedTo.tsx`) cu un titlu rezolvabil, dar învechit. Reparat la
  nivel de citire: un helper nou, `liveNeighboursOf()`
  (`src/repository/link.ts`), filtrează orice vecin al cărui item de la
  celălalt capăt e soft-deleted. Nu s-a adăugat cascade-delete la nivel de
  bază pe `links` — a fost respins deliberat, ca să nu intre în conflict cu
  garanția existentă din runda a doua („un Workday Completed poate fi încă
  soft-deleted”, `reject_link_change_on_completed_shift`). E o reparație
  aleasă, mai îngustă decât ideal, dar suficientă pentru UI.
- **O „extra detail” a auditului anterior, verificată, nu era un bug real** —
  `done_at`/`waiting_since` rămân tehnic scriibile pe un Workday Completed
  (garda `items_reject_completed_shift_write` verifică doar title/due/
  area_id/state/kind), dar niciun cod din calea Workday/shift nu le citește
  sau le scrie vreodată — apar doar ca valori de fixture în teste. Coloană
  inertă, nu un bug viu; nu s-a schimbat nimic. Exceptarea lui `deleted_at`
  de sub aceeași gardă rămâne, separat, deliberată.

Verificat mecanic: Postgres local reconstruit din toate migrațiile din repo,
în ordine (0 erori); `check:rls` — 109/109 cazuri, incluzând cazurile noi din
`scripts/lib/rls-record-platform.mjs` și
`scripts/lib/rls-save-workday-guards.mjs`; `npm run check`
(lint/typecheck/672 teste unitare/build/structure/reachable/drops) —
toate verzi.

Cele patru migrații de mai sus sunt **APPLIED LIVE**. Vezi `docs/MIGRATII.md`
pentru ledger.

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
- turele pot fi încă asociate oricărei Arii, fără o validare de domeniu care
  să restrângă la Arii de Delivery — ratele de fuel/vehicle cost nu mai sunt
  cuplate de Arie (rezolvat de rundele Vehicle-fuel și D1), dar clasificarea
  turei pe Arie rămâne nevalidată semantic.

Pentru istorie: `docs/JURNAL.md` și `docs/audits/`.
Pentru produsul țintă: `docs/PLAN.md`.
