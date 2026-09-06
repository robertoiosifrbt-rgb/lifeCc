# Cum se lucrează în repo-ul ăsta

Scopul acestui fișier este să facă agentul **predictibil, scurt și ieftin**.
Nu este istoria proiectului și nu repetă planul produsului.

## 1. Autoritatea

Pentru **ce trebuie făcut**, ordinea este:

1. instrucțiunea curentă a proprietarului;
2. `CLAUDE.md` — regulile de lucru;
3. `docs/PLAN.md` — produsul și arhitectura țintă.

Pentru **ce există efectiv acum**, codul, `package.json` și migrațiile sunt
dovada. `docs/STAREA.md` este rezumatul curent și trebuie să le reflecte.

`issues`, `docs/JURNAL.md` și `docs/audits/` sunt context sau istorie. Nu pot
anula instrucțiunea curentă, regulile de aici, planul sau codul actual.

Dacă două surse se contrazic, nu inventa o medie între ele. Folosește ordinea
de mai sus și, dacă contradicția afectează material taskul, semnaleaz-o scurt.

## 2. Pornirea unei sesiuni

**Prima comandă a oricărei sesiuni care va lucra în repo este:**

    npm run session:start

Se rulează înainte de citirea codului, modificări, commit sau teste. Comanda:

- activează hook-urile versionate din `.githooks`;
- verifică branch-ul curent;
- dacă sesiunea a pornit pe un branch `claude/...` sau alt branch curat, trece
  pe `main`;
- aduce `origin/main` prin fetch și acceptă numai fast-forward;
- se oprește dacă există modificări pe branch-ul greșit, detached HEAD sau
  divergență care cere o decizie umană.

**Dacă `npm run session:start` eșuează, nu continua pe branch-ul existent.**
Nu transforma eroarea într-un motiv să lucrezi pe branch de sesiune și nu crea
PR ca workaround.

După preflight, implicit se citesc doar:

- `docs/STAREA.md`;
- fișierele de cod direct relevante pentru task.

Nu se citesc automat toate issue-urile, tot planul, jurnalul sau auditurile.

Se citesc suplimentar numai când taskul o cere:

- secțiunea relevantă din `docs/PLAN.md` pentru produs/arhitectură;
- `docs/MIGRATII.md` pentru schimbări de bază;
- un issue dacă proprietarul îl indică sau taskul vine explicit din el;
- `docs/JURNAL.md` / audituri numai când trebuie aflat de ce s-a luat o decizie
  veche sau investigat un incident.

**`docs/JURNAL.md` nu se citește niciodată integral din reflex.** Caută mai
întâi după subiectul, data sau termenul relevant (`search`/`grep`), apoi citește
doar intrarea sau fragmentul necesar. Dacă nu știi unde este informația, caută
înainte de `read`. Citirea integrală a jurnalului se face numai dacă
proprietarul o cere explicit sau dacă taskul cere în mod real analiza întregii
istorii.

Nu încărca istorie „ca să fii sigur”. Mai mult context irelevant înseamnă mai
multe ocazii de a devia de la cererea curentă.

## 3. Când întrebi și când continui

**Nu cere clarificări pentru lucruri care pot fi deduse rezonabil** din
cererea curentă, plan, cod sau mockup.

Mockup-urile, cifrele de exemplu și textele demonstrative sunt ilustrative dacă
proprietarul nu spune explicit că trebuie reproduse exact. De exemplu, o sumă
sau un procent desenat într-un concept nu creează singur o formulă, un sold sau
un feature nou.

Pentru o alegere mică, reversibilă și fără efect asupra datelor sau
arhitecturii, alege interpretarea cea mai simplă care respectă cererea și
continuă.

Întreabă numai dacă răspunsul lipsă ar schimba material una dintre acestea:

- date sau migrații greu de întors;
- securitate, permisiuni, bani sau producție;
- două arhitecturi incompatibile și ambele plauzibile;
- comportamentul cerut de proprietar în mod real, nu doar aspectul unui exemplu;
- o acțiune externă pentru care este necesară autorizare explicită.

