import Tooltip from './Tooltip.jsx'

function SyncButton({ isSyncing, onClick, lastSyncedLabel, snapshotUrl, statusMessage, relativeLabel }) {
  const tooltipContent = `Last synced: ${lastSyncedLabel}`

  return (
    <div className="sync-control-group">
      <Tooltip content={tooltipContent}>
        <button
          aria-label={isSyncing ? 'Syncing data' : 'Sync data'}
          className={`icon-button sync-icon-button ${isSyncing ? 'sync-icon-button-active' : ''}`}
          disabled={isSyncing}
          onClick={onClick}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M20 12a8 8 0 0 1-14.14 5.14" />
            <path d="M4 12a8 8 0 0 1 14.14-5.14" />
            <path d="M6 18H3v-3" />
            <path d="M18 6h3v3" />
          </svg>
        </button>
      </Tooltip>

      <details className="snapshot-menu">
        <summary className="icon-button snapshot-menu-trigger" aria-label="Open snapshot options">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="12" cy="19" r="1.75" />
          </svg>
        </summary>

        <div className="snapshot-menu-panel">
          <span className="snapshot-menu-meta">Last synced {relativeLabel}</span>
          {statusMessage ? <span className="snapshot-menu-meta">{statusMessage}</span> : null}
          <a className="snapshot-menu-link" href={snapshotUrl} rel="noreferrer" target="_blank">
            Open data snapshot
          </a>
        </div>
      </details>
    </div>
  )
}

export default SyncButton