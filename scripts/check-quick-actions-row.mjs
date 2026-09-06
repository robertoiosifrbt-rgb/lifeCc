#!/usr/bin/env node
// Proves what quickActionRun.test.ts cannot: that a rejected delivery.work
// write in the *real*, rendered QuickActionsRow shows up as a real visible
// role="alert" element, never opens anything, and lets the button go back to
// enabled — not just that the helper functions compose correctly in the
// abstract.
//
// It needs a browser, so it is an explicit check and not a `.test.mjs`. It was
// one, discovered by `npm test`, and that made the cheap lint-and-tests job
// need Playwright browsers installed to go green. Moving it here keeps the
// coverage and gives it back to the job that already installs them.
//
// ⛔ It never skips when the browser is missing. A check that goes quietly
// green without a browser is not this check passing; it is nothing running.

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { engine } from './lib/browser.mjs'
import { MIN_TAP } from './lib/layout.mjs'
import { buildHarness, REJECTION } from './lib/quick-actions-row.mjs'

/**
 * Chromium, asked for by name and not left to CHECK_BROWSER.
 *
 * ⛔ Not `engine()`. What this check proves is the DOM the component produces
 * when a write is refused, which is not where engines differ — so it is
 * declared Chromium-only, and CI runs it once. A check that changed engine
 * with an environment variable would not be the check it says it is, and
 * `CHECK_BROWSER=webkit` would silently run something else. check:layout and
 * check:cycle still honour CHECK_BROWSER, because for them the engine is the
 * point.
 */
const driver = engine('chromium')

const failures = []

/** One assertion, reported either way — a silent check counts nothing. */
function is(what, actual, wanted) {
  if (Object.is(actual, wanted)) {
    console.log(`  ok    ${what}`)
    return
  }
  failures.push(`${what}: got ${JSON.stringify(actual)}, wanted ${JSON.stringify(wanted)}`)
  console.log(`  FAIL  ${what}`)
}

let workDir
let browser

try {
  workDir = await mkdtemp(path.join(tmpdir(), 'quick-actions-row-'))
  const bundle = await buildHarness(workDir)

  browser = await driver.launch()
  const page = await browser.newPage()
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ content: bundle })
  await page.waitForSelector('button[name="delivery-work"]', { timeout: 30_000 })

  is(
    'the configured action renders as Start delivery work',
    await page.textContent('button[name="delivery-work"]'),
    'Start delivery work',
  )

  // The layout checker never sees this: its account has no configured Quick
  // Actions, so the "configured" branch — the one with an Edit link next to
  // the buttons — never renders there. This harness always has one
  // configured action, so it is the only check that can measure the real,
  // styled link rather than trust the CSS by eye.
  const manageBox = await page.locator('a.today-manage').boundingBox()
  const manageWidth = manageBox?.width ?? 0
  const manageHeight = manageBox?.height ?? 0
  is(
    `the "Edit" link is a real tap target (measured ${Math.round(manageWidth)}×${Math.round(manageHeight)}px, minimum ${MIN_TAP}px)`,
    manageWidth >= MIN_TAP - 0.5 && manageHeight >= MIN_TAP - 0.5,
    true,
  )

  await page.click('button[name="delivery-work"]')
  // If no alert ever appears this throws, and the check fails loudly.
  await page.waitForSelector('[role="alert"]', { timeout: 30_000 })

  is(
    'the rejection is shown in a visible alert',
    await page.textContent('[role="alert"]'),
    REJECTION,
  )
  is(
    'nothing was opened',
    await page.evaluate(() => window.__harness.openItemCalls.length),
    0,
  )
  // Busy is released once the rejection is handled — the button is clickable
  // again, not stuck disabled behind a failed attempt.
  is(
    'busy is released, the button is clickable again',
    await page.isDisabled('button[name="delivery-work"]'),
    false,
  )
} catch (reason) {
  // A checker falling over is a reported problem, not a stack trace — and it
  // is a failure, never a skip.
  failures.push(
    `the check itself crashed: ${reason instanceof Error ? reason.message : String(reason)}`,
  )
} finally {
  await browser?.close()
  if (workDir !== undefined) await rm(workDir, { recursive: true, force: true })
}

if (failures.length === 0) {
  console.log(`\nQuickActionsRow renders the rejection honestly, on ${driver.name}.`)
  process.exit(0)
}

console.error(`\nQuickActionsRow: ${failures.length} problems\n`)
for (const failure of failures) console.error(`  ${failure}`)
process.exit(1)
