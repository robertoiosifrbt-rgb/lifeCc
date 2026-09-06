// The harness for the rendered QuickActionsRow check: everything needed to
// turn the real component into a script a browser can run.
//
// There is no DOM-rendering framework anywhere else in this repository (no
// jsdom, no @testing-library) — adding one for a single component would be a
// new testing framework for a one-off check. What the repository already has
// is Vite, the app's own bundler, and Playwright, already a devDependency and
// already how check-layout.mjs drives a real browser (see
// scripts/lib/browser.mjs). This bundles the one real component into a
// self-contained script with Vite; scripts/check-quick-actions-row.mjs renders
// it in a real page and makes the assertions.
//
// It is deliberately not a `.test.mjs`: `npm test` is the cheap job that runs
// without browsers installed, and a Vitest file that launches Chromium turns
// it into a job that needs them.

import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import react from '@vitejs/plugin-react'
import { build } from 'vite'

const ROOT = path.resolve(import.meta.dirname, '../..')

// The generated entry lives in a temp directory outside the project tree, so
// a bare specifier in it (`react-dom/client`, and so on) cannot be found by
// Node's own upward node_modules search the way one written inside src/
// would be. Resolved here, from this file's own real location, and passed in
// as aliases — everything QuickActionsRow itself imports is a relative path
// from its real file in src/, so only the entry's own bare specifiers need
// this.
const resolveFromHere = createRequire(import.meta.url).resolve
const REACT_ALIASES = {
  'react-dom/client': resolveFromHere('react-dom/client'),
  'react/jsx-dev-runtime': resolveFromHere('react/jsx-dev-runtime'),
  'react/jsx-runtime': resolveFromHere('react/jsx-runtime'),
  react: resolveFromHere('react'),
  'react-router-dom': resolveFromHere('react-router-dom'),
}
const STAMPS = `{
  version: 1,
  created_at: '2026-09-06T07:00:00+00:00',
  updated_at: '2026-09-06T07:00:00+00:00',
  deleted_at: null,
}`

/** The message the rejected write fails with, asserted on the other side. */
export const REJECTION = 'could not reach the server'

function entrySource() {
  const component = path.join(ROOT, 'src/screens/today/QuickActionsRow.tsx')
  const areaModule = path.join(ROOT, 'src/repository/area.ts')
  const quickActionModule = path.join(ROOT, 'src/repository/quick-action.ts')
  // The same three stylesheets the real screen loads for this component:
  // tokens + reset from main.tsx, TodayScreen.css from TodayScreen.tsx.
  // `?inline` returns each as a string instead of Vite extracting a separate
  // CSS asset, which a bare `build()` here has nothing to link back in.
  // Without them every tap-target measurement would be against unstyled,
  // var()-less boxes — not the pixels a phone actually gets.
  const tokensCss = path.join(ROOT, 'src/styles/tokens.css?inline')
  const resetCss = path.join(ROOT, 'src/styles/reset.css?inline')
  const screenCss = path.join(ROOT, 'src/screens/today/TodayScreen.css?inline')

  return `
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QuickActionsRow } from ${JSON.stringify(component)}
import { fromRow as areaFromRow } from ${JSON.stringify(areaModule)}
import { fromRow as quickActionFromRow } from ${JSON.stringify(quickActionModule)}
import tokensCss from ${JSON.stringify(tokensCss)}
import resetCss from ${JSON.stringify(resetCss)}
import screenCss from ${JSON.stringify(screenCss)}

const style = document.createElement('style')
style.textContent = tokensCss + '\\n' + resetCss + '\\n' + screenCss
document.head.appendChild(style)

const stamps = ${STAMPS}

const area = areaFromRow({ id: 'area-1', owner: 'a', name: 'Delivery', parent_id: null, ...stamps })
const quickAction = quickActionFromRow({
  id: 'qa1', owner: 'a', action_key: 'delivery.work', area_id: 'area-1', position: 0, ...stamps,
})

window.__harness = { openItemCalls: [] }

const data = {
  items: [],
  shifts: [],
  areas: [area],
  quickActions: [quickAction],
  startDeliveryWork: () => Promise.reject(new Error(${JSON.stringify(REJECTION)})),
  clockOn: () => Promise.reject(new Error('should not be called')),
}

function openItem(item) {
  window.__harness.openItemCalls.push(item)
}

createRoot(document.getElementById('root')).render(
  <MemoryRouter>
    <QuickActionsRow data={data} openItem={openItem} today="2026-09-06" onSpend={() => {}} />
  </MemoryRouter>,
)
`
}

/** Bundles the real component, and returns the script to put in a page. */
export async function buildHarness(workDir) {
  const entryPath = path.join(workDir, 'entry.tsx')
  await writeFile(entryPath, entrySource(), 'utf8')

  const outDir = path.join(workDir, 'dist')
  await build({
    configFile: false,
    root: ROOT,
    mode: 'production',
    logLevel: 'warn',
    plugins: [react()],
    resolve: { alias: REACT_ALIASES },
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      // A single IIFE, never split — the module-preload helper Vite would
      // otherwise inject only makes sense for a real multi-chunk app and
      // warns about `import.meta` under this output format for no benefit
      // here.
      modulePreload: false,
      rollupOptions: {
        input: entryPath,
        output: { format: 'iife', entryFileNames: 'bundle.js' },
      },
    },
  })

  return readFile(path.join(outDir, 'bundle.js'), 'utf8')
}
