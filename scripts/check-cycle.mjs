#!/usr/bin/env node
// The full cycle from the end of step 5 of the plan, driven through the
// browser like a person would: write "call X" on the phone, it lands in the
// Inbox; process it as a task due tomorrow; it shows up in the Calendar on
// tomorrow; tick it, it shows up as done on the day you ticked it; press
// "Download everything" and see it in the file; open the laptop - it is
// there; refresh - it is there. The only check that exercises the whole
// stack at once: screens, repository, PostgREST, the trigger, RLS, IndexedDB.

import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { engine } from './lib/browser.mjs'
import { dayCell, pickDay, sameMonth } from './lib/calendar.mjs'

const PORT = Number(process.env.CHECK_PORT ?? 4320)
const BASE = `http://127.0.0.1:${PORT}`
const EMAIL = process.env.CHECK_EMAIL
const PASSWORD = process.env.CHECK_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error(
    'CHECK_EMAIL and CHECK_PASSWORD are missing. This check needs an account on\n' +
      'the local Supabase. Production credentials are never used here.',
  )
  process.exit(1)
}

/** A title unique to this run, so a second run cannot be confused with it. */
const TITLE = `call X ${Date.now()}`

function ymd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const today = () => ymd(new Date())
function tomorrow() {
  const now = new Date()
  now.setDate(now.getDate() + 1)
  return ymd(now)
}

const TODAY = today()
const TOMORROW = tomorrow()

/** Which engine to drive. Named in the output, so a green run says on what. */
const driver = engine()

async function waitForServer(attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      if ((await fetch(BASE)).ok) return
    } catch {
      // not up yet
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

/** Signs in through the form and waits for the shell. */
async function signIn(page) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.signin')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('.signin-button')
  try {
    await page.waitForSelector('.shell', { timeout: 20000 })
  } catch {
    const said = await page
      .locator('.signin-message-error')
      .first()
      .textContent()
      .catch(() => null)
    throw new Error(`could not sign in as ${EMAIL}: ${said ?? 'stayed on sign-in'}`)
  }
  // `data-sync` mirrors SyncState.kind: 'never' -> 'syncing' -> a terminal
  // 'synced' or 'failed'; only a terminal state ends this wait — the timeout
  // below is a safety net, never the correctness mechanism.
  await page.waitForFunction(
    (kinds) => kinds.includes(document.querySelector('.shell')?.getAttribute('data-sync')),
    ['synced', 'failed'],
    { timeout: 30000 },
  )
  const state = await page.getAttribute('.shell', 'data-sync')
  if (state === 'failed') throw new Error('the first sync failed (data-sync="failed")')
}

async function openMore(page, label) {
  await page.click('button[name="more"]')
  await page.click(`a.more-link >> text=${label}`)
}

/** The row carrying our title, wherever it is on screen. */
const row = (page) => page.locator('.row', { hasText: TITLE })

/** Calendar sits one step inside Plan now, not on the bar: the Plan tab, then the Calendar door. */
async function openCalendar(page) {
  await page.click('.shell-nav-button >> text=Plan')
  await page.click('.plan-calendar')
}

/** The group heading a row sits under, for a nicer failure message. */
async function assertVisible(page, what) {
  await row(page)
    .first()
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {
      throw new Error(`"${TITLE}" is not visible ${what}`)
    })
}

const steps = []
const failures = []

