// CLI simulator — chat with the bot locally, no WhatsApp needed.
// Usage: npm run simulate

import 'dotenv/config';
import readline from 'node:readline';
import { handleMessage } from './bot.js';

const PHONE = 'simulator-user';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'You> ' });

function render(reply) {
  if (reply.buttons) {
    console.log(`Bot> ${reply.text}`);
    reply.buttons.forEach((b, i) => console.log(`     [${i + 1}] ${b.title}   (id: ${b.id})`));
  } else if (reply.list) {
    console.log(`Bot> ${reply.text}`);
    reply.list.sections.forEach((s) => {
      console.log(`     — ${s.title} —`);
      s.rows.forEach((r) => console.log(`     • ${r.title}${r.description ? ` — ${r.description}` : ''}   (id: ${r.id})`));
    });
  } else {
    console.log(`Bot> ${reply.text}`);
  }
}

console.log('=== JC Insurance Bot Simulator ===');
console.log('Type messages as if you were on WhatsApp. Ctrl+C to quit.');
console.log('Tip: you can type list/button ids like "menu_quote" or tap keywords.\n');

const { replies } = handleMessage(PHONE, 'hi');
replies.forEach(render);
rl.prompt();

rl.on('line', (line) => {
  const { replies } = handleMessage(PHONE, line);
  replies.forEach(render);
  rl.prompt();
});
