import { memo, useEffect, useMemo, useRef } from 'react'
import { createBugParticles, createFireflyParticles, getEffectPalette, getMotionProfile } from '../utils/backgroundEffects.js'

const TARGET_FRAME_MS = 1000 / 24
const TRANSITION_EASING = 0.08

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function interpolate(currentValue, targetValue, easing = TRANSITION_EASING) {
  return currentValue + (targetValue - currentValue) * easing
}

function drawBug(ctx, x, y, size, opacity, rotation, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.scale(size / 24, size / 24)
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.4
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.moveTo(-3.5, -4.8)
  ctx.lineTo(-7.5, -7.2)
  ctx.moveTo(3.5, -4.8)
  ctx.lineTo(7.5, -7.2)
  ctx.moveTo(-4.2, -0.8)
  ctx.lineTo(-8.2, -0.8)
  ctx.moveTo(4.2, -0.8)
  ctx.lineTo(8.2, -0.8)
  ctx.moveTo(-4.4, 3.1)
  ctx.lineTo(-8, 5.3)
  ctx.moveTo(4.4, 3.1)
  ctx.lineTo(8, 5.3)
  ctx.moveTo(-1.7, 7.7)
  ctx.lineTo(-3.2, 10.2)
  ctx.moveTo(1.7, 7.7)
  ctx.lineTo(3.2, 10.2)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(0, -7.4, 2.4, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(0, 1.8, 4.4, 7.1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

const BugCanvas = memo(function BugCanvas({ bugColor, bugVisualSettings, motionProfile, particles }) {
  const canvasRef = useRef(null)
  const particlesRef = useRef(particles)
  const motionProfileRef = useRef(motionProfile)
  const bugColorRef = useRef(bugColor)
  const targetSettingsRef = useRef({
    sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
    speedMultiplier: Math.max(0.2, bugVisualSettings?.chaosMultiplier ?? 1),
  })
  const animatedStateRef = useRef({
    sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
    speedMultiplier: Math.max(0.2, bugVisualSettings?.chaosMultiplier ?? 1),
  })

  useEffect(() => {
    particlesRef.current = particles
  }, [particles])

  useEffect(() => {
    motionProfileRef.current = motionProfile
  }, [motionProfile])

  useEffect(() => {
    bugColorRef.current = bugColor
  }, [bugColor])

  useEffect(() => {
    targetSettingsRef.current = {
      sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
      speedMultiplier: Math.max(0.2, bugVisualSettings?.chaosMultiplier ?? 1),
    }
  }, [bugVisualSettings])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    const context = canvas.getContext('2d', { alpha: true })
    if (!context) {
      return undefined
    }

    let animationFrameId = 0
    let lastDrawTime = 0
    let width = 0
    let height = 0
    let isActive = !document.hidden && document.hasFocus()

    const resizeCanvas = () => {
      const nextWidth = canvas.clientWidth
      const nextHeight = canvas.clientHeight
      const devicePixelRatio = window.devicePixelRatio || 1

      if (!nextWidth || !nextHeight) {
        return
      }

      width = nextWidth
      height = nextHeight
      canvas.width = Math.floor(nextWidth * devicePixelRatio)
      canvas.height = Math.floor(nextHeight * devicePixelRatio)
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      context.clearRect(0, 0, width, height)
    }

    const updateActivity = () => {
      isActive = !document.hidden && document.hasFocus()
      if (isActive && !animationFrameId) {
        animationFrameId = window.requestAnimationFrame(renderFrame)
      }
    }

    const renderFrame = (timestamp) => {
      animationFrameId = 0

      if (!isActive) {
        return
      }

      if (timestamp - lastDrawTime < TARGET_FRAME_MS) {
        animationFrameId = window.requestAnimationFrame(renderFrame)
        return
      }

      lastDrawTime = timestamp
      context.clearRect(0, 0, width, height)

      const timeSeconds = timestamp / 1000
      const nextSettings = targetSettingsRef.current
      const animatedState = animatedStateRef.current
      animatedState.sizeMultiplier = interpolate(animatedState.sizeMultiplier, nextSettings.sizeMultiplier)
      animatedState.speedMultiplier = interpolate(animatedState.speedMultiplier, nextSettings.speedMultiplier)

      const sizeMultiplier = animatedState.sizeMultiplier
      const speedMultiplier = clamp(animatedState.speedMultiplier, 0.2, 6)
      const activeParticles = particlesRef.current
      const activeMotionProfile = motionProfileRef.current
      const activeBugColor = bugColorRef.current

      for (let index = 0; index < activeParticles.length; index += 1) {
        const particle = activeParticles[index]
        const cycleDuration = Math.max(4, particle.duration * activeMotionProfile.durationMultiplier / speedMultiplier)
        const cycleProgress = ((timeSeconds + particle.delay) % cycleDuration) / cycleDuration
        const driftWave = Math.sin(cycleProgress * Math.PI * 2)
        const swayWave = Math.cos(cycleProgress * Math.PI * 2 * 1.35)
        const x = (particle.x / 100) * width + driftWave * particle.driftX * speedMultiplier
        const y = (particle.y / 100) * height + swayWave * particle.driftY * speedMultiplier
        const opacity = Math.max(0.08, particle.opacity * activeMotionProfile.opacityMultiplier * (0.76 + 0.32 * Math.sin(cycleProgress * Math.PI * 2 + index * 0.2)))
        const size = particle.size * activeMotionProfile.scale * sizeMultiplier
        const rotation = Math.sin(cycleProgress * Math.PI * 4 + index * 0.12) * 0.22

        drawBug(context, x, y, size, opacity, rotation, activeBugColor)
      }

      animationFrameId = window.requestAnimationFrame(renderFrame)
    }

    resizeCanvas()

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
    })
    resizeObserver.observe(canvas)

    document.addEventListener('visibilitychange', updateActivity)
    window.addEventListener('focus', updateActivity)
    window.addEventListener('blur', updateActivity)
    animationFrameId = window.requestAnimationFrame(renderFrame)

    return () => {
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', updateActivity)
      window.removeEventListener('focus', updateActivity)
      window.removeEventListener('blur', updateActivity)
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [])

  return <canvas ref={canvasRef} className="app-bug-canvas absolute inset-0 h-full w-full" aria-hidden="true" />
})

const Fireflies = memo(function Fireflies({ tone }) {
  const particles = useMemo(() => createFireflyParticles(tone), [tone])

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
})

const BackgroundField = memo(function BackgroundField({ bugCount, bugVisualSettings, showParticleCount, tone }) {
  const colors = useMemo(() => getEffectPalette(tone), [tone])
  const particles = useMemo(() => createBugParticles(bugCount), [bugCount])
  const motionProfile = useMemo(() => getMotionProfile(tone), [tone])
  const totalBugCount = Math.max(0, Math.floor(bugCount ?? 0))

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-[-10rem] top-[8rem] h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: colors.orbA }} />
      <div className="absolute right-[-8rem] top-[24rem] h-80 w-80 rounded-full blur-3xl" style={{ backgroundColor: colors.orbB }} />
      <div className="absolute bottom-[-8rem] left-[18%] h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: colors.orbB }} />
      <Fireflies tone={tone} />
      <BugCanvas bugColor={colors.bug} bugVisualSettings={bugVisualSettings} motionProfile={motionProfile} particles={particles} />
      {showParticleCount ? (
        <div className="absolute bottom-5 right-5 rounded-full border border-white/8 bg-black/35 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-stone-300 backdrop-blur-xl">
          {totalBugCount} bugs rendered
        </div>
      ) : null}
    </div>
  )
})

export default BackgroundField