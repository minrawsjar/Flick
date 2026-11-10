// `npm test`: the flick detector (flick.ts), on synthetic frames.
import assert from "node:assert/strict";
import { test } from "node:test";
import { isFlick, motion, type Motion } from "./flick.ts";

const W = 64;
const H = 48;
/** A dark frame with a bright block (a finger, or a hand) at `x`, `y`, `w` by `h`. */
function frame(x: number, y: number, w = 10, h = 20) {
  const f = new Uint8Array(W * H).fill(20);
  for (let r = Math.max(0, y); r < Math.min(H, y + h); r++) for (let c = Math.max(0, x); c < Math.min(W, x + w); c++) f[r * W + c] = 220;
  return f;
}
/** The motion between each pair of frames, `ms` apart. */
function track(frames: Uint8Array[], ms = 33) {
  const out: Motion[] = [];
  for (let i = 1; i < frames.length; i++) out.push(motion(frames[i - 1], frames[i], W, i * ms));
  return out;
}
const flicked = (m: Motion[]) => isFlick(m, m.at(-1)!.t);

test("one finger flicked up is a flick", () => {
  assert.equal(flicked(track([40, 32, 24, 16, 8, 0, -8].map((y) => frame(28, y)))), true);
});

test("a finger flicked up at a slight angle still counts", () => {
  assert.equal(flicked(track([40, 32, 24, 16, 8, 0].map((y, i) => frame(24 + i * 2, y)))), true);
});

test("a finger moving down is not", () => {
  assert.equal(flicked(track([-8, 0, 8, 16, 24, 32, 40].map((y) => frame(28, y)))), false);
});

test("a hand going past sideways is not", () => {
  assert.equal(flicked(track([0, 8, 16, 24, 32, 40, 48].map((x) => frame(x, 14, 16, 16)))), false);
});

test("a finger that rises a little, then stops, is not", () => {
  assert.equal(flicked(track([30, 28, 26, 26, 26, 26].map((y) => frame(28, y)))), false);
});

test("the whole picture changing at once (the camera adjusting its exposure) is not", () => {
  const dark = new Uint8Array(W * H).fill(20);
  const bright = new Uint8Array(W * H).fill(200);
  assert.equal(flicked(track([dark, bright, dark, bright, dark])), false);
});

test("a slow rise up the frame is not", () => {
  // The same distance as the flick, over more than a second: only the last 600 ms count.
  assert.equal(flicked(track([40, 37, 34, 31, 28, 25, 22, 19, 16, 13, 10, 7, 4, 1, -2].map((y) => frame(28, y)), 150)), false);
});

test("a still frame has no motion", () => {
  assert.equal(motion(frame(10, 10), frame(10, 10), W, 0).amount, 0);
});
