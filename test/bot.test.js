import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMessage, newSession } from '../src/bot.js';

const P = () => `test-${Math.random().toString(36).slice(2, 8)}`;

test('greeting shows main menu list', () => {
  const p = P();
  const { replies } = handleMessage(p, 'hi');
  assert.ok(replies.some((r) => r.list));
});

test('full auto quote flow returns a price', () => {
  const p = P();
  handleMessage(p, 'hi');
  handleMessage(p, 'menu_quote');
  handleMessage(p, 'quote_auto');
  handleMessage(p, '2019');   // vehicle_year
  handleMessage(p, '25000');  // vehicle_value
  const { replies } = handleMessage(p, '30'); // driver_age
  const quote = replies.find((r) => r.text?.includes('estimate'));
  assert.ok(quote, 'expected a quote reply');
  assert.match(quote.text, /\$\d+\/month/);
});

test('invalid input re-asks the same field', () => {
  const p = P();
  handleMessage(p, 'hi');
  handleMessage(p, 'menu_quote');
  handleMessage(p, 'quote_health');
  const { replies } = handleMessage(p, 'not-a-number');
  assert.match(replies[0].text, /doesn't look right/);
});

test('claim filing flow produces a claim number', () => {
  const p = P();
  handleMessage(p, 'hi');
  handleMessage(p, 'menu_claim');
  handleMessage(p, 'claim_new');
  handleMessage(p, 'claimtype_auto');
  handleMessage(p, 'POL-99887');
  handleMessage(p, '2025-11-01');
  const { replies } = handleMessage(p, 'Someone rear-ended my car at a light.');
  assert.match(replies[0].text, /CLM-\d{6}/);
});

test('claim tracking accepts CLM-XXXXXX format', () => {
  const p = P();
  handleMessage(p, 'hi');
  handleMessage(p, 'menu_claim');
  handleMessage(p, 'claim_track');
  const { replies } = handleMessage(p, 'CLM-123456');
  assert.match(replies[0].text, /Under review/);
});

test('agent handoff silences the bot until "done"', () => {
  const p = P();
  handleMessage(p, 'hi');
  handleMessage(p, 'menu_agent');
  const silent = handleMessage(p, 'are you there?');
  assert.equal(silent.replies.length, 0);
  const back = handleMessage(p, 'done');
  assert.ok(back.replies.some((r) => r.list));
});

test('FAQ keyword works from main menu', () => {
  const p = P();
  handleMessage(p, 'hi');
  const { replies } = handleMessage(p, 'how do I pay my premium?');
  assert.match(replies[0].text, /billed monthly/i);
});

test('menu resets state mid-flow', () => {
  const p = P();
  handleMessage(p, 'hi');
  handleMessage(p, 'menu_quote');
  handleMessage(p, 'quote_home');
  const { replies } = handleMessage(p, 'menu');
  assert.ok(replies.some((r) => r.list));
});