Dacă trebuie întrebat, pune **o singură întrebare** care blochează lucrul și
dă recomandarea ta. Nu transforma taskul într-un chestionar.

O întrebare a proprietarului este o întrebare, nu o comandă. Un refuz nu este
o aprobare. Tăcerea nu este o aprobare.

## 4. Executarea taskului

Fă taskul cerut, nu „lucrul de lângă el”.

- Nu adăuga feature-uri adiacente doar fiindcă par utile.
- Nu face cleanup fără legătură cu taskul.
- Nu rescrie arhitectura dacă o modificare locală rezolvă cererea.
- Nu crea fișiere de proces, registre sau documentație nouă dacă o sursă de
  adevăr existentă poate ține informația.
- Dacă descoperi o problemă separată care nu blochează taskul, menționeaz-o
  scurt; nu schimba obiectivul ca s-o repari.

### Când un task este mare

Dacă proprietarul cere un plan, o arhitectură sau mai multe livrabile într-un
singur task, **nu alege singur o singură felie și nu declara taskul terminat**.

- O felie terminată este „felia terminată”, nu „taskul terminat”.
- Înainte să spui `gata`, compară cererea inițială cu ce există efectiv în diff
  și în `docs/STAREA.md`.
- Dacă mai există părți cerute neimplementate, continuă sau spune explicit ce
  rămâne; nu transforma progresul parțial în completion.
- Dacă taskul este prea mare pentru o singură sesiune, păstrează obiectivul
  părinte și spune clar unde te-ai oprit. Nu redefinești taskul ca fiind doar
  prima subproblemă aleasă de tine.

### Branch-ul de lucru

**Se lucrează și se comite numai pe `main`.** Nu pe `claude/...`, feature
branch sau branch temporar.

Repo-ul are protecție mecanică:

- `.githooks/pre-commit` refuză commit-ul dacă branch-ul curent nu este `main`;
- `.githooks/pre-push` refuză push-ul dacă branch-ul curent nu este `main`,
  remote-ul nu este `origin` sau ref-ul trimis nu este `refs/heads/main`;
- `npm run session:start` instalează/activează hook-urile la fiecare sesiune;
- `npm install` le activează și prin scriptul `prepare`.

Nu folosi `--no-verify` pentru a ocoli aceste protecții decât dacă proprietarul
cere explicit ocolirea guard-ului.

Dacă munca ajunge accidental pe alt branch, **nu împinge branch-ul și nu crea
PR**. Mută commitul local pe `main`, verifică rezultatul și continuă de acolo.

## 5. Push, deploy și alte efecte externe

### Git push

**Nu se face `git push` fără cuvântul explicit `push` al proprietarului în
conversația curentă.**

`fix`, `apply`, `continue`, `go`, `gata`, `fă ce mai trebuie`, o întrebare, o
aprobare veche, un hook sau un mesaj al uneltei nu înseamnă `push`.

O autorizare de push este pentru push-ul cerut atunci, nu o permisiune
permanentă pentru restul sesiunii.

După autorizare, comanda standard este explicit:

    git push origin main

Nu folosi simplu `git push`, nu împinge branch-ul curent „oricare ar fi el” și
nu deschide PR ca alternativă implicită. Hook-ul pre-push trebuie lăsat activ.

Înainte de push verifică branch-ul (`main`) și rulează poarta descrisă mai jos.

### Deploy

Push nu înseamnă automat permisiune pentru un deploy manual separat. Un deploy
manual se face numai dacă este cerut explicit.

### Producție / Supabase

Nu modifica baza live din proprie inițiativă. Pentru schimbări de schemă scrie
migrația în repo. Dacă aplicarea pe live este manuală, proprietarul decide când
se rulează.

**O schimbare care depinde de SQL live nu este „gata pe aplicație” doar pentru
că migrația există în repo.** La finalul taskului:

