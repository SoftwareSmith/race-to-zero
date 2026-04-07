import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBugParticles, createFireflyParticles, getEffectPalette, getMotionProfile, getSceneProfile } from '../utils/backgroundEffects.js'

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

const BugCanvas = memo(function BugCanvas({ bugColor, bugVisualSettings, chartFocus, motionProfile, onHit, particles, sceneProfile, terminatorMode }) {
  const canvasRef = useRef(null)
  const particlesRef = useRef(particles)
  const motionProfileRef = useRef(motionProfile)
  const sceneProfileRef = useRef(sceneProfile)
  const chartFocusRef = useRef(chartFocus)
  const bugColorRef = useRef(bugColor)
  const boundsRef = useRef({ height: 0, left: 0, top: 0, width: 0 })
  const latestBugPositionsRef = useRef([])
  const deadBugIndexesRef = useRef(new Set())
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
    deadBugIndexesRef.current = new Set()
  }, [particles])

  useEffect(() => {
    motionProfileRef.current = motionProfile
  }, [motionProfile])

  useEffect(() => {
    sceneProfileRef.current = sceneProfile
  }, [sceneProfile])

  useEffect(() => {
    chartFocusRef.current = chartFocus
  }, [chartFocus])

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
    if (!terminatorMode) {
      deadBugIndexesRef.current = new Set()
    }
  }, [terminatorMode])

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
      boundsRef.current = {
        height: nextHeight,
        left: canvas.getBoundingClientRect().left,
        top: canvas.getBoundingClientRect().top,
        width: nextWidth,
      }
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
      const activeSceneProfile = sceneProfileRef.current
      const activeChartFocus = chartFocusRef.current
      const activeBugColor = bugColorRef.current
      const deadBugIndexes = deadBugIndexesRef.current
      const focusX = activeChartFocus?.relativeIndex ?? 0.5
      const focusStrength = activeChartFocus ? activeSceneProfile.chartFocusStrength : 0
      const clusterCenterX = 0.5
      const clusterCenterY = 0.48
      latestBugPositionsRef.current = []

      for (let index = 0; index < activeParticles.length; index += 1) {
        if (deadBugIndexes.has(index)) {
          continue
        }

        const particle = activeParticles[index]
        const cycleDuration = Math.max(4, particle.duration * activeMotionProfile.durationMultiplier / speedMultiplier)
        const cycleProgress = ((timeSeconds + particle.delay) % cycleDuration) / cycleDuration
        const driftWave = Math.sin(cycleProgress * Math.PI * 2)
        const swayWave = Math.cos(cycleProgress * Math.PI * 2 * 1.35)
        const normalizedX = particle.x / 100
        const normalizedY = particle.y / 100
        const clusterShiftX = (clusterCenterX - normalizedX) * width * activeSceneProfile.clusterStrength * 0.22
        const clusterShiftY = (clusterCenterY - normalizedY) * height * activeSceneProfile.clusterStrength * 0.12
        const focusDistance = Math.abs(normalizedX - focusX)
        const focusFalloff = activeChartFocus ? Math.max(0, 1 - focusDistance * 3.1) : 0
        const chartShiftX = activeChartFocus ? (focusX - normalizedX) * width * focusStrength * focusFalloff * 0.2 : 0
        const x = normalizedX * width + clusterShiftX + chartShiftX + driftWave * particle.driftX * speedMultiplier
        const y = normalizedY * height + clusterShiftY + swayWave * particle.driftY * speedMultiplier
        const opacity = Math.max(0.08, particle.opacity * activeMotionProfile.opacityMultiplier * (0.76 + 0.32 * Math.sin(cycleProgress * Math.PI * 2 + index * 0.2)) * (activeChartFocus ? 0.72 + focusFalloff * 0.6 : 1))
        const size = particle.size * activeMotionProfile.scale * sizeMultiplier * (activeChartFocus ? 0.92 + focusFalloff * 0.26 : 1)
        const rotation = Math.sin(cycleProgress * Math.PI * 4 + index * 0.12) * 0.22

        latestBugPositionsRef.current.push({ index, radius: Math.max(size * 0.7, 12), x, y })

        drawBug(context, x, y, size, opacity, rotation, activeBugColor)
      }

      animationFrameId = window.requestAnimationFrame(renderFrame)
    }

    resizeCanvas()

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
    })
    resizeObserver.observe(canvas)

    const handlePointerDown = (event) => {
      if (!terminatorMode) {
        return
      }

      const targetElement = event.target instanceof Element ? event.target : null
      if (targetElement?.closest('button, a, input, select, textarea, label, summary')) {
        return
      }

      const bounds = boundsRef.current
      if (!bounds.width || !bounds.height) {
        return
      }

      const clickX = event.clientX - bounds.left
      const clickY = event.clientY - bounds.top
      let hitCandidate = null

      for (const bugPosition of latestBugPositionsRef.current) {
        const distance = Math.hypot(clickX - bugPosition.x, clickY - bugPosition.y)
        if (distance <= bugPosition.radius && (!hitCandidate || distance < hitCandidate.distance)) {
          hitCandidate = { distance, index: bugPosition.index }
        }
      }

      if (hitCandidate) {
        if (deadBugIndexesRef.current.has(hitCandidate.index)) {
          return
        }

        deadBugIndexesRef.current.add(hitCandidate.index)
        onHit({ x: event.clientX, y: event.clientY })
      }
    }

    document.addEventListener('visibilitychange', updateActivity)
    window.addEventListener('focus', updateActivity)
    window.addEventListener('blur', updateActivity)
    window.addEventListener('mousedown', handlePointerDown)
    animationFrameId = window.requestAnimationFrame(renderFrame)

    return () => {
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', updateActivity)
      window.removeEventListener('focus', updateActivity)
      window.removeEventListener('blur', updateActivity)
      window.removeEventListener('mousedown', handlePointerDown)
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [onHit, terminatorMode])

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

