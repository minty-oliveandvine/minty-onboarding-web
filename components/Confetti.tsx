'use client';

// Confetti pieces: falling from the top on the "All Set" celebration page, or bursting
// out of given screen points on the module step when both modules are picked.
// Each piece is an SVG drawn in a 100×100 viewBox so they scale uniformly.
// Shapes are inspired by the colourful squiggles & dots in the brand palette.
import { useState, type CSSProperties } from 'react';

type Shape = { c: string; d: string; solid?: boolean };

/** Inline style plus the `--*` custom properties the keyframes read. */
type PieceStyle = CSSProperties & Record<`--${string}`, string>;

const CONFETTI_SHAPES: Shape[] = [
  { c: '#A18BE6', d: 'M20 70 C 10 45, 30 30, 45 35 S 70 60, 60 70 S 35 55, 50 40 S 80 25, 75 50' }, // purple curly loop
  { c: '#3B7BE6', d: 'M30 50 Q 50 30, 70 50' }, // blue arc
  { c: '#1F9D55', d: 'M15 25 C 30 10, 30 40, 50 25 S 70 50, 85 35' }, // green wavy
  { c: '#F5A623', d: 'M15 50 L 35 30 L 55 60 L 75 30 L 85 55' }, // orange zigzag
  { c: '#F5C518', d: 'M20 55 L 35 30 L 50 55 L 65 30 L 80 50' }, // yellow zigzag
  { c: '#1F9D55', d: 'M50 50 m-6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0', solid: true }, // green dot
  { c: '#F5A623', d: 'M15 30 C 30 60, 40 20, 55 50 S 75 70, 85 40' }, // orange wavy long
  { c: '#F08FB8', d: 'M30 30 C 20 50, 50 60, 60 45 S 50 25, 35 35 S 65 70, 70 50' }, // pink loop
  { c: '#F5C518', d: 'M15 60 C 25 40, 35 80, 50 50 S 70 40, 85 60' }, // yellow squiggle
  { c: '#3B7BE6', d: 'M50 50 m-4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0', solid: true }, // blue dot
  { c: '#E0463E', d: 'M50 30 C 60 50, 60 65, 50 70 C 40 65, 40 50, 50 30 Z', solid: true }, // red drop
  { c: '#A18BE6', d: 'M25 60 Q 50 35, 75 55' }, // purple arc
];

function ConfettiPiece({ shape, style, pop }: { shape: Shape; style: PieceStyle; pop: boolean }) {
  const stroke = !shape.solid;
  return (
    <svg
      className={'confetti-piece' + (pop ? ' is-pop' : '')}
      viewBox="0 0 100 100"
      style={style}
      aria-hidden
    >
      <path
        d={shape.d}
        stroke={stroke ? shape.c : 'none'}
        fill={stroke ? 'none' : shape.c}
        strokeWidth={stroke ? 9 : 0}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Randomised once per mount. Called from a lazy initialiser, never during render. */
function scatter(count: number) {
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  return Array.from({ length: count }, (_, i) => {
    const shape = CONFETTI_SHAPES[i % CONFETTI_SHAPES.length];
    const size = rand(28, 62);
    return {
      key: i,
      shape,
      style: {
        left: `${rand(2, 96)}%`,
        width: size,
        height: size,
        // launch-up offset (negative) so they "pop" from above before falling
        '--start-y': `${-rand(40, 140)}px`,
        '--end-y': `${rand(620, 880)}px`,
        '--end-x': `${rand(-90, 90)}px`,
        '--rot-start': `${rand(-90, 90)}deg`,
        '--rot-end': `${rand(540, 1080) * (Math.random() > 0.5 ? 1 : -1)}deg`,
        animationDuration: `${rand(4.4, 7.2)}s`,
        animationDelay: `${rand(0, 1.4)}s`,
      },
    };
  });
}

/** A viewport point to burst from, the fan of directions (screen degrees: 0 = right,
 * 90 = down) its pieces fly in, and how far the farthest one goes (default 440px). */
export type BurstOrigin = { x: number; y: number; from: number; to: number; reach?: number };

/** Pieces shared out between the origins, each flung somewhere inside its origin's fan. */
function burstFrom(count: number, origins: BurstOrigin[]) {
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  return Array.from({ length: count }, (_, i) => {
    const shape = CONFETTI_SHAPES[i % CONFETTI_SHAPES.length];
    const origin = origins[i % origins.length];
    const size = rand(20, 44);
    const angle = (rand(origin.from, origin.to) * Math.PI) / 180;
    const reach = origin.reach ?? 440;
    const dist = rand(reach * 0.27, reach);
    return {
      key: i,
      shape,
      style: {
        left: origin.x - size / 2,
        top: origin.y - size / 2,
        width: size,
        height: size,
        '--end-x': `${Math.cos(angle) * dist}px`,
        '--end-y': `${Math.sin(angle) * dist}px`,
        '--rot-start': `${rand(-90, 90)}deg`,
        '--rot-end': `${rand(360, 720) * (Math.random() > 0.5 ? 1 : -1)}deg`,
        animationDuration: `${rand(1.1, 1.8)}s`,
        animationDelay: `${rand(0, 0.12)}s`,
      },
    };
  });
}

export default function Confetti({
  count = 36,
  origins,
}: {
  count?: number;
  /** Burst out of these viewport points instead of falling from the top. */
  origins?: BurstOrigin[];
}) {
  // State with a lazy initialiser rather than useMemo: Math.random is impure, and a
  // memo still runs during render. The burst is generated once when the component
  // mounts and never re-rolled -- which is also what a burst should do. `count` and
  // `origins` are read once on purpose; a caller wanting a new burst remounts with a new key.
  const [pieces] = useState(() => (origins ? burstFrom(count, origins) : scatter(count)));

  return (
    <div className={'confetti-stage' + (origins ? ' is-pop' : '')} aria-hidden>
      {pieces.map((p) => (
        <ConfettiPiece key={p.key} shape={p.shape} style={p.style} pop={!!origins} />
      ))}
    </div>
  );
}
