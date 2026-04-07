function SliderControl({ description, label, max, min, onChange, step, value }) {
  return (
    <label className="grid cursor-pointer gap-2 rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-stone-100">{label}</span>
          <span className="mt-1 block text-xs leading-5 text-stone-400">{description}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-stone-300">{value.toFixed(1)}x</span>
      </div>

      <input
        className="accent-sky-300"
        max={max}
        min={min}
        onChange={onChange}
        step={step}
        type="range"
        value={value}
      />
    </label>
  )
}

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

function BugSettingsMenu({ bugVisualSettings, containerRef, onChange, onMenuToggle, open, showParticleCount, onToggle }) {
  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-label="Open bug field settings"
        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-[16px] border border-white/10 bg-zinc-950/86 px-3 text-stone-300 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
        onClick={onMenuToggle}
        type="button"
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24">
          <path d="M8.5 7.5 5.3 5.7M15.5 7.5l3.2-1.8M7.6 11H4.4M16.4 11h3.2M7.7 14.7l-3 1.9M16.3 14.7l3 1.9" />
          <circle cx="12" cy="6.2" r="2.1" fill="currentColor" stroke="none" />
          <path d="M9.1 10.4c0-1.6 1.3-2.9 2.9-2.9s2.9 1.3 2.9 2.9v4.2c0 2-1.3 3.8-2.9 3.8s-2.9-1.8-2.9-3.8v-4.2Z" fill="currentColor" stroke="none" />
          <path d="M10.2 18.2 8.8 20M13.8 18.2l1.4 1.8" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-30 grid w-[320px] gap-3 rounded-[20px] border border-white/10 bg-zinc-950/96 p-4 text-sm text-stone-200 shadow-[0_24px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          <span className="cursor-default text-sm font-medium text-stone-300">Bug field</span>
          <SliderControl
            description="Scale the bug sprites up or down across the full background layer."
            label="Bug size"
            max={3.5}
            min={0.8}
            onChange={(event) => onChange('sizeMultiplier', Number(event.target.value))}
            step={0.1}
            value={bugVisualSettings.sizeMultiplier}
          />
          <SliderControl
            description="Increase how fast and how aggressively bugs scuttle around the screen."
            label="Bug speed"
            max={3.5}
            min={0.6}
            onChange={(event) => onChange('chaosMultiplier', Number(event.target.value))}
            step={0.1}
            value={bugVisualSettings.chaosMultiplier}
          />
          <Toggle checked={showParticleCount} description="Show the live background particle count for QA while tuning the bug field." label="Show bug particle count" onChange={() => onToggle('showParticleCount')} />
        </div>
      ) : null}
    </div>
  )
}

export default BugSettingsMenu