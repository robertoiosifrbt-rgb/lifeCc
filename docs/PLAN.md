# Life Control Centre — planul produsului

Un Life OS. Un control centre pentru tot.

Nu este un task manager, un calendar, o aplicație de finanțe sau un habit
tracker lipite între ele. Acestea sunt fețe ale aceluiași sistem.

Documentul ăsta spune **ce construim și după ce legi**. Nu spune cum lucrează
agentul; pentru asta există `CLAUDE.md`. Nu spune ce este deja livrat; pentru
asta există `docs/STAREA.md`.

## 1. Rezultatul urmărit

Life CC trebuie să fie:

- singurul loc în care intră lucrurile importante din viață;
- rapid de folosit pe telefon, cu o mână;
- de încredere pentru date reale;
- capabil să spună ce contează acum, nu doar să depoziteze;
- capabil să lege bani, timp, persoane, documente și acțiuni fără duplicare;
- tolerant când nu este folosit câteva zile sau săptămâni;
- exportabil: utilizatorul își poate lua datele înapoi.

## 2. Cum se citesc mockup-urile și exemplele

Mockup-urile descriu **structura și intenția**, nu inventează automat date sau
formule.

O cifră demonstrativă precum `£1,840`, `72%` sau `3 lucruri` este exemplu dacă
nu este declarată explicit ca cerință sau formulă.

Nu se construiește un sold bancar, un procent de „sănătate a ariei” sau altă
metrică doar pentru că apare o valoare într-un desen. Când datele reale există,
ecranul le folosește; când nu există, nu minte.

## 3. Life Core

Nucleul conceptual are șase tipuri fundamentale:

1. **Item** — ancora comună; orice lucru important care trebuie găsit și legat.
2. **Action** — ceva ce trebuie făcut.
3. **Event** — ceva legat de timp.
4. **Entity** — persoană, companie, proprietate, mașină etc.
5. **Resource** — bani, document, asset sau informație.
6. **Area / Project** — contextul în care celelalte trăiesc.

Acestea nu înseamnă obligatoriu șase tabele separate. Modelul de date se ține
cât mai mic; tipurile apar în schemă când există un caz real care le cere.

Exemplul de referință este:

> Car insurance renewal = acțiune + deadline + cost + document + mașină +
> companie + reminder + istoric, legate ca un singur lucru, nu șapte copii.

## 4. Legile coloanei vertebrale

1. Orice obiect important cu viață proprie are un **item-ancoră**.
2. Legăturile sunt întotdeauna **item ↔ item**, niciodată module ↔ module.
3. Datele de domeniu extind ancora lor; nu creează aplicații paralele.
4. UI nu vorbește direct cu Supabase: `UI → repository → Supabase`.
5. Un răspuns parțial nu este niciodată tratat ca adevăr complet.
6. Orice obiect creat are o cale clară prin care poate fi regăsit.
7. Ce poate garanta baza se garantează în bază, nu prin copii fragile în UI.
8. Identitatea și ownership-ul nu se mută între utilizatori.
9. Logica unui fapt există într-un singur loc.
10. Nu se inventează date sau formule pentru a umple un ecran.
11. Nu se adaugă infrastructură pentru viitor înaintea unei nevoi reale.
12. Fiecare tabel client-editabil are o strategie de sincronizare clară.

## 5. Fundația de date

`items` rămâne coloana comună pentru lucrurile care trebuie urmărite în viață.
Are identitate, owner, stare, titlu, date relevante, versiune, timestamps și
soft-delete.

Principii care rămân obligatorii:

- fără DELETE fizic din client;
- ownership verificat prin RLS;
- coloanele de identitate/versionare nu sunt controlate liber de client;
- `done_at` reprezintă ce s-a întâmplat, `due` ce a fost planificat;
- inbox-ul înseamnă „încă neprocesat”, nu un tip artificial de obiect;
- datele de domeniu stau în extensii ale itemului atunci când sunt necesare;
- links folosesc ownership compatibil la ambele capete.

Migrațiile sunt sursa tehnică exactă pentru schema reală; planul nu copiază
SQL-ul lor.

## 6. Stratul de date

Există o singură cale:

    UI → repository → Supabase

