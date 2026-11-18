// Supabase client — initialized only when env vars are present.
// Every public function no-ops safely when Supabase isn't configured,
// so the bot works standalone (in-memory + JSONL) and upgrades to
// persistent storage the moment credentials are added to .env.

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
// Service role key: server-side only, bypasses RLS. Never expose to clients.
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false } }) : null;

export function supabaseEnabled() {
  return supabase !== null;
}

function report(op, error) {
  console.error(`[supabase] ${op} failed:`, error.message);
}

export async function upsertSession(session) {
  if (!supabase) return;
  const { error } = await supabase.from('bot_sessions').upsert(
    {
      phone: session.phone,
      state: session.state,
      data: session.data,
      handoff: session.handoff,
      updated_at: new Date(session.updatedAt).toISOString(),
    },
    { onConflict: 'phone' },
  );
  if (error) report('upsertSession', error);
}

export async function deleteSession(phone) {
  if (!supabase) return;
  const { error } = await supabase.from('bot_sessions').delete().eq('phone', phone);
  if (error) report('deleteSession', error);
}

export async function insertEvent(type, payload) {
  if (!supabase) return;
  const { phone, quoteId, claimId, ...rest } = payload;
  const { error } = await supabase.from('bot_events').insert({
    type,
    phone: phone ?? 'unknown',
    ref_id: quoteId ?? claimId ?? null,
    payload: rest,
  });
  if (error) report('insertEvent', error);
}
