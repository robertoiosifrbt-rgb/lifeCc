import { PLATFORM_NAMES, PLATFORMS } from '../repository/items'
import type { NamedPlatform, Platform } from '../repository/items'

type Props = {
  earnings: Record<Platform, string>
  /** Configurable Platforms — the owner's own records, never a hardcoded
   *  name — keyed by each one's own item id. */
  platforms: NamedPlatform[]
  platformEarnings: Record<string, string>
  tips: string
  bonuses: string
  busy: boolean
  readOnly: boolean
  onChangePlatform: (platform: Platform, typed: string) => void
  onChangePlatformEarning: (platform_item_id: string, typed: string) => void
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
      {props.platforms.map(({ itemId, name }) => (
        <label key={itemId} className="shift-paid shift-platform-earning">
          <span className="shift-platform">{name}</span>
          <input
            className="shift-amount"
            name={`platform:${itemId}`}
            inputMode="decimal"
            value={props.platformEarnings[itemId] ?? ''}
            disabled={busy || readOnly}
            onChange={(event) => props.onChangePlatformEarning(itemId, event.target.value)}
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
