import { cn } from '../utils/cn.js'

const TONE_STYLES = {
  positive: {
    shell: 'border-emerald-500/24 bg-[linear-gradient(135deg,rgba(5,16,12,0.94),rgba(10,12,18,0.96))]',
    glow: 'bg-emerald-500/18',
    badge: 'border-emerald-400/28 bg-emerald-500/12 text-emerald-300',
    eyebrow: 'text-emerald-300',
    title: 'text-stone-50',
    body: 'text-stone-300',
    valueShell: 'border-emerald-500/22 bg-black/22',
    valueLabel: 'text-emerald-300',
    value: 'text-emerald-200',
    detail: 'text-stone-300',
    footer: 'text-stone-400',
  },
  negative: {
    shell: 'border-red-500/24 bg-[linear-gradient(135deg,rgba(24,6,8,0.94),rgba(10,12,18,0.96))]',
    glow: 'bg-red-500/18',
    badge: 'border-red-400/28 bg-red-500/12 text-red-300',
    eyebrow: 'text-red-300',
    title: 'text-stone-50',
    body: 'text-stone-300',
    valueShell: 'border-red-500/22 bg-black/22',
    valueLabel: 'text-red-300',
    value: 'text-red-200',
    detail: 'text-stone-300',
    footer: 'text-stone-400',
  },
  neutral: {
    shell: 'border-amber-400/24 bg-[linear-gradient(135deg,rgba(26,18,3,0.92),rgba(10,12,18,0.96))]',
    glow: 'bg-amber-400/16',
    badge: 'border-amber-300/28 bg-amber-400/12 text-amber-200',
    eyebrow: 'text-amber-200',
    title: 'text-stone-50',
    body: 'text-stone-300',
    valueShell: 'border-amber-400/22 bg-black/22',
    valueLabel: 'text-amber-200',
    value: 'text-amber-100',
    detail: 'text-stone-300',
    footer: 'text-stone-400',
  },
}

function HeroStatusPanel({
  badge,
  children,
  description,
  detail,
  eyebrow,
  footer,
  title,
  tone = 'neutral',
  value,
  valueLabel,
}) {
  const styles = TONE_STYLES[tone] ?? TONE_STYLES.neutral

  return (
    <section className={cn('relative overflow-hidden rounded-[30px] border p-5 shadow-[0_28px_80px_rgba(0,0,0,0.3)] sm:p-6', styles.shell)}>
      <div className={cn('absolute -right-12 top-10 h-40 w-40 rounded-full blur-3xl', styles.glow)} />
      <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(220px,250px)] xl:items-start">
        <div>
          <p className={cn('text-[0.72rem] font-semibold uppercase tracking-[0.28em]', styles.eyebrow)}>{eyebrow}</p>
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <h1 className={cn('max-w-3xl font-[family-name:var(--font-display)] text-[2.1rem] leading-[0.96] tracking-[-0.05em] sm:text-[2.8rem] xl:text-[3rem]', styles.title)}>
              {title}
            </h1>
            {badge ? <span className={cn('inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]', styles.badge)}>{badge}</span> : null}
          </div>
          <p className={cn('mt-3 max-w-3xl text-sm leading-6 sm:text-base', styles.body)}>{description}</p>
          {children ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div> : null}
          {footer ? <p className={cn('mt-4 text-xs leading-5 sm:text-sm', styles.footer)}>{footer}</p> : null}
        </div>

        <div className={cn('rounded-[24px] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]', styles.valueShell)}>
          <p className={cn('text-[0.72rem] font-semibold uppercase tracking-[0.24em]', styles.valueLabel)}>{valueLabel}</p>
          <div className={cn('mt-4 font-[family-name:var(--font-display)] text-5xl leading-none tracking-[-0.08em] sm:text-6xl', styles.value)}>
            {value}
          </div>
          {detail ? <p className={cn('mt-3 text-sm leading-6', styles.detail)}>{detail}</p> : null}
        </div>
      </div>
    </section>
  )
}

export default HeroStatusPanel