import Tooltip from './Tooltip.jsx'
import { cn } from '../utils/cn.js'

function SyncButton({ isSyncing, onClick, lastSyncedLabel, snapshotUrl, statusMessage, relativeLabel }) {
  const tooltipContent = `Last synced: ${lastSyncedLabel}`

  return (
    <div className="flex items-start gap-3">
      <Tooltip content={tooltipContent}>
        <button
          aria-label={isSyncing ? 'Syncing data' : 'Sync data'}
          className={cn(
            'inline-flex min-h-12 items-center gap-2 rounded-[16px] border border-white/10 bg-zinc-950/86 px-4 py-3 text-sm font-semibold text-stone-100 shadow-[0_18px_36px_rgba(0,0,0,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40 disabled:cursor-wait disabled:opacity-70',
            isSyncing ? 'pointer-events-none' : '',
          )}
          disabled={isSyncing}
          onClick={onClick}
          type="button"
        >
          <svg aria-hidden="true" className={cn('h-4 w-4', isSyncing ? 'animate-spin' : '')} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M20 12a8 8 0 0 1-14.14 5.14" />
            <path d="M4 12a8 8 0 0 1 14.14-5.14" />
            <path d="M6 18H3v-3" />
            <path d="M18 6h3v3" />
          </svg>
          <span>{isSyncing ? 'Syncing…' : 'Sync snapshot'}</span>
        </button>
      </Tooltip>

      <details className="relative">
        <summary
          aria-label="Open snapshot options"
          className="inline-flex min-h-12 items-center justify-center rounded-[16px] border border-white/10 bg-zinc-950/86 px-3 text-stone-300 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="12" cy="19" r="1.75" />
          </svg>
        </summary>

        <div className="absolute right-0 top-[calc(100%+10px)] z-30 grid w-64 gap-3 rounded-[20px] border border-white/10 bg-zinc-950/96 p-4 text-sm text-stone-200 shadow-[0_24px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          <span className="text-sm font-medium text-stone-300">Last synced {relativeLabel}</span>
          {statusMessage ? <span className="text-sm leading-6 text-stone-400">{statusMessage}</span> : null}
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-stone-100 transition duration-200 hover:bg-white/10"
            href={snapshotUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open data snapshot
          </a>
        </div>
      </details>
    </div>
  )
}

export default SyncButton