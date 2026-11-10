// "Flick to pay": one finger flicked up in front of the front camera confirms a payment
// (components/flick-confirm.tsx). Plain frame differencing on a tiny grayscale frame, all in the
// browser: what moved between two frames, and where; a flick is a movement that travels up a good
// part of the frame, fast, and mostly straight up. Tests: flick.test.ts.

/** What moved between two frames: the share of pixels that changed, and their centre (0 to 1). */
export type Motion = { t: number; amount: number; x: number; y: number };

/** How much a pixel's brightness (0 to 255) has to change to count as movement. */
const CHANGED = 28;

/** Compares two grayscale frames of the same size, `width` pixels wide. */
export function motion(prev: Uint8Array, next: Uint8Array, width: number, t: number): Motion {
  const height = next.length / width;
  let moved = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < next.length; i++) {
    if (Math.abs(next[i] - prev[i]) > CHANGED) {
      moved++;
      sx += i % width;
      sy += Math.floor(i / width);
    }
  }
  return { t, amount: moved / next.length, x: moved ? sx / moved / (width - 1) : 0.5, y: moved ? sy / moved / (height - 1) : 0.5 };
}

/**
 * Whether the last `WINDOW` ms of motion is a flick up: at least 3 frames with a finger's worth of
 * movement (not a flicker, not the whole picture changing at once, as when the camera adjusts its
 * exposure), whose centre rises at least `UP` of the frame, and rises more than it moves sideways
 * (a nod or a hand going past isn't a flick).
 */
const WINDOW = 600;
const UP = 0.3;
export function isFlick(recent: Motion[], now: number) {
  const moving = recent.filter((m) => now - m.t <= WINDOW && m.amount >= 0.02 && m.amount <= 0.6);
  if (moving.length < 3) return false;
  const first = moving[0];
  const last = moving[moving.length - 1];
  const rise = first.y - last.y; // y grows down the frame
  return rise >= UP && rise >= 1.5 * Math.abs(last.x - first.x);
}

/** A canvas frame's pixels (RGBA) as grayscale. */
export function gray(rgba: Uint8ClampedArray) {
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = (rgba[i * 4] * 3 + rgba[i * 4 + 1] * 4 + rgba[i * 4 + 2]) >> 3;
  return out;
}
