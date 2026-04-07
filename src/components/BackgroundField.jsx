import { createBugParticles, createFireflyParticles, getEffectPalette } from '../utils/backgroundEffects.js'

function Fireflies({ tone }) {
  const particles = createFireflyParticles(tone)

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {particles.map((particle, index) => (
        <span
          key={index}
          className="app-firefly"
          style={{
            '--firefly-x': particle.x,
            '--firefly-y': particle.y,
            '--firefly-size': particle.size,
            '--firefly-duration': particle.duration,
            '--firefly-delay': particle.delay,
            '--firefly-drift-x': particle.driftX,
            '--firefly-color': particle.color,
          }}
        />
      ))}
    </div>
  )
}

function BackgroundField({ bugCount, showParticleCount, tone }) {
  const colors = getEffectPalette(tone)
  const particles = createBugParticles(bugCount)

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-[-10rem] top-[8rem] h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: colors.orbA }} />
      <div className="absolute right-[-8rem] top-[24rem] h-80 w-80 rounded-full blur-3xl" style={{ backgroundColor: colors.orbB }} />
      <div className="absolute bottom-[-8rem] left-[18%] h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: colors.orbB }} />
      <Fireflies tone={tone} />
      {particles.map((particle, index) => (
        <span
          key={index}
          className="app-bug-particle"
          style={{
            '--bug-color': colors.bug,
            '--bug-delay': particle.delay,
            '--bug-drift-x': particle.driftX,
            '--bug-drift-y': particle.driftY,
            '--bug-duration': particle.duration,
            '--bug-opacity': particle.opacity,
            '--bug-size': particle.size,
            '--bug-x': particle.x,
            '--bug-y': particle.y,
          }}
        />
      ))}
      {showParticleCount ? (
        <div className="absolute bottom-5 right-5 rounded-full border border-white/8 bg-black/35 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-stone-300 backdrop-blur-xl">
          {particles.length} bug particles
        </div>
      ) : null}
    </div>
  )
}

export default BackgroundField