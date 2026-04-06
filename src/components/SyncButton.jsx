function SyncButton({ isSyncing, onClick, statusMessage }) {
  const shouldShowStatus = isSyncing || Boolean(statusMessage)

  return (
    <div className="sync-panel sync-panel-subtle">
      <button
        className="sync-button sync-button-subtle"
        disabled={isSyncing}
        onClick={onClick}
        type="button"
      >
        {isSyncing ? 'Syncing…' : 'Sync now'}
      </button>

      {shouldShowStatus && (
        <p className="sync-status" aria-live="polite">
          {statusMessage}
        </p>
      )}
    </div>
  )
}

export default SyncButton