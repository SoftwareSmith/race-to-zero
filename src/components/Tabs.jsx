import { cn } from '../utils/cn.js'

function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div
      aria-label="Dashboard sections"
      className="inline-flex rounded-[18px] border border-white/10 bg-zinc-950/75 p-1 shadow-[0_18px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl"
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            aria-selected={isActive}
            className={cn(
              'rounded-[14px] px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40',
              isActive
                ? 'bg-sky-400/12 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.24)]'
                : 'text-stone-400 hover:bg-white/6 hover:text-stone-100',
            )}
            onClick={() => onChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs