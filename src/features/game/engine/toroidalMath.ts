export function wrapCoordinate(value: number, span: number) {
  if (span <= 0) {
    return value;
  }

  const wrapped = value % span;
  return wrapped < 0 ? wrapped + span : wrapped;
}

export function getWrappedDelta(from: number, to: number, span: number) {
  if (span <= 0) {
    return to - from;
  }

  let delta = to - from;
  if (delta > span * 0.5) {
    delta -= span;
  } else if (delta < -span * 0.5) {
    delta += span;
  }

  return delta;
}

export function getWrappedDistanceSquared(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  width: number,
  height: number,
) {
  const dx = getWrappedDelta(fromX, toX, width);
  const dy = getWrappedDelta(fromY, toY, height);
  return dx * dx + dy * dy;
}

export function getWrappedDistance(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  width: number,
  height: number,
) {
  return Math.hypot(
    getWrappedDelta(fromX, toX, width),
    getWrappedDelta(fromY, toY, height),
  );
}