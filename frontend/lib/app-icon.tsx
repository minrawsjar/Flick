// Flick's app icon for ImageResponse: app/icon.svg's scan frame, white on black, with Lens's cyan
// line. Full-bleed, with the mark inside the middle 80%, so it also works as Android's maskable icon.

export function AppIcon({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="12 12 40 40" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 25v-4a4 4 0 0 1 4-4h4M39 17h4a4 4 0 0 1 4 4v4M47 39v4a4 4 0 0 1-4 4h-4M25 47h-4a4 4 0 0 1-4-4v-4" stroke="#fff" />
        <path d="M20 32h24" stroke="#36D1DC" />
      </svg>
    </div>
  );
}
