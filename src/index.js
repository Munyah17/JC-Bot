import 'dotenv/config';
import express from 'express';
import { handleMessage } from './bot.js';
import { hydrateSession } from './store.js';
import { sendReplies, markAsRead, extractInput } from './whatsapp.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'dev-verify-token';

// --- Webhook verification (GET, used once by Meta) ---
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// --- Inbound messages (POST) ---
app.post('/webhook', async (req, res) => {
  // Always 200 quickly — Meta retries on non-200/slow responses.
  res.sendStatus(200);

  try {
    const entries = req.body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const messages = value?.messages ?? [];
        for (const message of messages) {
          const phone = message.from;
          const input = extractInput(message);

          await hydrateSession(phone);
          if (input.startsWith('__unsupported_')) {
            await sendReplies(phone, [
              { text: 'Sorry, I can only handle text messages for now. Type *menu* for options.' },
            ]);
            continue;
          }

          markAsRead(message.id);
          console.log(`<- ${phone}: ${input}`);

          const { replies } = handleMessage(phone, input);
          await sendReplies(phone, replies);
        }
      }
    }
  } catch (e) {
    console.error('Webhook handler error:', e);
  }
});

// Health check
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'jc-insurance-bot' }));

// Local test endpoint: POST /test { "phone": "123", "text": "hi" }
app.post('/test', async (req, res) => {
  const { phone = 'test-user', text = '' } = req.body ?? {};
  await hydrateSession(String(phone));
  const { replies } = handleMessage(String(phone), String(text));
  res.json({ replies });
});

// On Vercel the app is imported as a serverless handler — no listen() there.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Bot server listening on http://localhost:${PORT}`);
    console.log(`Webhook: POST/GET http://localhost:${PORT}/webhook`);
    if (process.env.DRY_RUN === 'true') console.log('DRY_RUN=true — replies logged, not sent to WhatsApp.');
  });
}

export default app;
