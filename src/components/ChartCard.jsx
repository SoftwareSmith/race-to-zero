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
    <article className={`chart-card ${className}`.trim()}>
      <div className="chart-card-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="chart-frame">
        <ChartComponent data={data} options={getLineChartOptions()} />
      </div>
    </article>
  )
}

export default ChartCard