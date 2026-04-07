import { cn } from '../utils/cn.js'

function StatusTag({ tone, children }) {
  const styles = {
    positive: 'border-emerald-400/28 bg-emerald-500/12 text-emerald-200 shadow-[0_0_22px_rgba(16,185,129,0.12)]',
    negative: 'border-red-400/28 bg-red-500/12 text-red-200 shadow-[0_0_22px_rgba(239,68,68,0.12)]',
    neutral: 'border-sky-400/28 bg-sky-500/10 text-sky-100 shadow-[0_0_22px_rgba(56,189,248,0.1)]',
  }

  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em]', styles[tone] ?? styles.neutral)}>
      {children}
    </span>
  )
}

export default StatusTag