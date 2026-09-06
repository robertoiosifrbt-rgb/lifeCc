#!/usr/bin/env node
// Starts the app at phone width and fails if anything sticks out of the
// screen, if text sits under the status bar, or if a tap target is too small.
//
// It checks the sign-in screen, the screens behind it, and the two sheets — so
// it needs an account on the local Supabase. Without one it stops: a checker
// that silently skips half the app is a green check that checks nothing.
//
// It writes one row of its own first, so the lists are never empty: an empty
// screen cannot show a row that overflows.
//
// At the end it checks itself, with four deliberately broken elements.

import { spawn } from 'node:child_process'
import { engine } from './lib/browser.mjs'

import { inspect, MIN_TAP, SAFE, safeAreaCss, SIZES, TAPPABLE } from './lib/layout.mjs'

const PORT = Number(process.env.CHECK_PORT ?? 4319)
const BASE = `http://127.0.0.1:${PORT}`
const EMAIL = process.env.CHECK_EMAIL
const PASSWORD = process.env.CHECK_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error(
    'CHECK_EMAIL and CHECK_PASSWORD are missing. The app screens live behind\n' +
      'authentication, so this check needs an account on the local Supabase.\n' +
      'Production credentials are never used here.',
  )
  process.exit(1)
}

/** The screen before the account. */
const PUBLIC_PATHS = ['/sign-in']
/** The screens after the account. The last one does not exist: it needs an exit. */
const PRIVATE_PATHS = [
  '/today',
  '/calendar',
  '/things',
  '/settings',
  '/',
  '/a-path-that-does-not-exist',
]

const ARGUMENTS = { minTap: MIN_TAP, safe: SAFE, tappable: TAPPABLE }

/** Which engine to drive. Named in the output, so a green run says on what. */
const driver = engine()

async function waitForServer(attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      if ((await fetch(BASE)).ok) return
    } catch {
      // the server has not come up yet
    }
    await new Promise((done) => setTimeout(done, 250))
  }
  throw new Error(`The server did not answer at ${BASE}`)
}

function startServer() {
  const child = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  child.stderr.on('data', (chunk) => process.stderr.write(chunk))
  return child
}

/** Opens a path and waits for a real screen, not the loading state. */
async function open(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.shell, .signin', { timeout: 15000 })
  await page.addStyleTag({ content: safeAreaCss() })
}

async function signIn(page) {
  await open(page, '/sign-in')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('.signin-button')
  try {
    await page.waitForSelector('.shell', { timeout: 20000 })
  } catch {
    // If the form said why, that is the real reason.
    const said = await page
      .locator('.signin-message-error')
      .first()
      .textContent()
      .catch(() => null)
    throw new Error(
      `could not sign in as ${EMAIL}: ${said ?? 'the screen stayed on sign-in'}`,
    )
  }
}

/** Makes sure there is at least one row on screen to measure. */
async function ensureARow(page) {
  await open(page, '/today')
  if ((await page.locator('.row').count()) > 0) return
  await page.click('button[name="capture"]')
  await page.fill('.capture-input', 'a row for the layout check')
  await page.click('.capture-save')
  await page.waitForSelector('.row', { timeout: 20000 })
}

const problems = []
const server = startServer()
let browser

try {
  await waitForServer()
  browser = await driver.launch()

  for (const size of SIZES) {
    // A fresh context per width: each round starts with no stored session.
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
    })
    const page = await context.newPage()

    for (const path of PUBLIC_PATHS) {
      await open(page, path)
      collect(await page.evaluate(inspect, ARGUMENTS), path, size)
    }

    await signIn(page)
    await ensureARow(page)
    for (const path of PRIVATE_PATHS) {
      await open(page, path)
      collect(await page.evaluate(inspect, ARGUMENTS), path, size)
    }

    // The sheets are exactly where a small tap target or an overflow hides.
    await open(page, '/today')
    await page.click('button[name="capture"]')
    await page.waitForSelector('.capture-input')
    collect(await page.evaluate(inspect, ARGUMENTS), 'the capture sheet', size)
    await page.click('.sheet-close')

    await page.click('button[name="more"]')
    await page.waitForSelector('.more-list')
    collect(await page.evaluate(inspect, ARGUMENTS), 'the More sheet', size)
    await page.click('.sheet-close')

    await page.locator('.row').first().click()
    await page.waitForSelector('input[name="due"]')
    collect(await page.evaluate(inspect, ARGUMENTS), 'the item sheet', size)
    await page.click('.sheet-close')

    if (size === SIZES[0]) {
      await checkItself(page)
      await checkContent(page)
    }
    await context.close()
  }
} catch (reason) {
  // A checker falling over is a reported problem, not a stack trace.
  problems.push({
    where: 'the check itself',
    kind: 'crashed',
    element: '-',
    detail: reason instanceof Error ? reason.message : String(reason),
  })
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}

