export function getLineChartOptions(variant = 'line') {
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
          color: '#d6d3d1',
          padding: 18,
          font: {
            size: 12,
            weight: 600,
          },
        },
      },
      tooltip: {
        backgroundColor: '#1c1917',
        titleColor: '#fafaf9',
        bodyColor: '#e7e5e4',
        padding: 12,
        displayColors: true,
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(245, 245, 244, 0.08)',
          drawBorder: false,
        },
        ticks: {
          color: '#a8a29e',
          maxRotation: 0,
          padding: 10,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(245, 245, 244, 0.08)',
          drawBorder: false,
        },
        ticks: {
          color: '#a8a29e',
          precision: variant === 'bar' ? 0 : undefined,
          padding: 10,
        },
      },
    },
  }
}