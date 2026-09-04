export const DOT_BACKGROUND_BASE_GAP = 16;
export const DOT_BACKGROUND_DOT_SIZE = 1;
export const DOT_BACKGROUND_INSET = 96;

interface DotBackgroundMetricsInput {
  panOffset: { x: number; y: number };
  zoom: number;
}

export interface DotBackgroundMetrics {
  gap: number;
  tx: number;
  ty: number;
  dotSize: number;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function calculateDotBackgroundMetrics({
  panOffset,
  zoom,
}: DotBackgroundMetricsInput): DotBackgroundMetrics {
  const gap = DOT_BACKGROUND_BASE_GAP * zoom;
  return {
    gap,
    tx: positiveModulo(panOffset.x + DOT_BACKGROUND_INSET, gap),
    ty: positiveModulo(panOffset.y + DOT_BACKGROUND_INSET, gap),
    dotSize: DOT_BACKGROUND_DOT_SIZE * zoom,
  };
}
