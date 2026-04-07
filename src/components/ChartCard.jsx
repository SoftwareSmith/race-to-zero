import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { getLineChartOptions } from '../utils/chartConfig.js'
import { cn } from '../utils/cn.js'

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
)

function ChartCard({ title, description, data, variant = 'line', className = '' }) {
  const ChartComponent = variant === 'bar' ? Bar : Line

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,12,18,0.96),rgba(19,23,32,0.96))] p-5 text-stone-50 shadow-[0_24px_60px_rgba(0,0,0,0.34)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_30px_70px_rgba(0,0,0,0.38)]',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-200 group-hover:opacity-100">
        <div className="absolute -left-6 top-8 h-28 w-28 rounded-full bg-sky-400/12 blur-3xl" />
        <div className="absolute bottom-4 right-4 h-24 w-24 rounded-full bg-teal-400/10 blur-3xl" />
      </div>
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_60%)]" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 transition duration-200 group-hover:opacity-100" />
      <div className="relative">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-stone-400">Chart</p>
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl leading-tight tracking-[-0.04em] text-stone-50">
            {title}
          </h3>
          <p className="mt-3 w-full text-sm leading-7 text-stone-300">{description}</p>
        </div>

        <div className="mt-6 h-[320px] sm:h-[360px]">
          <ChartComponent data={data} options={getLineChartOptions(variant)} />
        </div>
      </div>
    </article>
  )
}

export default ChartCard