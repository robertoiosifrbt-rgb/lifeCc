#!/usr/bin/env node
/**
 * `npm run check` — POARTA, ÎNTR-O SINGURĂ COMANDĂ.
 *
 * ─── De ce există ───────────────────────────────────────────────────────────
 * Poarta erau **șase comenzi scrise în proză**, în CLAUDE.md. 🔴 Măsurat în
 * ziua în care s-a scris pasul: într-o singură sesiune am rulat cinci din șase
 * de două ori la rând, și de fiecare dată cea sărită a fost cea care vedea
 * greșeala. Prima oară CI-ul a picat cu șase cazuri RLS; a doua oară un buton
 * de 43px pe un telefon de 320.
 *
 * ⚠️ O regulă pe care o sar de două ori la rând nu e o problemă de disciplină,
 * e o verificare lipsă. Șase comenzi copiate de mână au șase ocazii de a fi
 * uitate; una are zero.
 *
 * ⛔ **Se citește codul de ieșire al fiecărui pas, niciodată linia de sumar** —
 * și niciodată printr-o conductă: `| tail` întoarce codul lui `tail`, care e
 * mereu 0. De-aia `spawnSync` moștenește ieșirea în loc s-o filtreze.
 *
 * ⛔ **Un pas care nu poate rula NU e un pas trecut.** Verificările care cer o
 * bază sau un browser pică zgomotos când le lipsește ce le trebuie, cu ce ar fi
 * verificat scris pe ecran. Un checker care sare tăcut peste jumătate din
 * aplicație e o bifă verde care nu verifică nimic.
 *
 * Rulare:  npm run check          — doar pașii pe care felia îi atinge
 *          npm run check -- --all — toți, oricât ai atins
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

/**
 * ─── Incrementală ───────────────────────────────────────────────────────────
 * Fiecare pas are **intrările** lui. O felie care atinge numai documente nu are
 * ce afla din `build`; una care atinge numai cod nu are ce afla din porțile de
 * migrații.
 *
 * ⚠️ **La îndoială, rulează.** Un pas fără hartă de intrări atinge tot, iar
 * dacă git nu răspunde se rulează toate.
 */
const ALL = process.argv.includes('--all')

