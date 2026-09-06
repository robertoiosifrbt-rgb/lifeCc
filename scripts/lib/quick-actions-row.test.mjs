// Proves what quickActionRun.test.ts cannot: that a rejected delivery.work
// write in the *real*, rendered QuickActionsRow shows up as a real visible
// role="alert" element, never opens anything, and lets the button go back to
// enabled — not just that the helper functions compose correctly in the
// abstract.
//
// There is no DOM-rendering framework anywhere else in this repository (no
// jsdom, no @testing-library) — adding one for a single component would be a
// new testing framework for a one-off check. What the repository already has
// is Vite, the app's own bundler, and Playwright, already a devDependency and
// already how check-layout.mjs drives a real browser (see
// scripts/lib/browser.mjs). This bundles the one real component into a
// self-contained script with Vite and renders it in a real Chromium page —
// the same two tools, nothing new, proving the actual DOM the component
// produces rather than a re-implementation of it.

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'

import react from '@vitejs/plugin-react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { build } from 'vite'

import { engine } from './browser.mjs'

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

function entrySource() {
  const component = path.join(ROOT, 'src/screens/today/QuickActionsRow.tsx')
  const areaModule = path.join(ROOT, 'src/repository/area.ts')
  const quickActionModule = path.join(ROOT, 'src/repository/quick-action.ts')

  return `
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QuickActionsRow } from ${JSON.stringify(component)}
import { fromRow as areaFromRow } from ${JSON.stringify(areaModule)}
import { fromRow as quickActionFromRow } from ${JSON.stringify(quickActionModule)}

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
  startDeliveryWork: () => Promise.reject(new Error('could not reach the server')),
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

async function buildHarness(workDir) {
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

describe('QuickActionsRow, rendered for real', () => {
  let workDir
  let bundle
  let browser
  let page

  beforeAll(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'quick-actions-row-'))
    bundle = await buildHarness(workDir)
    browser = await engine().launch()
    page = await browser.newPage()
    await page.setContent('<div id="root"></div>')
    await page.addScriptTag({ content: bundle })
    await page.waitForSelector('button[name="delivery-work"]')
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    if (workDir !== undefined) await rm(workDir, { recursive: true, force: true })
  })

  it(
    'shows the rejection in a visible alert, opens nothing, and releases busy',
    async () => {
      expect(await page.textContent('button[name="delivery-work"]')).toBe('Start delivery work')

      await page.click('button[name="delivery-work"]')
      await page.waitForSelector('[role="alert"]')

      expect(await page.textContent('[role="alert"]')).toBe('could not reach the server')
      expect(await page.evaluate(() => window.__harness.openItemCalls.length)).toBe(0)

      // Busy is released once the rejection is handled — the button is
      // clickable again, not stuck disabled behind a failed attempt.
      expect(await page.isDisabled('button[name="delivery-work"]')).toBe(false)
    },
    30_000,
  )
})
