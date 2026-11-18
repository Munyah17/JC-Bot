// Session store — one conversation state per WhatsApp number.
// In-memory Map is the hot path (fast, synchronous); every mutation is
// also mirrored to Supabase when SUPABASE_URL + SUPABASE_SERVICE_KEY are set.
// A local JSONL ledger remains as a backup audit trail.

import { upsertSession, deleteSession, insertEvent, supabaseEnabled } from './supabase.js';

const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min idle timeout

export function getSession(phone) {
  const s = sessions.get(phone);
  if (s && Date.now() - s.updatedAt < SESSION_TTL_MS) return s;
  const fresh = { phone, state: 'START', data: {}, updatedAt: Date.now(), handoff: false };
  sessions.set(phone, fresh);
  upsertSession(fresh); // fire-and-forget
  return fresh;
}

export function saveSession(session) {
  session.updatedAt = Date.now();
  sessions.set(session.phone, session);
  upsertSession(session); // fire-and-forget
}

export function resetSession(phone) {
  sessions.delete(phone);
  deleteSession(phone); // fire-and-forget
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
  insertEvent(type, payload); // fire-and-forget
}

if (supabaseEnabled()) {
  console.log('Supabase persistence enabled.');
} else {
  console.log('Supabase not configured — running in-memory + JSONL only.');
}
