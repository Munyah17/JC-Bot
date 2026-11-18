// Verifies Supabase connectivity and that bot tables exist.
// Usage: npm run db:check

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set in .env');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

let ok = true;
for (const table of ['bot_sessions', 'bot_events']) {
  const { error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    ok = false;
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      console.error(`✗ ${table}: missing — run supabase/schema.sql in the SQL Editor`);
    } else {
      console.error(`✗ ${table}: ${error.code ?? ''} ${error.message}`);
    }
  } else {
    console.log(`✓ ${table}: exists`);
  }
}

if (ok) {
  // Write + cleanup a probe row to confirm write access with the secret key.
  const probe = { phone: 'dbcheck-probe', state: 'START', data: {}, handoff: false, updated_at: new Date().toISOString() };
  const { error: werr } = await sb.from('bot_sessions').upsert(probe, { onConflict: 'phone' });
  if (werr) {
    console.error('✗ write test failed:', werr.message);
    process.exit(1);
  }
  await sb.from('bot_sessions').delete().eq('phone', 'dbcheck-probe');
  console.log('✓ write access confirmed — Supabase is ready.');
  process.exit(0);
} else {
  console.log('\nFix the issues above (see supabase/schema.sql), then re-run.');
  process.exit(1);
}