const BackgroundField = memo(function BackgroundField({ bugCount, bugVisualSettings, chartFocus, milestoneFlash, showParticleCount, terminatorMode, tone }) {
  const visualTone = bugCount === 0 ? 'all-clear' : tone
  const colors = useMemo(() => getEffectPalette(visualTone), [visualTone])
  const particles = useMemo(() => createBugParticles(bugCount), [bugCount])
  const motionProfile = useMemo(() => getMotionProfile(visualTone), [visualTone])
  const sceneProfile = useMemo(() => getSceneProfile(visualTone), [visualTone])
  const totalBugCount = Math.max(0, Math.floor(bugCount ?? 0))
  const gameSessionKey = `${terminatorMode ? 'terminator' : 'ambient'}:${totalBugCount}`
  const [hammerPosition, setHammerPosition] = useState({ x: 0, y: 0 })
  const [hammerSwing, setHammerSwing] = useState(false)
  const [gameState, setGameState] = useState(() => ({
    remainingTargets: totalBugCount,
    sessionKey: gameSessionKey,
    splats: [],
  }))
  const activeGameState = gameState.sessionKey === gameSessionKey
    ? gameState
    : { remainingTargets: totalBugCount, sessionKey: gameSessionKey, splats: [] }

  useEffect(() => {
    if (!terminatorMode) {
      return undefined
    }

    const handlePointerMove = (event) => {
      setHammerPosition({ x: event.clientX, y: event.clientY })
    }

    window.addEventListener('mousemove', handlePointerMove)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
    }
  }, [terminatorMode])

  useEffect(() => {
    if (!hammerSwing) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setHammerSwing(false)
    }, 180)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [hammerSwing])

  useEffect(() => {
    if (activeGameState.splats.length === 0) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setGameState((currentValue) => {
        if (currentValue.sessionKey !== gameSessionKey || currentValue.splats.length <= 3) {
          return currentValue
        }

        return {
          ...currentValue,
          splats: currentValue.splats.slice(-3),
        }
      })
    }, 420)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeGameState.splats.length, gameSessionKey])

  const handleBugHit = useCallback((payload) => {
    setHammerSwing(true)
    setGameState((currentValue) => {
      const nextState = currentValue.sessionKey === gameSessionKey
        ? currentValue
        : { remainingTargets: totalBugCount, sessionKey: gameSessionKey, splats: [] }

      return {
        remainingTargets: Math.max(0, nextState.remainingTargets - 1),
        sessionKey: gameSessionKey,
        splats: [...nextState.splats.slice(-5), { id: `${payload.x}-${payload.y}-${Date.now()}`, x: payload.x, y: payload.y }],
      }
    })
  }, [gameSessionKey, totalBugCount])

  const overlayLabel = terminatorMode
    ? activeGameState.remainingTargets === 0
      ? 'Target neutralized'
      : `${activeGameState.remainingTargets} targets left`
    : `${totalBugCount} bugs rendered`

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-[-10rem] top-[8rem] h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: colors.orbA }} />
      <div className="absolute right-[-8rem] top-[24rem] h-80 w-80 rounded-full blur-3xl" style={{ backgroundColor: colors.orbB }} />
      <div className="absolute bottom-[-8rem] left-[18%] h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: colors.orbB }} />
      <Fireflies tone={visualTone} />
      {milestoneFlash ? <div className="app-milestone-burst absolute inset-0" /> : null}
      {chartFocus ? <div className="app-chart-focus absolute inset-y-0 w-48 -translate-x-1/2 blur-3xl" style={{ left: `${(chartFocus.relativeIndex ?? 0.5) * 100}%`, background: colors.orbA }} /> : null}
      <BugCanvas bugColor={colors.bug} bugVisualSettings={bugVisualSettings} chartFocus={chartFocus} motionProfile={motionProfile} onHit={handleBugHit} particles={particles} sceneProfile={sceneProfile} terminatorMode={terminatorMode} />
      {totalBugCount === 0 ? <div className="app-all-clear-glow absolute inset-0" /> : null}
      {terminatorMode ? (
        <div
          className={`app-hammer-cursor fixed left-0 top-0 z-[90] ${hammerSwing ? 'app-hammer-swing' : ''}`}
          style={{ transform: `translate3d(${hammerPosition.x}px, ${hammerPosition.y}px, 0)` }}
        >
          <span className="app-hammer-icon">🔨</span>
        </div>
      ) : null}
      {activeGameState.splats.map((splat) => (
        <div
          key={splat.id}
          className="app-bug-splat fixed z-[80]"
          style={{ left: `${splat.x}px`, top: `${splat.y}px` }}
        />
      ))}
      {(showParticleCount || terminatorMode) ? (
        <div className="absolute bottom-5 right-5 rounded-full border border-white/8 bg-black/35 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-stone-300 backdrop-blur-xl">
          {overlayLabel}
        </div>
      ) : null}
    </div>
  )
})

export default BackgroundField