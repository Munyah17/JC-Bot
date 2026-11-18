// Insurance product catalogue, pricing rules and FAQs.
// Edit this file to customize offerings — the bot engine reads from here.

export const PRODUCTS = {
  auto: {
    name: 'Auto Insurance',
    emoji: '🚗',
    baseMonthly: 49,
    description: 'Comprehensive cover for your vehicle: accidents, theft, third-party liability.',
    fields: [
      { key: 'vehicle_year', prompt: 'What year is your vehicle? (e.g. 2019)', validate: /^(19|20)\d{2}$/ },
      { key: 'vehicle_value', prompt: 'Estimated vehicle value in USD? (numbers only)', validate: /^\d+(\.\d+)?$/ },
      { key: 'driver_age', prompt: 'Age of the primary driver?', validate: /^(1[7-9]|[2-9]\d)$/ },
    ],
    quote: (a) => {
      const value = Number(a.vehicle_value) || 20000;
      const age = Number(a.driver_age) || 30;
      let premium = PRODUCTS.auto.baseMonthly + value * 0.0012;
      if (age < 25) premium *= 1.4;
      else if (age > 65) premium *= 1.15;
      return Math.round(premium);
    },
  },
  health: {
    name: 'Health Insurance',
    emoji: '🏥',
    baseMonthly: 89,
    description: 'Medical cover including hospitalization, outpatient care and prescriptions.',
    fields: [
      { key: 'age', prompt: 'Your age?', validate: /^(\d{1,2}|1[0-1]\d)$/ },
      { key: 'members', prompt: 'How many people to cover (1-8)?', validate: /^[1-8]$/ },
      { key: 'smoker', prompt: 'Any smokers on the plan? (yes/no)', validate: /^(yes|no|y|n)$/i },
    ],
    quote: (a) => {
      const age = Number(a.age) || 30;
      const members = Number(a.members) || 1;
      let premium = PRODUCTS.health.baseMonthly * members;
      if (age > 50) premium *= 1.5;
      else if (age > 35) premium *= 1.25;
      if (/^y/i.test(a.smoker)) premium *= 1.3;
      return Math.round(premium);
    },
  },
  home: {
    name: 'Home Insurance',
    emoji: '🏠',
    baseMonthly: 39,
    description: 'Protect your home and belongings against fire, theft and natural disasters.',
    fields: [
      { key: 'property_value', prompt: 'Estimated property value in USD? (numbers only)', validate: /^\d+(\.\d+)?$/ },
      { key: 'property_type', prompt: 'Property type? (house / apartment / condo)', validate: /^(house|apartment|condo)$/i },
      { key: 'security', prompt: 'Do you have a security system? (yes/no)', validate: /^(yes|no|y|n)$/i },
    ],
    quote: (a) => {
      const value = Number(a.property_value) || 150000;
      let premium = PRODUCTS.home.baseMonthly + value * 0.00015;
      if (/^house$/i.test(a.property_type)) premium *= 1.15;
      if (/^y/i.test(a.security)) premium *= 0.9;
      return Math.round(premium);
    },
  },
  life: {
    name: 'Life Insurance',
    emoji: '❤️',
    baseMonthly: 25,
    description: 'Term life cover that protects your family financially.',
    fields: [
      { key: 'age', prompt: 'Your age?', validate: /^(1[8-9]|[2-7]\d)$/ },
      { key: 'coverage', prompt: 'Desired coverage amount in USD? (e.g. 250000)', validate: /^\d+$/ },
      { key: 'smoker', prompt: 'Do you smoke? (yes/no)', validate: /^(yes|no|y|n)$/i },
    ],
    quote: (a) => {
      const age = Number(a.age) || 30;
      const coverage = Number(a.coverage) || 100000;
      let premium = PRODUCTS.life.baseMonthly + coverage * 0.00008;
      if (age > 50) premium *= 2.2;
      else if (age > 40) premium *= 1.5;
      if (/^y/i.test(a.smoker)) premium *= 1.6;
      return Math.round(premium);
    },
  },
};

export const CLAIM_TYPES = {
  auto: 'Vehicle accident / damage',
  health: 'Medical / hospitalization',
  home: 'Property damage / theft',
  life: 'Life benefit claim',
  other: 'Other',
};

export const FAQS = [
  {
    keywords: ['claim status', 'track claim', 'claim progress'],
    answer: 'You can track a claim by choosing "File / Track a Claim" from the main menu, then "Track existing claim", and entering your claim number (e.g. CLM-123456).',
  },
  {
    keywords: ['payment', 'pay', 'premium', 'billing'],
    answer: 'Premiums are billed monthly. You can pay via bank transfer, debit card or mobile money. Payment links are sent on your billing date.',
  },
  {
    keywords: ['cancel', 'cancellation', 'terminate'],
    answer: 'You can cancel your policy anytime with 30 days notice. Unused premiums are refunded pro-rata. Speak to an agent to process a cancellation.',
  },
  {
    keywords: ['document', 'documents', 'required', 'paperwork'],
    answer: 'For most policies you need: a valid ID, proof of address, and item-specific docs (vehicle registration for auto, deed/lease for home).',
  },
  {
    keywords: ['hours', 'open', 'closing', 'working'],
    answer: 'Our agents are available Mon–Fri 8am–6pm and Sat 9am–1pm. This bot is available 24/7.',
  },
  {
    keywords: ['contact', 'phone', 'email', 'address', 'office', 'location'],
    answer: 'Reach us at 1-800-JC-INSURE, support@jcinsurance.example, or visit 12 Assurance Ave, Suite 400.',
  },
  {
    keywords: ['coverage', 'cover', 'what does', 'include'],
    answer: 'Coverage depends on the product. Choose "Our Products" from the menu for details, or "Get a Quote" for a personalized estimate.',
  },
];

export const COMPANY = {
  name: 'JC Insurance',
  tagline: 'Protection made simple.',
  emergencyLine: '1-800-JC-CLAIM',
};
