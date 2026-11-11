import type { CSSProperties } from "react";

// Flick's mark: a fingertip flicking up into the frame, motion trails beside it and three sparks off
// its tip in the agents' colours (Lens's cyan, violet, Nudge's pink). On a 64×64 grid, for a black
// square. Drawn here once for the logo (components/ui.tsx) and the app icons (lib/app-icon.tsx);
// app/icon.svg, the browser tab's icon, is a copy of the same drawing, so change it with them.
//
// Still, it's the top of the flick. Animated (app/globals.css, .mark-*), the finger rests, pulls
// back, flicks, and the sparks burst off it; the transforms there start from this drawing.

/** The finger leans 14° into the flick, about the bottom middle of the square. */
const LEAN = "rotate(14 32 64)";
const sparks = [
  { d: "M31.19 24.25 27.83 19.28", color: "#36D1DC", dx: -0.56, dy: -0.83 },
  { d: "M42.4 22.28 43.85 16.46", color: "#A78BFA", dx: 0.24, dy: -0.97 },
  { d: "M51.38 29.29 56.67 26.47", color: "#F472B6", dx: 0.88, dy: -0.47 },
];

/**
 * The finger and its sparks, without the square: SVG children for a 64×64 viewBox. A function, not
 * a component: ImageResponse (lib/app-icon.tsx) takes only plain SVG elements inside <svg>.
 */
export function mark(animated = false) {
  const is = (name: string) => (animated ? name : undefined);
  return [
    <g key="finger" transform={LEAN} className={is("mark-finger")}>
      <path d="M22.5 72V35a9.5 9.5 0 0 1 19 0V72Z" fill="#fff" />
      <path d="M26.75 33.75a5.25 5.25 0 0 1 10.5 0V37a2.75 2.75 0 0 1-2.75 2.75h-5A2.75 2.75 0 0 1 26.75 37Z" fill="#C7C7CC" />
      <g stroke="#fff" strokeWidth={3.4} strokeLinecap="round" opacity={0.55} className={is("mark-trail")}>
        <path d="M14.5 34v8" />
        <path d="M49.5 39v8" />
      </g>
    </g>,
    <g key="sparks" strokeWidth={3.8} strokeLinecap="round">
      {sparks.map(({ d, color, dx, dy }) => (
        <path key={d} d={d} stroke={color} className={is("mark-spark")} style={animated ? ({ "--dx": dx, "--dy": dy } as CSSProperties) : undefined} />
      ))}
    </g>,
  ];
}
