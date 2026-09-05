# Life Control Centre

Un Life OS construit în jurul unui nucleu comun, nu al unor module izolate.

Pentru produs și arhitectură: [`docs/PLAN.md`](docs/PLAN.md).
Pentru ce există acum: [`docs/STAREA.md`](docs/STAREA.md).
Pentru regulile agentului: [`CLAUDE.md`](CLAUDE.md).

## Setup

Copiază `.env.example` în `.env.local` și completează:

    VITE_SUPABASE_URL
    VITE_SUPABASE_PUBLISHABLE_KEY

Production și Preview trebuie să aibă configurații separate. Preview nu
primește baza de producție.

## Comenzi

`package.json` este sursa de adevăr pentru scripturi.

Cele folosite frecvent sunt:

    npm run dev
    npm run lint
    npm run typecheck
    npm test
    npm run build
    npm run check

Verificări specializate disponibile în prezent:

    npm run check:structure
    npm run check:rls
    npm run check:cycle
    npm run check:layout
    npm run check:reachable
    npm run check:drops

În timpul dezvoltării se rulează verificarea relevantă schimbării. Înaintea
unui push autorizat, poarta normală este o singură comandă:

    npm run check

Nu este nevoie să rulezi manual toate verificările una câte una dacă poarta le
poate selecta.

## Baza locală

Migrațiile stau în `supabase/migrations/`.

Verificările care au nevoie de PostgreSQL/Supabase trebuie să folosească o bază
locală/efemeră, nu production.

Pentru starea declarată a bazei live și drift cunoscut vezi
[`docs/MIGRATII.md`](docs/MIGRATII.md).

## Teste manuale

Ce nu poate demonstra automatizarea este definit în
[`docs/TESTE.md`](docs/TESTE.md).

În special, Safari pe iPhone și comportamentul pe două dispozitive reale rămân
teste manuale. `check:cycle` validează ciclul automat pe mediul lui; nu
înlocuiește testul real pe două dispozitive.

## Documentație

- `docs/PLAN.md` — produs și arhitectură țintă;
- `docs/STAREA.md` — starea curentă;
- `docs/MIGRATII.md` — ledger pentru baza live;
- `docs/TESTE.md` — definiții de teste manuale;
- `docs/DEZASTRU.md` — procedura când aplicația nu mai merge;
- `docs/JURNAL.md` — arhivă de decizii/încercări rare, nu jurnal obligatoriu;
- `docs/audits/` — audituri istorice imuabile.

Problemele urmărite explicit pot sta în GitHub Issues, dar nu sunt încărcate
automat la începutul fiecărei sesiuni.
