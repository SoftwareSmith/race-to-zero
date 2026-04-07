import MetricCard from './MetricCard.jsx'
import StatusTag from './StatusTag.jsx'
import Surface from './Surface.jsx'
import { cn } from '../utils/cn.js'
import { formatNumber, formatSignedNumber, getDeltaTone, getStatusTagText } from '../utils/dashboard.js'

function CommandCenter({ deadlineMetrics, summary }) {
  const paceGap = summary.currentFixRate - summary.bugsPerDayRequired
  const paceTone = getDeltaTone(paceGap)
  const glowStyles = {
    positive: 'before:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.1),transparent_38%)]',
    negative: 'before:bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.08),transparent_38%)]',
    neutral: 'before:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.08),transparent_38%)]',
  }[deadlineMetrics.statusTone] ?? 'before:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.08),transparent_38%)]'

  return (
    <Surface className={cn('relative border-white/10 p-5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[28px] before:opacity-100 after:pointer-events-none after:absolute after:inset-0 after:rounded-[28px] after:opacity-100', glowStyles)} tone="strong">
      <div className="relative">
        <div className="border-b border-white/8 pb-5">
          <div className="w-full">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-stone-500">Delivery outlook</p>
              <StatusTag tone={deadlineMetrics.statusTone}>{getStatusTagText(deadlineMetrics.statusTone)}</StatusTag>
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-tight tracking-[-0.04em] text-stone-50 sm:text-[2.8rem]">
              Are we clearing bugs fast enough to reach zero?
            </h2>
            <p className="mt-3 w-full text-sm leading-6 text-stone-300 sm:text-base">
              {paceGap >= 0 ? 'Ahead of' : 'Behind'} required pace for {summary.deadlineLabel}.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <MetricCard hint="Average bugs completed per day across the active deadline tracking window." label="Fix velocity" tone={paceTone} value={`${formatNumber(summary.currentFixRate, 2)}/day`} />
          <MetricCard hint="Target daily completion pace needed to reach zero if current intake continues." label="Required pace" tone="neutral" value={`${formatNumber(summary.bugsPerDayRequired, 2)}/day`} />
          <MetricCard hint="Fix velocity minus required pace. Positive means delivery is ahead of the current target." label="Net difference" tone={paceTone} value={`${formatSignedNumber(paceGap, 2)}/day`} />
        </div>
      </div>
    </Surface>
  )
}

export default CommandCenter