Repository-ul este responsabil pentru:

- citire completă și delta fără pierderea snapshot-ului;
- paginare;
- cache per utilizator;
- patch-uri, nu rescrieri brute ale obiectelor;
- conflict/version handling;
- soft-delete;
- filtrarea comună folosită de ecrane;
- exportul complet al datelor.

Un fetch eșuat nu golește cache-ul. Un delta gol înseamnă „nimic nou”, nu
„șterge tot”. Un snapshot complet și valid poate fi gol.

Offline cu outbox, drafturi persistate și retry durabil este o etapă separată;
nu se mimează înainte să existe complet.

## 7. Home / Command Centre

**Home este experiența principală și punctul de intrare în Life CC.**

Nu se adaugă implicit un al patrulea tab doar pentru Home. Conținutul actual de
Today/Azi este parte din Command Centre: ce ai de făcut azi, restanțe, inbox și
următoarele lucruri.

Home agregă date reale, de exemplu:

- ce cere atenție;
- deadline-uri apropiate;
- ce este neprocesat;
- programul de azi;
- next actions;
- waiting;
- bani care pot fi calculați corect din date existente;
- starea ariilor numai când există o metrică definită.

Dacă o valoare nu poate fi calculată din date reale, nu se afișează o valoare
ghicită.

## 8. Calendar și timp

Calendarul este o vedere peste aceleași obiecte, nu o lume separată.

Un lucru poate avea simultan:

- o dată planificată;
- o dată în care a fost făcut;
- mai târziu, evenimente sau intervale reale când produsul le cere.

O acțiune fără dată rămâne găsibilă. Nu se forțează o dată falsă doar pentru a
trece o validare.

## 9. Areas / Projects

Ariile sunt contexte de viață, nu silozuri de date. Work, Home, Personal,
Business etc. organizează aceleași obiecte Life Core.

O arie nu primește automat un procent de progres. O astfel de metrică există
numai după ce definiția ei este stabilită și datele o susțin.

## 10. Modulele

Modulele se adaugă ca extensii ale Life Core, unul câte unul, pe date reale.

Exemple de domenii:

- Work / Delivery;
- Finance / bills / debts;
- People / contacts;
- Files / documents;
- Vehicle;
- Health / habits / tracking;
- Business.

Un modul nu își face propriul univers de tasks, dates, people sau files dacă
acestea există deja în nucleu. Leagă obiectele existente.

## 11. Delivery / Work

Logica de livrări este un domeniu al Life CC, nu o aplicație separată.

Turele, sesiunile, earnings, fuel și expenses pot avea tabele de domeniu, dar
rămân legate de itemii, ariile, entitățile și resursele comune.

Câmpurile importate din aplicația de referință sunt cerințe numai când au fost
explicit adoptate și există în schema/codul curent; exportul de referință nu
devine automat a doua sursă de adevăr.

## 12. Fișiere și documente

Un document trebuie să poată fi legat de lucrul despre care este: mașină,
companie, factură, task, eveniment etc. Nu se dublează ca intrare separată în
fiecare modul.

Implementarea storage-ului apare când există primul flux real de documente.

## 13. Offline adevărat

Când este construit, offline înseamnă complet:

- scrieri fără internet;
- outbox;
- drafturi persistate;
- retry;
- rezolvare de conflicte;
- lifecycle de update pentru aplicație.

Până atunci UI-ul spune adevărul despre ce este și ce nu este salvat.

## 14. Ce nu construim implicit

Nu adăugăm fără nevoie reală:

- event sourcing;
- audit log complet;
- framework generic de sync;
- tabele „pentru viitor”;
- metrici fără definiție;
- duplicate ale acelorași date între module;
- o a doua aplicație sau o a doua cale de scriere pentru același adevăr.

## 15. Ordinea de evoluție

Ordinea logică este:

1. fundația și ciclul itemului;
2. Life Core și legăturile;
3. Home / Command Centre pe date reale;
4. domeniile existente integrate în nucleu;
5. People / Files / Finance / Tracking pe nevoi reale;
6. offline complet și conflicte durabile.

`docs/STAREA.md` spune până unde s-a ajuns astăzi. Planul nu ține procente de
implementare și nu repetă git log-ul.
