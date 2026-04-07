import { cn } from '../utils/cn.js'

const THEME_STYLES = {
  default: {
    eyebrow: 'text-stone-400',
    title: 'text-stone-50',
    description: 'text-stone-300',
  },
  inverse: {
    eyebrow: 'text-stone-300',
    title: 'text-stone-50',
    description: 'text-stone-200',
  },
}

function SectionHeader({ eyebrow, title, description, action, className = '', theme = 'default' }) {
  const themeStyles = THEME_STYLES[theme] ?? THEME_STYLES.default

  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className={cn('text-[0.72rem] font-semibold uppercase tracking-[0.28em]', themeStyles.eyebrow)}>
            {eyebrow}
          </p>
        ) : null}
        <h2 className={cn('mt-2 font-[family-name:var(--font-display)] text-3xl leading-tight sm:text-[2.1rem]', themeStyles.title)}>
          {title}
        </h2>
        {description ? <p className={cn('mt-3 text-sm leading-6 sm:text-base', themeStyles.description)}>{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export default SectionHeader