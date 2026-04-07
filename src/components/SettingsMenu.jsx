function Toggle({ checked, description, label, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-stone-100">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-stone-400">{description}</span>
      </span>
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
        <input checked={checked} className="peer sr-only" onChange={onChange} type="checkbox" />
        <span className="absolute inset-0 rounded-full border border-white/10 bg-zinc-900 transition peer-checked:border-sky-400/30 peer-checked:bg-sky-400/18" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-stone-300 transition peer-checked:translate-x-5 peer-checked:bg-sky-100" />
      </span>
    </label>
  )
}

function SettingsMenu({ containerRef, open, onMenuToggle, settings, onToggle }) {
  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-label="Open settings"
        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-[16px] border border-white/10 bg-zinc-950/86 px-3 text-stone-300 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
        onClick={onMenuToggle}
        type="button"
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M12 3v2.4M12 18.6V21M4.93 4.93l1.7 1.7M17.37 17.37l1.7 1.7M3 12h2.4M18.6 12H21M4.93 19.07l1.7-1.7M17.37 6.63l1.7-1.7" />
          <circle cx="12" cy="12" r="3.25" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-30 grid w-[320px] gap-3 rounded-[20px] border border-white/10 bg-zinc-950/96 p-4 text-sm text-stone-200 shadow-[0_24px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          <span className="cursor-default text-sm font-medium text-stone-300">Settings</span>
          <Toggle checked={settings.excludeWeekends} description="Use weekdays only when calculating days left and required pace." label="Exclude weekends" onChange={() => onToggle('excludeWeekends')} />
          <Toggle checked={settings.excludePublicHolidays} description="Exclude Western Australia public holidays from workday calculations." label="Exclude public holidays (AWST)" onChange={() => onToggle('excludePublicHolidays')} />
        </div>
      ) : null}
    </div>
  )
}

export default SettingsMenu