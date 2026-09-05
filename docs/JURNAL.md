# Jurnal — arhivă de decizii

Fișierul ăsta nu este jurnal obligatoriu de sesiune și nu se citește automat la
pornire.

Se deschide numai când trebuie aflat **de ce** s-a luat o decizie veche sau ce
s-a încercat și s-a abandonat, iar răspunsul nu există în cod, plan, stare,
migrații, issue sau commit.

Nu ține:

- starea curentă — `STAREA.md`;
- probleme deschise — Issues, când sunt folosite;
- schema live — `MIGRATII.md`;
- explicații de cod — cod/commit;
- teste — `TESTE.md`;
- cronologia tool-urilor sau auto-analiza agentului.

O intrare nouă se adaugă numai pentru o decizie sau o descoperire importantă
care altfel s-ar pierde.

---

## 4 septembrie 2026

- `docs/REGISTRU.md` a fost abandonat: starea problemelor nu se dublează într-un
  fișier manual.
- Codul și UI-ul au fost stabilite în engleză; documentele pot rămâne în
  română.

## 5 septembrie 2026 — delivery / expenses

- Fuel purchase este cheltuiala; kilometrii descriu consumul ei. Aceiași bani
  nu se scad încă o dată ca „running cost” al turei.

## 5 septembrie 2026 — istoric și issues

- Un issue este o pistă, nu dovadă; corpul lui poate rămâne vechi chiar dacă o
  corectare există în comentarii.
- Codul de dinainte de golirea intenționată a repo-ului nu este model pentru
  produsul curent.

## 5 septembrie 2026 — verificare și autorizare

- O întrebare a proprietarului nu este comandă.
- O autorizare de `push` nu devine permisiune permanentă pentru următoarele
  push-uri.
- Verificarea completă înainte de push a fost unificată în `npm run check`, ca
  să nu se sară pași manual.

## 5 septembrie 2026 — baza locală și Life Core

- PostgreSQL local poate reproduce rolurile/RLS suficient pentru a verifica
  migrații și comportamentul real de upsert; nu este nevoie să ghicești pentru
  că live-ul nu este accesibil.
- Testele pentru bug-uri de DB trebuie văzute căzând pe starea stricată înainte
  de a fi considerate regresii utile.
- Modelul Life CC cerut este un nucleu de obiecte legate, nu module separate.
  Exemplul de referință: asigurarea mașinii leagă acțiune, deadline, cost,
  document, mașină și companie fără copii paralele.
- Dacă răspunsul poate fi dedus din tiparul existent și alegerea este mică și
  reversibilă, nu se transformă în întrebare pentru proprietar.

## 5 septembrie 2026 — aplicația de referință și mockup-ul

- Când proprietarul dă o aplicație de referință și un mockup, livrarea trebuie
  să urmărească rezultatul vizibil, nu să se transforme într-o serie de teme
  manuale fără progres vizibil.
- Valorile numerice din mockup sunt exemple dacă nu sunt declarate cerințe.
  `Available £1,840` nu justifică inventarea unui sold bancar.
- CI-ul curent nu are credențiale pentru modificarea bazei live; aplicarea pe
  production rămâne o acțiune separată până când este proiectată explicit o
  automatizare sigură.
