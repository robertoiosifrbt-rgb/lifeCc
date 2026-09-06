// The one thing every Quick Action write on Home shares: if it fails, the
// person has to be told, in words a tap can't be mistaken for having worked.
//
// Pulled out of QuickActionsRow so the promise it wraps — the real one, the
// one built from `runDeliveryAction` and the real repository writes — can be
// proven never to call `openItem` after a rejection, without a DOM: this is
// the exact function the component calls, not a copy of its logic.

/** Turns a rejection into a message, and nothing else — `openItem` (or
 *  whatever the caller put after the await inside `body`) is simply never
 *  reached when `body` rejects, which is what this relies on rather than
 *  re-implements. */
export async function runQuickAction(
  body: () => Promise<void>,
  onError: (message: string) => void,
): Promise<void> {
  try {
    await body()
  } catch (reason) {
    onError(reason instanceof Error ? reason.message : String(reason))
  }
}
