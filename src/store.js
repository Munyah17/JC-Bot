// Session store — one conversation state per WhatsApp number.
// In-memory by default; swap for Redis/DB in production.

const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min idle timeout

export function getSession(phone) {
  const s = sessions.get(phone);
  if (s && Date.now() - s.updatedAt < SESSION_TTL_MS) return s;
  const fresh = { phone, state: 'START', data: {}, updatedAt: Date.now(), handoff: false };
  sessions.set(phone, fresh);
  return fresh;
}

export function saveSession(session) {
  session.updatedAt = Date.now();
  sessions.set(session.phone, session);
}

export function resetSession(phone) {
  sessions.delete(phone);
  return getSession(phone);
}

// Simple append-only ledger for quotes & claims (JSONL, survives restarts).
import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export function recordEvent(type, payload) {
  const line = JSON.stringify({ type, at: new Date().toISOString(), ...payload }) + '\n';
  try {
    appendFileSync(join(DATA_DIR, 'events.jsonl'), line);
  } catch (e) {
    console.error('Failed to record event:', e.message);
  }
}
