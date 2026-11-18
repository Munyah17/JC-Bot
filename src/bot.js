// Conversation engine — pure state machine, no WhatsApp-specific code.
// handleMessage(session, input) returns { replies: Reply[] } where
// Reply = { text } | { text, buttons:[{id,title}] } | { text, list:{buttonLabel, sections} }

import { PRODUCTS, CLAIM_TYPES, FAQS, COMPANY } from './data.js';
import { getSession, saveSession, resetSession, recordEvent } from './store.js';

const MAIN_MENU = {
  text: `How can I help you today?`,
  list: {
    buttonLabel: 'View options',
    sections: [
      {
        title: 'Services',
        rows: [
          { id: 'menu_products', title: '📋 Our Products', description: 'See what we cover' },
          { id: 'menu_quote', title: '💰 Get a Quote', description: 'Instant estimate in ~1 min' },
          { id: 'menu_claim', title: '🛠️ File / Track a Claim', description: 'Submit or check a claim' },
          { id: 'menu_faq', title: '❓ FAQs', description: 'Common questions' },
          { id: 'menu_agent', title: '👤 Talk to an Agent', description: 'Human assistance' },
        ],
      },
    ],
  },
};

const QUOTE_MENU = {
  text: 'Which product would you like a quote for?',
  list: {
    buttonLabel: 'Choose product',
    sections: [
      {
        title: 'Insurance products',
        rows: Object.entries(PRODUCTS).map(([key, p]) => ({
          id: `quote_${key}`,
          title: `${p.emoji} ${p.name}`,
          description: `From ~$${p.baseMonthly}/mo`,
        })),
      },
    ],
  },
};

const CLAIM_MENU = {
  text: 'Claims — what would you like to do?',
  buttons: [
    { id: 'claim_new', title: 'File new claim' },
    { id: 'claim_track', title: 'Track a claim' },
    { id: 'menu_main', title: 'Back to menu' },
  ],
};

const CLAIM_TYPE_MENU = {
  text: 'What type of claim are you filing?',
  list: {
    buttonLabel: 'Claim types',
    sections: [
      {
        title: 'Claim type',
        rows: Object.entries(CLAIM_TYPES).map(([key, label]) => ({
          id: `claimtype_${key}`,
          title: label,
        })),
      },
    ],
  },
};

const CLAIM_FIELDS = [
  { key: 'policy_number', prompt: 'Please enter your policy number (e.g. POL-12345).', validate: /^[A-Za-z0-9-]{4,}$/ },
  { key: 'incident_date', prompt: 'When did the incident happen? (YYYY-MM-DD)', validate: /^\d{4}-\d{2}-\d{2}$/ },
  { key: 'description', prompt: 'Briefly describe what happened (one or two sentences).', validate: /^.{10,}$/s },
];

// ---------- helpers ----------

const norm = (s) => (s || '').trim().toLowerCase();
const isMenuCmd = (t) => ['menu', 'main menu', 'start', 'restart', 'hi', 'hello', 'hey', 'help', 'back', 'cancel'].includes(t);

function productReply(key) {
  const p = PRODUCTS[key];
  return {
    text: `${p.emoji} *${p.name}*\n\n${p.description}\n\n_From ~$${p.baseMonthly}/month._\n\nReply *quote* to get a personalized estimate, or *menu* to go back.`,
  };
}

function faqAnswer(text) {
  const t = norm(text);
  const hit = FAQS.find((f) => f.keywords.some((k) => t.includes(k)));
  if (hit) return hit.answer;
  return null;
}