async function step(name, body) {
  try {
    await body()
    steps.push(name)
    console.log(`  ✓ ${name}`)
  } catch (error) {
    console.log(`  ✗ ${name}`)
    failures.push({ name, reason: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

const server = startServer()
let browser

try {
  await waitForServer()
  browser = await driver.launch()

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    acceptDownloads: true,
  })
  const page = await phone.newPage()
  await signIn(page)

  await step('you write a line on the phone, and it lands in the Inbox', async () => {
    await page.click('button[name="capture"]')
    await page.fill('.capture-input', TITLE)
    await page.click('.capture-save')
    await page.waitForSelector('.capture-input', { state: 'detached', timeout: 15000 })
    await assertVisible(page, 'in Today after capture')

    const groups = await page.locator('.group', { has: page.locator('.row', { hasText: TITLE }) })
    const heading = await groups.first().locator('.group-heading').first().textContent()
    if ((heading ?? '').trim() !== 'Inbox') {
      throw new Error(`it landed under "${heading}", not under Inbox`)
    }
  })

  await step('you process it as a task due tomorrow', async () => {
    await row(page).first().click()
    await page.waitForSelector('input[name="due"]')
    await page.fill('input[name="due"]', TOMORROW)
    await page.click('button[name="as-task"]')
    await page.waitForSelector('input[name="due"]', { state: 'detached', timeout: 15000 })
  })

  await step('it shows up in the Calendar, on tomorrow, under Planned', async () => {
    await openCalendar(page)

    // The mark on the grid is what sends you to that day at all — without it, a day holding something looks the same as an empty one.
    if (sameMonth(TOMORROW, TODAY)) {
      await dayCell(page, TOMORROW)
        .first()
        .locator('.month-mark')
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => {
          throw new Error(`tomorrow (${TOMORROW}) carries no mark on the grid`)
        })
    }

    await pickDay(page, TOMORROW, TODAY)
    await assertVisible(page, 'in the Calendar, on tomorrow')
    const day = page.locator('.day', { has: page.locator('.row', { hasText: TITLE }) })
    const heading = (await day.first().locator('.day-heading').textContent()) ?? ''
    const dayNumber = String(Number(TOMORROW.slice(8, 10)))
    if (!heading.includes(dayNumber)) {
      throw new Error(`it sits under "${heading}", which is not tomorrow (${TOMORROW})`)
    }
    const part = (await day.first().locator('.day-part-heading').first().textContent()) ?? ''
    if (part.trim() !== 'Planned') {
      throw new Error(`it sits under "${part}", not under Planned`)
    }
  })

  await step('you tick it, and it shows up as done on the day you ticked it', async () => {
    await row(page).first().click()
    await page.click('button[name="mark-done"]')
    await page.waitForSelector('button[name="mark-done"]', {
      state: 'detached',
      timeout: 15000,
    })

    // Ticking put it on today, and the screen is still showing tomorrow.
    await page.click('.month-today')

    const todayDay = page.locator('.day-today', {
      has: page.locator('.row', { hasText: TITLE }),
    })
    await todayDay
      .first()
      .waitFor({ state: 'visible', timeout: 15000 })
      .catch(() => {
        throw new Error(`after ticking, it is not on today (${TODAY}) in the Calendar`)
      })
    const parts = await todayDay.first().locator('.day-part-heading').allTextContents()
    if (!parts.map((p) => p.trim()).includes('Done')) {
      throw new Error(`on today it sits under ${parts.join(', ')}, not under Done`)
    }
  })

  await step('you press "Download everything" and see it in the file', async () => {
    await openMore(page, 'Settings') // it moved off the header and into Settings
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('button[name="download"]'),
    ])
    const path = await download.path()
    if (path === null) throw new Error('the browser did not hand over the file')
    const file = JSON.parse(readFileSync(path, 'utf8'))
    const mine = file.items.find((item) => item.title === TITLE)
    if (mine === undefined) throw new Error('the file does not contain the item')
    if (mine.state !== 'done') throw new Error(`in the file its state is "${mine.state}"`)
    if (mine.done_at !== TODAY) {
      throw new Error(`in the file done_at is "${mine.done_at}", expected ${TODAY}`)
    }
    if (mine.due !== TOMORROW) {
      throw new Error(`in the file due is "${mine.due}", expected ${TOMORROW}`)
    }
  })

  await step('you open the laptop, and it is there', async () => {
    // A separate context: another device, nothing cached, the same account.
    const laptop = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const other = await laptop.newPage()
    await signIn(other)
    await openCalendar(other)
    await assertVisible(other, 'on the second device')
    await laptop.close()
  })

  await step('you refresh, and it is there', async () => {
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('.shell', { timeout: 20000 })
    await openCalendar(page)
    await assertVisible(page, 'after a refresh')
  })
} catch (error) {
  if (failures.length === 0) {
    failures.push({
      name: 'the check itself',
      reason: error instanceof Error ? error.message : String(error),
    })
  }
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}

const EXPECTED_STEPS = 7

if (failures.length === 0 && steps.length === EXPECTED_STEPS) {
  console.log(
    `\nThe full cycle holds on ${driver.name}: ${steps.length} steps, three out of three.`,
  )
  process.exit(0)
}

if (failures.length === 0) {
  console.error(
    `\nOnly ${steps.length} of ${EXPECTED_STEPS} steps ran. A check that stops early is not a green one.`,
  )
  process.exit(1)
}

console.error(`\nThe cycle broke after ${steps.length} steps\n`)
for (const failure of failures) {
  console.error(`  ${failure.name}: ${failure.reason}`)
}
process.exit(1)
