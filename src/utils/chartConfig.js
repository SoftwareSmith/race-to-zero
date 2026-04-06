export function getLineChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: {
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          color: '#334155',
        },
      },
      tooltip: {
        backgroundColor: '#10243b',
        titleColor: '#f8fafc',
        bodyColor: '#dbeafe',
        padding: 12,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#475569',
          maxRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(71, 85, 105, 0.12)',
        },
        ticks: {
          color: '#475569',
          precision: 0,
        },
      },
    },
  }
}