import { PLATFORM_NAMES, PLATFORMS } from '../repository/items'
import type { Platform } from '../repository/items'

type Props = {
  earnings: Record<Platform, string>
  tips: string
  bonuses: string
  busy: boolean
  readOnly: boolean
  onChangePlatform: (platform: Platform, typed: string) => void
  onChangeTips: (typed: string) => void
  onChangeBonuses: (typed: string) => void
}

/** What each platform paid, plus tips and bonuses — typed, not yet saved. */
export function ShiftEarnings(props: Props) {
  const { busy, readOnly } = props
  return (
    <section className="shift-block">
      <h3 className="shift-heading">Paid</h3>
      {PLATFORMS.map((platform) => (
        <label key={platform} className={`shift-paid shift-${platform}`}>
          <span className="shift-platform">{PLATFORM_NAMES[platform]}</span>
          <input
            className="shift-amount"
            name={platform}
            inputMode="decimal"
            value={props.earnings[platform]}
            disabled={busy || readOnly}
            onChange={(event) => props.onChangePlatform(platform, event.target.value)}
          />
        </label>
      ))}
      <label className="shift-paid shift-tips">
        <span className="shift-platform">Tips</span>
        <input
          className="shift-amount"
          name="tips"
          inputMode="decimal"
          value={props.tips}
          disabled={busy || readOnly}
          onChange={(event) => props.onChangeTips(event.target.value)}
        />
      </label>
      <label className="shift-paid shift-tips">
        <span className="shift-platform">Bonuses</span>
        <input
          className="shift-amount"
          name="bonuses"
          inputMode="decimal"
          value={props.bonuses}
          disabled={busy || readOnly}
          onChange={(event) => props.onChangeBonuses(event.target.value)}
        />
      </label>
    </section>
  )
}