function collect({ problems: found, counted }, path, size) {
  const where = `${path} @ ${size.width}px`
  if (counted.text === 0) {
    problems.push({ where, kind: 'empty', element: '-', detail: 'no text on the screen' })
  }
  if (counted.taps === 0) {
    problems.push({ where, kind: 'empty', element: '-', detail: 'no tap target on the screen' })
  }
  for (const problem of found) problems.push({ where, ...problem })
  console.log(
    `  ${where}: ${found.length} problems, ${counted.text} texts, ${counted.taps} tap targets`,
  )
}

/** Four deliberate mistakes, all four of which must be caught. */
async function checkItself(page) {
  await page.evaluate(() => {
    const broken = document.createElement('div')
    broken.id = 'canary'
    broken.innerHTML =
      '<div id="canary-wide" style="position:fixed;top:200px;left:0;width:200vw;height:4px"></div>' +
      '<p id="canary-text" style="position:fixed;top:0;left:0;margin:0">under the bar</p>' +
      '<button id="canary-button" style="position:fixed;top:100px;left:0;width:10px;height:10px">x</button>' +
      '<button id="canary-bottom" style="position:fixed;bottom:0;left:0;width:44px;height:44px">b</button>'
    document.body.append(broken)
  })
  const { problems: caught } = await page.evaluate(inspect, ARGUMENTS)
  const kinds = new Set(caught.map((p) => p.kind))
  for (const kind of ['overflow', 'under-status-bar', 'too-small', 'under-indicator']) {
    if (!kinds.has(kind)) {
      problems.push({
        where: 'self-check',
        kind: 'blind',
        element: kind,
        detail: `the checker did not catch a mistake of kind "${kind}"`,
      })
    }
  }
  console.log(`  self-check: caught ${[...kinds].join(', ')}`)
}

/**
 * Copy and structure specific to Phase 1B: Directory must not read as
 * "thing", Capture must carry its accessible name, and More must expose
 * exactly the three doors the plan names — no more, no fewer.
 */
async function checkContent(page) {
  await open(page, '/things')
  const bodyText = await page.locator('.things').innerText()
  if (/\badd a thing\b/i.test(bodyText) || /\ba thing is\b/i.test(bodyText)) {
    problems.push({
      where: 'Directory',
      kind: 'content',
      element: '.things',
      detail: 'still uses "thing" wording in user-facing copy',
    })
  }

  await open(page, '/today')
  const captureLabel = await page.locator('button[name="capture"]').getAttribute('aria-label')
  if (captureLabel !== 'Capture') {
    problems.push({
      where: 'Home',
      kind: 'content',
      element: 'button[name="capture"]',
      detail: `accessible name is "${String(captureLabel)}", expected "Capture"`,
    })
  }

  await page.click('button[name="more"]')
  await page.waitForSelector('.more-list')
  const doors = (await page.locator('.more-link').allTextContents()).map((t) => t.trim())
  const expected = ['Journal', 'Directory', 'Settings']
  if (JSON.stringify(doors) !== JSON.stringify(expected)) {
    problems.push({
      where: 'More',
      kind: 'content',
      element: '.more-list',
      detail: `shows ${JSON.stringify(doors)}, expected ${JSON.stringify(expected)}`,
    })
  }
  await page.click('.sheet-close')
}

if (problems.length === 0) {
  console.log(`\nLayout is fine at phone width, on ${driver.name}.`)
  process.exit(0)
}

console.error(`\nLayout: ${problems.length} problems\n`)
for (const problem of problems) {
  console.error(`  [${problem.kind}] ${problem.where} → ${problem.element}: ${problem.detail}`)
}
process.exit(1)
