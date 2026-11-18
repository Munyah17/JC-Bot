// WhatsApp Cloud API client.
// Translates engine Reply objects into Cloud API payloads and sends them.

const API_BASE = 'https://graph.facebook.com/v21.0';

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const DRY_RUN = process.env.DRY_RUN === 'true';

function toPayload(to, reply) {
  const base = { messaging_product: 'whatsapp', to };

  if (reply.buttons && reply.buttons.length) {
    return {
      ...base,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: (reply.text || '').slice(0, 1024) },
        action: {
          buttons: reply.buttons.slice(0, 3).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    };
  }

  if (reply.list) {
    return {
      ...base,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: (reply.text || '').slice(0, 1024) },
        action: {
          button: reply.list.buttonLabel.slice(0, 20),
          sections: reply.list.sections.map((s) => ({
            title: s.title.slice(0, 24),
            rows: s.rows.slice(0, 10).map((r) => ({
              id: r.id.slice(0, 200),
              title: r.title.slice(0, 24),
              ...(r.description ? { description: r.description.slice(0, 72) } : {}),
            })),
          })),
        },
      },
    };
  }

  return { ...base, type: 'text', text: { preview_url: false, body: reply.text || '' } };
}

async function post(payload) {
  const res = await fetch(`${API_BASE}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${body}`);
  }
  return res.json();
}

export async function sendReply(to, reply) {
  const payload = toPayload(to, reply);
  if (DRY_RUN || !TOKEN || !PHONE_NUMBER_ID) {
    console.log(`[DRY-RUN] -> ${to}:`, JSON.stringify(payload));
    return { dryRun: true };
  }
  try {
    return await post(payload);
  } catch (e) {
    console.error('Send failed:', e.message);
  }
}

export async function sendReplies(to, replies) {
  for (const r of replies) {
    await sendReply(to, r);
  }
}

export async function markAsRead(messageId) {
  if (DRY_RUN || !TOKEN || !PHONE_NUMBER_ID) return;
  try {
    await post({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  } catch {
    /* non-fatal */
  }
}

// Extract the user's text/id from any supported inbound message type.
export function extractInput(message) {
  switch (message.type) {
    case 'text':
      return message.text?.body ?? '';
    case 'interactive': {
      const it = message.interactive;
      if (it?.type === 'button_reply') return it.button_reply?.id ?? '';
      if (it?.type === 'list_reply') return it.list_reply?.id ?? '';
      return '';
    }
    case 'button':
      return message.button?.payload ?? '';
    default:
      return `__unsupported_${message.type}`;
  }
}