function genId(prefix) {
  return `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function nextClaimField(session) {
  const idx = session.data.claimFieldIdx ?? 0;
  if (idx < CLAIM_FIELDS.length) return CLAIM_FIELDS[idx];
  return null;
}

// ---------- main entry ----------

export function handleMessage(phone, rawInput) {
  const session = getSession(phone);
  const input = (rawInput || '').trim();
  const t = norm(input);
  const replies = [];

  // Global commands work from any state.
  if (isMenuCmd(t)) {
    if (t === 'hi' || t === 'hello' || t === 'hey') {
      replies.push({
        text: `👋 Welcome to *${COMPANY.name}* — ${COMPANY.tagline}\n\nI'm your virtual assistant, available 24/7.`,
      });
    } else if (t !== 'back') {
      replies.push({ text: 'Sure, taking you back to the main menu.' });
    }
    session.state = 'MAIN_MENU';
    session.data = {};
    saveSession(session);
    replies.push(MAIN_MENU);
    return { replies };
  }

  // Human-handoff mode: bot stays silent except for release commands.
  if (session.handoff) {
    if (t === 'done' || t === 'bot') {
      session.handoff = false;
      session.state = 'MAIN_MENU';
      saveSession(session);
      replies.push({ text: 'You are back with the virtual assistant.' }, MAIN_MENU);
    }
    return { replies };
  }

  // Try FAQ shortcut on any free text before state handling.
  if (session.state === 'MAIN_MENU' && input.length > 2) {
    const answer = faqAnswer(input);
    if (answer) {
      replies.push({ text: answer }, { text: 'Anything else? Type *menu* for options.' });
      saveSession(session);
      return { replies };
    }
  }

  switch (session.state) {
    case 'START':
    case 'MAIN_MENU':
      routeMenu(session, t, replies);
      break;

    case 'PRODUCTS':
      handleProducts(session, t, replies);
      break;

    case 'QUOTE_PICK':
      handleQuotePick(session, t, replies);
      break;

    case 'QUOTE_FORM':
      handleQuoteForm(session, input, replies);
      break;

    case 'CLAIM_MENU':
      handleClaimMenu(session, t, replies);
      break;

    case 'CLAIM_TYPE':
      handleClaimType(session, t, replies);
      break;

    case 'CLAIM_FORM':
      handleClaimForm(session, input, replies);
      break;

    case 'CLAIM_TRACK':
      handleClaimTrack(session, input, replies);
      break;

    case 'FAQ':
      handleFaq(session, input, replies);
      break;

    default:
      session.state = 'MAIN_MENU';
      replies.push(MAIN_MENU);
  }

  saveSession(session);
  return { replies };
}

// ---------- state handlers ----------

function routeMenu(session, t, replies) {
  if (t === 'menu_products' || t === '1' || t === 'products' || t === 'product') {
    session.state = 'PRODUCTS';
    const lines = Object.entries(PRODUCTS)
      .map(([key, p], i) => `${i + 1}. ${p.emoji} *${p.name}* — ${p.description}`)
      .join('\n\n');
    replies.push(
      { text: `📋 *Our Products*\n\n${lines}` },
      { text: 'Reply with a number or product name for details — or *quote* to start an estimate.' },
    );
  } else if (t === 'menu_quote' || t === '2' || t === 'quote' || t === 'get a quote') {
    session.state = 'QUOTE_PICK';
    replies.push(QUOTE_MENU);
  } else if (t === 'menu_claim' || t === '3' || t === 'claim' || t === 'claims') {
    session.state = 'CLAIM_MENU';
    replies.push(CLAIM_MENU);
  } else if (t === 'menu_faq' || t === '4' || t === 'faq' || t === 'faqs' || t === 'questions') {
    session.state = 'FAQ';
    replies.push({
      text: `❓ *FAQs*\n\nAsk me anything — e.g.:\n• "How do I pay my premium?"\n• "What documents do I need?"\n• "How do I cancel?"\n\nOr type *agent* to reach a human.`,
    });
  } else if (t === 'menu_agent' || t === '5' || t === 'agent' || t === 'human' || t === 'person') {
    session.state = 'AGENT_QUEUE';
    session.handoff = true;
    recordEvent('handoff', { phone: session.phone });
    replies.push({
      text: `👤 Connecting you to an agent…\n\nAn agent will reply here shortly (Mon–Fri 8am–6pm, Sat 9am–1pm). For urgent claims call *${COMPANY.emergencyLine}*.\n\nType *done* anytime to return to the bot.`,
    });
  } else {
    replies.push({ text: `I didn't quite get that. Here's what I can do:` }, MAIN_MENU);
  }
}

function handleProducts(session, t, replies) {
  const keys = Object.keys(PRODUCTS);
  const idx = parseInt(t, 10) - 1;
  const key = keys.includes(t) ? t : idx >= 0 && idx < keys.length ? keys[idx] : null;
  if (key) {
    replies.push(productReply(key));
  } else if (t === 'quote') {
    session.state = 'QUOTE_PICK';
    replies.push(QUOTE_MENU);
  } else {
    session.state = 'MAIN_MENU';
    replies.push(MAIN_MENU);
  }
}

function handleQuotePick(session, t, replies) {
  const m = t.match(/^quote_(.+)$/);
  const key = m ? m[1] : PRODUCTS[t] ? t : Object.keys(PRODUCTS)[parseInt(t, 10) - 1];
  if (key && PRODUCTS[key]) {
    session.state = 'QUOTE_FORM';
    session.data = { product: key, answers: {}, fieldIdx: 0 };
    replies.push({
      text: `💰 *${PRODUCTS[key].name}* — quick quote.\n\n${PRODUCTS[key].fields[0].prompt}`,
    });
  } else {
    replies.push({ text: 'Please pick a product:', ...{}, }, QUOTE_MENU);
  }
}

