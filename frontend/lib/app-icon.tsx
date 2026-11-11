import { mark } from "./mark";

// Flick's app icon for ImageResponse: the mark (lib/mark.tsx) on black, the finger rising from the
// bottom edge. Full-bleed, a little smaller about that edge so the sparks stay clear of the corners
// iOS rounds and the shapes Android masks to.

export function AppIcon({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, display: "flex", background: "#000" }}>
      <svg width={size} height={size} viewBox="0 0 64 64">
        <g transform="translate(32 64) scale(0.9) translate(-32 -64)">
          {mark()}
        </g>
      </svg>
    </div>
  );
}
