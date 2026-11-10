// `npm test`: the flick detector (flick.ts), on synthetic frames.
import assert from "node:assert/strict";
import { test } from "node:test";
import { isFlick, motion, type Motion } from "./flick.ts";

const W = 64;
const H = 48;
/** A dark frame with a bright "hand" block whose left edge is at `x` (and top at `y`). */
function frame(x: number, y = 14, size = 16) {
  const f = new Uint8Array(W * H).fill(20);
  for (let r = y; r < Math.min(H, y + size); r++) for (let c = Math.max(0, x); c < Math.min(W, x + size); c++) f[r * W + c] = 220;
  return f;
}
/** The motion between each pair of frames, 50 ms apart. */
function track(frames: Uint8Array[]) {
  const out: Motion[] = [];
  for (let i = 1; i < frames.length; i++) out.push(motion(frames[i - 1], frames[i], W, i * 50));
  return out;
}

test("a hand sweeping across the frame is a flick", () => {
  const sweep = track([0, 8, 16, 24, 32, 40, 48].map((x) => frame(x)));
  assert.equal(isFlick(sweep, sweep.at(-1)!.t), true);
});

test("an upward flick counts too", () => {
  const up = track([30, 25, 20, 15, 10, 5, 0].map((y) => frame(24, y, 14)));
  assert.equal(isFlick(up, up.at(-1)!.t), true);
});

test("a hand that moves a little, then stops, is not", () => {
  const fidget = track([20, 22, 24, 24, 24, 24].map((x) => frame(x)));
  assert.equal(isFlick(fidget, fidget.at(-1)!.t), false);
});

test("the whole picture changing at once (the camera adjusting its exposure) is not", () => {
  const dark = new Uint8Array(W * H).fill(20);
  const bright = new Uint8Array(W * H).fill(200);
  const flash = track([dark, bright, dark, bright, dark]);
  assert.equal(isFlick(flash, flash.at(-1)!.t), false);
});

test("a slow drift across the frame is not", () => {
  // The same distance as the sweep, over more than a second: only the last 700 ms count.
  const slow: Motion[] = [];
  const xs = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48];
  for (let i = 1; i < xs.length; i++) slow.push(motion(frame(xs[i - 1]), frame(xs[i]), W, i * 150));
  assert.equal(isFlick(slow, slow.at(-1)!.t), false);
});

test("a still frame has no motion", () => {
  assert.equal(motion(frame(10), frame(10), W, 0).amount, 0);
});
