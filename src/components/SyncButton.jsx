function SyncButton({ isSyncing, onClick, statusMessage }) {
  return (
    <div className="sync-panel">
      <button
        className="sync-button"
        disabled={isSyncing}
        onClick={onClick}
        type="button"
      >
        {isSyncing ? 'Syncing Data…' : 'Sync Data'}
      </button>

      <p className="sync-status" aria-live="polite">
        {statusMessage || 'Dispatch the workflow and refresh when the new metrics file lands.'}
      </p>
    </div>
  )
}

export default SyncButton