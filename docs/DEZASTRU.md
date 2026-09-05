# Când aplicația nu mai merge

Procedură scurtă pentru incidente. Nu ține istoria incidentelor; aceea poate fi
căutată în git/jurnal numai dacă este necesară.

## 1. Identifică ultimul efect extern

În ordinea asta:

1. **S-a schimbat baza live?** Verifică ce SQL/migrație a fost aplicată și
   compară cu `docs/MIGRATII.md`.
2. **S-a schimbat codul livrat?** Verifică ultimul push/deploy și ce cere codul
   față de schema live.
3. **Nu s-a schimbat nimic extern?** Verifică autentificarea, sincronizarea,
   cache-ul și eroarea exactă afișată.

Nu investiga zece ipoteze în paralel. Dovedește sau elimină cauza cea mai
recentă întâi.

## 2. Protejează datele

Dacă aplicația încă permite exportul, folosește `Download everything` înaintea
unei reparații riscante.

Ștergerea normală din UI este soft-delete (`deleted_at`), nu DELETE fizic.

## 3. Ce nu se face

- Nu da `DROP` pe panică.
- Nu inventa o migrație inversă doar ca să anulezi rapid una deja aplicată.
- Nu presupune că baza și codul au fost livrate în aceeași ordine.
- Nu presupune că o migrație este atomică; inspectează SQL-ul real.
- Nu schimba producția fără autorizarea explicită a proprietarului.

## 4. Repară diferența, nu simptomul

Dacă schema live lipsește ceva de care codul livrat depinde, aplică numai
schimbarea necesară și autorizată.

Dacă live are o schimbare pe care codul livrat încă nu o suportă, livrează
codul compatibil sau restaurează temporar numai structura necesară, fără să
pierzi date.

Orice stare live confirmată care diferă de migrațiile din repo se notează în
`docs/MIGRATII.md` ca drift.

## 5. Verifică după reparație

Verifică exact traseul care era stricat. Nu declara incidentul rezolvat doar
pentru că o verificare vecină este verde.

Dacă problema este de UI pe telefon, testul final este pe telefon. Dacă este de
RLS/schema, testul final este pe baza relevantă. Dacă este de deployment,
verifică deployment-ul livrat.
