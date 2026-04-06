function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return '0'
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

function SummaryMetric({ label, value, tone }) {
  return (
    <div className="summary-metric">
      <span className="summary-label">{label}</span>
      <strong className={`summary-value ${tone ? `summary-value-${tone}` : ''}`}>
        {value}
      </strong>
    </div>
  )
}

function SummaryCard({ summary, isLoading }) {
  const paceTone = summary.onPace ? 'positive' : 'negative'

  return (
    <section className={`summary-card ${summary.onPace ? 'summary-card-on-pace' : 'summary-card-behind'}`}>
      <div className="summary-heading">
        <div>
          <p className="summary-kicker">Delivery pace</p>
          <h2>{summary.onPace ? 'On pace to hit zero' : 'Behind target pace'}</h2>
        </div>
        <span className={`pace-pill ${paceTone}`}>
          {isLoading ? 'Loading' : summary.onPace ? 'On pace' : 'Behind'}
        </span>
      </div>

      <div className="summary-grid">
        <SummaryMetric label="Remaining bugs" value={formatNumber(summary.remainingBugs)} />
        <SummaryMetric label="Days until deadline" value={formatNumber(summary.daysUntilDeadline)} />
        <SummaryMetric
          label="Bugs per day required"
          value={formatNumber(summary.bugsPerDayRequired, 2)}
          tone={paceTone}
        />
      </div>

      <p className="summary-footnote">
        Current pace: {formatNumber(summary.actualBurnRate, 2)} bugs/day based on available completed data.
      </p>
    </section>
  )
}

export default SummaryCard