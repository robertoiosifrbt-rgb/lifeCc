/**
 * A migration that removes something the LIVE app still asks for.
 *
 * 🔴 **Măsurat în ziua în care s-a scris:** SQL-ul dat proprietarului ștergea
 * tabelul `reserves`. Migrația era curată — cele 12 rulau de la zero pe
 * PostgreSQL 16 — și codul care nu mai avea nevoie de el era scris și testat.
 * ⛔ Dar codul acela era **aici**, iar aplicația de pe telefonul lui rula ce e
 * pe GitHub, și aceea cerea `reserves` la fiecare sincronizare. A rulat SQL-ul
 * și aplicația a murit pe loc: „Fetching the reserves".
 *
 * ⚠️ Nicio verificare nu putea prinde asta: baza și codul sunt corecte fiecare
 * în parte, iar toate șase verificările se uită la ce e **aici**. Greșeala e în
 * ordinea dintre două lucruri care nu pleacă împreună — migrația se duce în
 * bază când proprietarul o rulează, codul se duce la un push.
 *
 * ✅ Regula: pentru orice `drop` din migrații, codul **livrat** nu are voie să
 * mai numească lucrul șters. Când amândouă sunt sus, poarta trece. Până atunci
 * pică, și mesajul spune ce spune: nu rula SQL-ul înainte de a livra codul.
 */

/**
 * Every column name the same migration (re)introduces — as a fresh column
 * on some table, dropped or not.
 *
 * A name dropped from one table and given right back, in the same file, to
 * a table built to hold what that column meant — `platform_rules` taking
 * `earning_cycle_kind` back from `platforms`, effective-dated this time —
 * has moved, not vanished. Code still naming it is naming its new home; that
 * the new home reads it correctly is typecheck's and the tests' job, not
 * this one's. Table-blind on purpose, the same way `dropsIn` already is: a
 * column moved to the wrong table by mistake still has a name this simple a
 * scan cannot tell from the right one.
 */
function createdIn(sql) {
  const created = new Set()
  for (const m of sql.matchAll(
    /^\s*(?:add\s+column\s+(?:if\s+not\s+exists\s+)?)?(\w+)\s+(?:uuid|text|boolean|integer|smallint|bigint|numeric|date|timestamptz|timestamp|jsonb)\b/gim,
  )) {
    created.add(m[1])
  }
  return created
}

/** What a migration takes away, as the name a client would still ask for. */
export function dropsIn(sql) {
  const recreated = createdIn(sql)
  const gone = []
  for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?(\w+)/gi)) {
    if (!recreated.has(m[1])) gone.push({ kind: 'table', name: m[1] })
  }
  for (const m of sql.matchAll(/drop\s+column\s+(?:if\s+exists\s+)?(\w+)/gi)) {
    if (!recreated.has(m[1])) gone.push({ kind: 'column', name: m[1] })
  }
  return gone
}

/**
 * Comments stripped, because prose is not a request.
 *
 * ⚠️ The first run of this check reported four files for a table that none of
 * them queried: the word sat in a comment explaining why the table had gone,
 * and in the name of a test. A gate that cries four times on its first run is
 * a gate somebody turns off.
 */
function code(contents) {
  return contents.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
}

/**
 * Whether the shipped code still asks the database for it.
 *
 * Not the bare word — the shapes a request actually takes. A table is named in
 * `from('x')`; a column is a quoted key, a property, or a field in an object
 * going to the server. Prose about it is none of those.
 */
export function stillAsked(files, name) {
  const shapes = [
    new RegExp(`from\\(\\s*['"\`]${name}['"\`]`),
    new RegExp(`['"\`]${name}['"\`]\\s*:`),
    new RegExp(`\\.${name}\\b`),
    new RegExp(`\\b${name}\\s*:`),
  ]
  return files.filter(
    ({ path, contents }) =>
      /^src\/(?!.*\.test\.)[^\s]*\.tsx?$/.test(path) &&
      shapes.some((one) => one.test(code(contents))),
  )
}