const CODE = [/^src\//, /^scripts\//, /^package(-lock)?\.json$/, /^tsconfig/, /^vite/, /^eslint/]
const SQL = [/^supabase\//, /^scripts\//]

/**
 * Pașii, în ordinea în care merită să pice.
 *
 * Cel mai ieftin întâi, ca să nu aștepți un build ca să afli de o virgulă. Iar
 * porțile care se uită în afara mașinii ăsteia la urmă, fiindcă ele sunt cele
 * care spun ce se rupe la altcineva.
 */
const STEPS = [
  ['lint', ['npm', 'run', 'lint'], 'stilul și greșelile pe care le vede ESLint', CODE],
  ['typecheck', ['npm', 'run', 'typecheck'], 'tipurile — testele nu le văd', CODE],
  ['test', ['npm', 'run', 'test'], 'logica, pe cifre socotite de mână', CODE],
  ['build', ['npm', 'run', 'build'], 'că se împachetează, nu doar că se compilează', CODE],
  ['structure', ['npm', 'run', 'check:structure'], 'un fișier, o treabă, 300 de rânduri', CODE],
  /**
   * 🆕 Ziua în care ecranul HMRC a fost construit, testat, fotografiat — și
   * nu se putea ajunge la el.
   *
   * 🔴 Singurul link pornea de sub blocul lunii din Calendar, iar blocul acela
   * nu se desenează într-o lună fără muncă în ea. ⛔ `typecheck` vedea ruta,
   * testele vedeau componenta, `build` le împacheta pe amândouă: toate trei
   * verzi, ecranul de neatins. Proprietarul l-a căutat și nu l-a găsit.
   */
  ['reachable', ['npm', 'run', 'check:reachable'], 'are fiecare ecran o ușă?', CODE],
  /**
   * 🆕 Ziua în care un SQL corect a omorât aplicația de pe telefon.
   *
   * 🔴 Migrația ștergea `reserves`, iar codul care nu mai avea nevoie de el era
   * scris și testat — **aici**. Pe telefon rula ce e pe GitHub, și acela cerea
   * tabelul la fiecare sincronizare. ⛔ Toate celelalte se uită la ce e aici;
   * greșeala era în ordinea dintre două lucruri care nu pleacă împreună.
   */
  ['drops', ['npm', 'run', 'check:drops'], 'sparge migrația asta aplicația livrată?', SQL],
]

/**
 * Pașii care se uită la aplicația adevărată, și de ce nu rulează aici.
 *
 * ⛔ Nu sunt „opționali". Sunt pașii care au prins, fiecare la rândul lui,
 * lucruri pe care restul nu le văd: RLS-ul vede ce poate citi un client, iar
 * layout-ul vede un text sub bara de status. Poarta îi numește la final ca să
 * nu poți crede că ai verificat tot.
 */
const env =
  (...names) =>
  async () =>
    names.every((one) => process.env[one] !== undefined)

/**
 * Există pe mașina asta Chromium-ul de care are nevoie `check:quick-actions-row`?
 *
 * ⛔ Nu o variabilă de mediu: pasul nu cere chei, cere un browser instalat.
 * Întrebat pe Playwright însuși, nu ghicit dintr-o cale.
 *
 * ⛔ Și nu numele variabilei: `CHROMIUM_EXECUTABLE` setat spre un fișier care
 * nu există ar raporta „poate rula" pentru un browser inexistent. Se verifică
 * fișierul. O valoare goală nu e un override — exact ce face și
 * scripts/lib/browser.mjs cu aceeași variabilă.
 *
 * Chromium anume, fiindcă asta cere pasul: `CHECK_BROWSER` nu-l mai mută.
 */
const chromiumForCheck = async () => {
  const override = process.env.CHROMIUM_EXECUTABLE
  if (override) return existsSync(override)
  try {
    const { chromium } = await import('playwright')
    return existsSync(chromium.executablePath())
  } catch {
    return false
  }
}

const ELSEWHERE = [
  ['check:rls', 'ce poate citi și scrie de fapt un client', 'DATABASE_URL', env('DATABASE_URL')],
  [
    'check:layout',
    'ce se vede pe un telefon de 320px',
    'CHECK_EMAIL și CHECK_PASSWORD',
    env('CHECK_EMAIL', 'CHECK_PASSWORD'),
  ],
  /**
   * 🆕 A fost un `.test.mjs`, deci `npm test` părea că-l acoperă — dar cerea
   * browsere instalate ca să treacă, în jobul ieftin care nu le are. Aici e
   * numit ca ce este: un pas care se uită la DOM-ul adevărat și care nu poate
   * rula fără browser.
   */
  [
    'check:quick-actions-row',
    'ce DOM produce de fapt QuickActionsRow când o scriere e refuzată',
    'Chromium instalat pentru Playwright',
    chromiumForCheck,
  ],
]

/** Ce a atins felia asta: arborele de lucru, plus ce e comis peste bază. */
function touched() {
  const git = (args) => {
    const run = spawnSync('git', args, { encoding: 'utf8' })
    return run.status === 0 ? (run.stdout ?? '').split('\n').filter(Boolean) : null
  }
  const work = git(['status', '--porcelain'])
  // ⛔ `null` nu e „nimic atins" — e „git n-a răspuns", și atunci rulăm tot.
  if (work === null) return null
  const files = new Set(work.map((line) => line.slice(3).split(' -> ').pop()))
  for (const file of git(['diff', '--name-only', 'origin/main...HEAD']) ?? []) {
    files.add(file)
  }
  return [...files]
}

const files = ALL ? null : touched()
const wanted = (inputs) =>
  ALL || files === null || files.some((file) => inputs.some((form) => form.test(file)))

const failed = []
const skipped = []

for (const [name, command, why, inputs] of STEPS) {
  if (!wanted(inputs)) {
    skipped.push(name)
    continue
  }
  process.stdout.write(`\n── ${name}: ${why}\n`)
  const [program, ...args] = command
  const run = spawnSync(program, args, { stdio: 'inherit' })
  // Codul de ieșire, nu ce a scris pe ecran.
  if (run.status !== 0) failed.push(name)
}

if (skipped.length > 0) {
  console.log(`\nSărite, fiindcă felia nu le atinge intrările: ${skipped.join(', ')}`)
}

console.log('\n── ce nu se poate verifica de aici')
for (const [name, why, needs, available] of ELSEWHERE) {
  const has = await available()
  console.log(`   ${has ? 'poate rula' : 'NU a rulat'}  ${name} — ${why} (cere ${needs})`)
}

if (failed.length > 0) {
  console.error(`\nPoarta e închisă: ${failed.join(', ')}`)
  process.exit(1)
}
console.log('\nPoarta e deschisă.')
