import assert from 'node:assert/strict';
import { createECDH } from 'node:crypto';
import { test } from 'node:test';
import { encrypt } from './push.ts';

// Run with `npm test`. Web Push encryption, checked against RFC 8291's own example (Section 5, Appendix A).

const b = (s: string) => Buffer.from(s.replace(/\s/g, ''), 'base64url');

test("encrypts a push message exactly as RFC 8291's example does", () => {
  const local = createECDH('prime256v1');
  local.setPrivateKey(b('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'));
  const subscription = {
    endpoint: 'https://push.example.net/push/JzLQ3raZJfFBR0aqvOMsLrt54w4rJUsV',
    keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' },
  };
  const out = encrypt(subscription, Buffer.from('When I grow up, I want to be a watermelon'), b('DGv6ra1nlYgDCS1FRnbzlw'), local);

  const header = b('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z 9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml mlMoZIIgDll6e3vCYLocInmYWAmS6Tlz AC8wEqKK6PBru3jl7A8');
  const ciphertext = b('8pfeW0KbunFT06SuDKoJH9Ql87S1QUrd irN6GcG7sFz1y1sqLgVi1VhjVkHsUoEs bI_0LpXMuGvnzQ');
  assert.equal(out.toString('base64url'), Buffer.concat([header, ciphertext]).toString('base64url'));
});
