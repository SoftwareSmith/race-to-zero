import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { getLineChartOptions } from '../utils/chartConfig.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
)

function ChartCard({ title, description, data }) {
  return (
    <article className="chart-card">
      <div className="chart-card-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="chart-frame">
        <Line data={data} options={getLineChartOptions()} />
      </div>
    </article>
  )
}

export default ChartCard