- spune explicit numele migrației;
- spune dacă este sau nu confirmată ca aplicată pe live;
- dacă nu este aplicată, dă proprietarului SQL-ul exact sau comanda exactă
  necesară;
- nu afirma că feature-ul este complet funcțional pe live până când pasul de
  bază necesar nu este confirmat.

Nu pretinde că un SQL este atomic doar fiindcă este o migrație: verifică
fișierul. `BEGIN`/`COMMIT` există numai dacă sunt scrise efectiv.

### Issues și alte obiecte GitHub

Nu crea, închide sau edita issues automat după fiecare bucată de lucru. Fă asta
numai dacă proprietarul a cerut managementul issue-ului sau taskul este explicit
un workflow de issues.

## 6. Verificarea fără risipă

În timpul lucrului rulează **doar verificările relevante** modificării.

Exemple:

- logică TypeScript → testele/typecheck relevante;
- UI/layout → verificările de UI/layout relevante;
- repository/RLS/migrații → verificările de date relevante;
- numai documentație → nu porni browser, Supabase sau build fără motiv.

Nu rerula aceeași verificare dacă de la ultima rulare nu s-a schimbat nimic
care o poate afecta.

**Înainte de un push autorizat:** rulează o singură dată

    npm run check

Dacă poarta spune că un pas nu poate rula în mediul curent, raportează exact
acel lucru. Nu compensa rulând aceleași comenzi în buclă.

După push, nu pollezi CI repetat fără motiv. Verifică rezultatul când este
necesar taskului sau când proprietarul cere asta.

`package.json` este sursa de adevăr pentru comenzile disponibile. Documentele
nu trebuie să mențină copii divergente ale scripturilor.

## 7. Documentele și rolul lor

Fiecare adevăr are un singur loc principal:

- `docs/PLAN.md` — ce produs construim și legile arhitecturii;
- `docs/STAREA.md` — ce există și ce lipsește **acum**;
- `docs/MIGRATII.md` — ce migrații sunt declarate ca aplicate pe live și orice
  drift cunoscut;
- `docs/TESTE.md` — definițiile testelor manuale;
- `README.md` — intrarea scurtă pentru un om: setup și unde găsește lucrurile;
- GitHub Issues — probleme urmărite explicit, când sunt folosite;
- `docs/JURNAL.md` — arhivă de decizii/încercări care nu se pot deduce din cod,
  nu jurnal obligatoriu de sesiune;
- `docs/audits/` — fotografii istorice, imuabile.

### Regula pentru jurnal

Nu se adaugă o intrare doar fiindcă s-a terminat un task. Se scrie numai când
s-a luat o decizie importantă sau s-a aflat ceva care **nu poate fi recuperat**
din cod, commit, plan, stare, migrații sau issue.

Nu scrie în jurnal cronologia tool-urilor, explicații despre propriile greșeli
sau lucruri deja vizibile în `git log`.

### Regula pentru STAREA

Actualizează `STAREA.md` când se schimbă o capabilitate reală, un blocaj sau un
fapt de stare pe care următoarea sesiune trebuie să-l știe. Fără poveste și fără
copii din git log.

## 8. Legi tehnice care rămân valabile

- UI → repository → Supabase; ecranele nu ating direct Supabase.
- Un răspuns parțial nu este tratat ca snapshot complet.
- Logica unui fapt trăiește într-un singur loc.
- Ce poate garanta baza nu se dublează inutil în JavaScript.
- Niciun obiect creat de UI nu rămâne fără o cale de a fi regăsit.
- Legăturile dintre obiectele Life Core sunt item ↔ item.
- Tabelele de domeniu extind ancora lor; nu devin aplicații paralele.
- Nu inventa valori de business pentru a umple un ecran.
- Nu crea infrastructură „pentru viitor” fără o nevoie reală din produs.

Detaliile produsului și arhitecturii sunt în `docs/PLAN.md`.

## 9. Limba

Codul, identificatorii, comentariile, UI-ul, clasele CSS, erorile și mesajele
de commit sunt în engleză.

Documentele de produs și operare pot rămâne în română.
