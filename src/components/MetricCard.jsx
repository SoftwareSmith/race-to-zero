import Tooltip from './Tooltip.jsx'
import { cn } from '../utils/cn.js'

const TONE_STYLES = {
  positive: {
    card: 'border-emerald-500/26 bg-emerald-950/18',
    eyebrow: 'text-emerald-300',
    value: 'text-emerald-200',
    copy: 'text-emerald-100/70',
  },
  negative: {
    card: 'border-red-500/26 bg-red-950/18',
    eyebrow: 'text-red-300',
    value: 'text-red-200',
    copy: 'text-red-100/70',
  },
  neutral: {
    card: 'border-sky-500/24 bg-sky-950/12',
    eyebrow: 'text-sky-200',
    value: 'text-sky-100',
    copy: 'text-sky-50/70',
  },
}

function MetricCard({ className = '', hint, label, tone = 'neutral', value }) {
  const styles = TONE_STYLES[tone] ?? TONE_STYLES.neutral
  const card = (
    <article
      className={cn(
        'group relative flex min-h-[160px] flex-col rounded-[22px] border p-5 shadow-[0_14px_34px_rgba(0,0,0,0.2)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(0,0,0,0.28)]',
        styles.card,
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px] opacity-0 transition duration-200 group-hover:opacity-100">
        <div className="absolute inset-x-4 top-3 h-14 rounded-full bg-white/8 blur-2xl" />
        <div className={cn(
          'absolute inset-x-6 bottom-2 h-16 rounded-full blur-2xl',
          tone === 'positive'
            ? 'bg-emerald-400/18'
            : tone === 'negative'
              ? 'bg-red-400/16'
              : 'bg-sky-400/16',
        )} />
      </div>
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition duration-200 group-hover:opacity-100" />
      <div className="relative flex items-start gap-3">
        <span className={cn('text-[0.72rem] font-semibold uppercase tracking-[0.24em]', styles.eyebrow)}>{label}</span>
      </div>
      <strong className={cn('relative mt-5 flex-1 font-[family-name:var(--font-display)] text-4xl leading-none tracking-[-0.04em] sm:text-[2.8rem]', styles.value)}>
        {value}
      </strong>
    </article>
  )

  if (!hint) {
    return card
  }

  return (
    <Tooltip content={hint} triggerClassName="block h-full">
      {card}
    </Tooltip>
  )
}

export default MetricCard