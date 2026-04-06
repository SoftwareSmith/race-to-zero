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
          color: '#cbd5e1',
        },
      },
      tooltip: {
        backgroundColor: '#050816',
        titleColor: '#f8fafc',
        bodyColor: '#dbeafe',
        padding: 12,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(94, 106, 130, 0.15)',
        },
        ticks: {
          color: '#8fa2c0',
          maxRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(94, 106, 130, 0.15)',
        },
        ticks: {
          color: '#8fa2c0',
          precision: 0,
        },
      },
    },
  }
}