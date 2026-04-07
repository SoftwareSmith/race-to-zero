export function getEffectPalette(tone) {
  const palettes = {
    positive: {
      bug: 'rgba(167,243,208,0.32)',
      fireflies: ['rgba(16,185,129,0.72)', 'rgba(56,189,248,0.52)', 'rgba(167,243,208,0.42)'],
      orbA: 'rgba(16,185,129,0.1)',
      orbB: 'rgba(56,189,248,0.08)',
    },
    negative: {
      bug: 'rgba(252,165,165,0.3)',
      fireflies: ['rgba(239,68,68,0.6)', 'rgba(56,189,248,0.4)', 'rgba(253,186,116,0.34)'],
      orbA: 'rgba(239,68,68,0.1)',
      orbB: 'rgba(56,189,248,0.07)',
    },
    neutral: {
      bug: 'rgba(186,230,253,0.3)',
      fireflies: ['rgba(56,189,248,0.58)', 'rgba(20,184,166,0.42)', 'rgba(186,230,253,0.28)'],
      orbA: 'rgba(56,189,248,0.09)',
      orbB: 'rgba(20,184,166,0.07)',
    },
  }

  return palettes[tone] ?? palettes.neutral
}

export function createFireflyParticles(tone) {
  const palette = getEffectPalette(tone).fireflies

  return [
    { x: '10%', y: '16%', size: '5px', duration: '10s', delay: '0s', driftX: '18px', color: palette[0] },
    { x: '24%', y: '34%', size: '4px', duration: '12s', delay: '2s', driftX: '-22px', color: palette[1] },
    { x: '72%', y: '12%', size: '6px', duration: '9s', delay: '1s', driftX: '14px', color: palette[0] },
    { x: '84%', y: '38%', size: '4px', duration: '13s', delay: '4s', driftX: '-18px', color: palette[2] },
    { x: '18%', y: '72%', size: '5px', duration: '11s', delay: '3s', driftX: '20px', color: palette[2] },
    { x: '68%', y: '76%', size: '5px', duration: '14s', delay: '5s', driftX: '-16px', color: palette[1] },
    { x: '33%', y: '18%', size: '4px', duration: '15s', delay: '6s', driftX: '12px', color: palette[2] },
    { x: '46%', y: '62%', size: '3px', duration: '9s', delay: '1.5s', driftX: '-14px', color: palette[0] },
    { x: '58%', y: '28%', size: '5px', duration: '12s', delay: '2.5s', driftX: '10px', color: palette[1] },
    { x: '78%', y: '58%', size: '4px', duration: '16s', delay: '7s', driftX: '-20px', color: palette[0] },
    { x: '8%', y: '48%', size: '3px', duration: '11s', delay: '2.2s', driftX: '16px', color: palette[1] },
    { x: '90%', y: '80%', size: '5px', duration: '13s', delay: '5.2s', driftX: '-12px', color: palette[2] },
    { x: '14%', y: '24%', size: '3px', duration: '14s', delay: '0.8s', driftX: '24px', color: palette[2] },
    { x: '29%', y: '56%', size: '5px', duration: '17s', delay: '3.5s', driftX: '-12px', color: palette[0] },
    { x: '41%', y: '10%', size: '4px', duration: '12.5s', delay: '1.8s', driftX: '18px', color: palette[1] },
    { x: '52%', y: '44%', size: '3px', duration: '15s', delay: '4.4s', driftX: '-24px', color: palette[2] },
    { x: '63%', y: '68%', size: '6px', duration: '18s', delay: '2.9s', driftX: '14px', color: palette[0] },
    { x: '74%', y: '22%', size: '3px', duration: '10.5s', delay: '5.6s', driftX: '-10px', color: palette[1] },
    { x: '86%', y: '52%', size: '4px', duration: '13.5s', delay: '6.1s', driftX: '22px', color: palette[2] },
    { x: '6%', y: '84%', size: '4px', duration: '16.5s', delay: '2.7s', driftX: '12px', color: palette[0] },
    { x: '37%', y: '80%', size: '3px', duration: '11.5s', delay: '7.3s', driftX: '-16px', color: palette[1] },
    { x: '57%', y: '16%', size: '5px', duration: '14.5s', delay: '3.2s', driftX: '20px', color: palette[2] },
    { x: '69%', y: '88%', size: '3px', duration: '12.8s', delay: '1.1s', driftX: '-18px', color: palette[0] },
    { x: '94%', y: '32%', size: '4px', duration: '15.8s', delay: '4.9s', driftX: '-14px', color: palette[1] },
  ]
}

export function createBugParticles(bugCount) {
  const totalBugs = Math.max(0, Math.floor(bugCount))

  return Array.from({ length: totalBugs }, (_, index) => {
    const x = ((index * 37.17) % 100).toFixed(2)
    const y = ((index * 19.73 + Math.floor(index / 7) * 3.4) % 100).toFixed(2)
    const size = (3 + (index % 3)).toFixed(0)
    const duration = 16 + (index % 11)
    const delay = ((index % 17) * 0.37).toFixed(2)
    const driftX = ((index % 9) - 4) * 8
    const driftY = ((index % 7) - 3) * 7
    const opacity = (0.24 + (index % 5) * 0.05).toFixed(2)

    return {
      delay: `${delay}s`,
      driftX: `${driftX}px`,
      driftY: `${driftY}px`,
      duration: `${duration}s`,
      opacity,
      size: `${size}px`,
      x: `${x}%`,
      y: `${y}%`,
    }
  })
}