function handleQuoteForm(session, input, replies) {
  const product = PRODUCTS[session.data.product];
  const field = product.fields[session.data.fieldIdx];

  if (!field.validate.test(input.trim())) {
    replies.push({ text: `⚠️ That doesn't look right. ${field.prompt}` });
    return;
  }
  session.data.answers[field.key] = input.trim();
  session.data.fieldIdx += 1;

  const next = product.fields[session.data.fieldIdx];
  if (next) {
    replies.push({ text: next.prompt });
    return;
  }

  const monthly = product.quote(session.data.answers);
  const quoteId = genId('QT');
  recordEvent('quote', { phone: session.phone, product: session.data.product, answers: session.data.answers, monthly, quoteId });

  session.state = 'MAIN_MENU';
  replies.push(
    {
      text: `✅ *Your ${product.name} estimate*\n\nQuote ref: *${quoteId}*\nEstimated premium: *$${monthly}/month*\n\n_Indicative only — final pricing after underwriting._`,
    },
    {
      text: 'What next?',
      buttons: [
        { id: 'menu_agent', title: 'Buy via agent' },
        { id: 'menu_quote', title: 'Another quote' },
        { id: 'menu_main', title: 'Main menu' },
      ],
    },
  );
}

function handleClaimMenu(session, t, replies) {
  if (t === 'claim_new' || t === '1' || t.includes('new') || t.includes('file')) {
    session.state = 'CLAIM_TYPE';
    replies.push(CLAIM_TYPE_MENU);
  } else if (t === 'claim_track' || t === '2' || t.includes('track') || t.includes('status')) {
    session.state = 'CLAIM_TRACK';
    replies.push({ text: 'Please enter your claim number (e.g. CLM-123456):' });
  } else {
    session.state = 'MAIN_MENU';
    replies.push(MAIN_MENU);
  }
}

function handleClaimType(session, t, replies) {
  const m = t.match(/^claimtype_(.+)$/);
  const key = m ? m[1] : CLAIM_TYPES[t] ? t : null;
  if (key && CLAIM_TYPES[key]) {
    session.state = 'CLAIM_FORM';
    session.data = { claimType: CLAIM_TYPES[key], claimAnswers: {}, claimFieldIdx: 0 };
    replies.push({ text: `🛠️ *${CLAIM_TYPES[key]}*\n\n${CLAIM_FIELDS[0].prompt}` });
  } else {
    replies.push(CLAIM_TYPE_MENU);
  }
}

function handleClaimForm(session, input, replies) {
  const field = CLAIM_FIELDS[session.data.claimFieldIdx];
  if (!field.validate.test(input.trim())) {
    replies.push({ text: `⚠️ That doesn't look right. ${field.prompt}` });
    return;
  }
  session.data.claimAnswers[field.key] = input.trim();
  session.data.claimFieldIdx += 1;

  const next = nextClaimField(session);
  if (next) {
    replies.push({ text: next.prompt });
    return;
  }

  const claimId = genId('CLM');
  recordEvent('claim', {
    phone: session.phone,
    type: session.data.claimType,
    ...session.data.claimAnswers,
    claimId,
  });

  session.state = 'MAIN_MENU';
  replies.push(
    {
      text: `✅ *Claim submitted*\n\nClaim number: *${claimId}*\nType: ${session.data.claimType}\nPolicy: ${session.data.claimAnswers.policy_number}\n\nA claims adjuster will contact you within 24–48h. For emergencies call *${COMPANY.emergencyLine}*.`,
    },
    {
      text: 'Keep your claim number safe.',
      buttons: [
        { id: 'claim_track', title: 'Track claim' },
        { id: 'menu_main', title: 'Main menu' },
      ],
    },
  );
}

function handleClaimTrack(session, input, replies) {
  const id = input.trim().toUpperCase();
  if (/^CLM-\d{6}$/.test(id)) {
    replies.push(
      { text: `🔍 Claim *${id}* — status: *Under review*.\n\nOur adjusters typically respond within 24–48h of filing.` },
      { text: 'Type *menu* for options or *agent* to speak to someone.' },
    );
    session.state = 'MAIN_MENU';
  } else {
    replies.push({ text: '⚠️ Please enter a valid claim number in the format CLM-123456 (or *menu* to go back).' });
  }
}

function handleFaq(session, input, replies) {
  const t = norm(input);
  if (t === 'agent' || t === 'human') {
    session.state = 'AGENT_QUEUE';
    session.handoff = true;
    recordEvent('handoff', { phone: session.phone });
    replies.push({ text: `👤 An agent will join shortly. Type *done* to return to the bot.` });
    return;
  }
  const answer = faqAnswer(input);
  replies.push(
    answer
      ? { text: answer }
      : { text: `I don't have an answer for that yet. Try rephrasing, or type *agent* for a human.` },
    { text: 'Another question? Or type *menu*.' },
  );
}

// Utility for tests / simulator: start a fresh conversation.
export function newSession(phone) {
  return resetSession(phone);
}
