import type { Face } from "@/components/ui";

// The demo's cast and content. Mock data for now: the same shapes the backend will serve once
// Lens (vision), Autopilot and the PayPal calls are wired up.

export const agents = {
  lens: { name: "Lens", color: "cyan", shape: "circle" },
  autopilot: { name: "Autopilot", color: "green", shape: "drop" },
  splitter: { name: "Splitter", color: "yellow", shape: "squircle" },
  nudge: { name: "Nudge", color: "pink", shape: "capsule" },
} as const satisfies Record<string, Face & { name: string }>;

export type Friend = Face & { id: "you" | "maya" | "leo" | "priya"; name: string };

export const you: Friend = { id: "you", name: "You", color: "red", shape: "circle" };
export const friends: Friend[] = [
  { id: "maya", name: "Maya", color: "violet", shape: "hexagon" },
  { id: "leo", name: "Leo", color: "orange", shape: "drop" },
  { id: "priya", name: "Priya", color: "blue", shape: "squircle" },
];

// --- Lens: things you can snap ------------------------------------------------------

export type SampleKind = "bill" | "receipt" | "tag" | "tip";
type Step = readonly [code: string, what: string];

export type Sample = {
  kind: SampleKind;
  /** On the shelf of samples. */
  label: string;
  /** What Lens says it read. */
  heard: string;
  title: string;
  sub: string;
  amount: number;
  /** The structured read, as Lens's model returns it. */
  fields: readonly (readonly [string, string])[];
  action: string;
  done: string;
  /** The PayPal REST calls the action makes. */
  wire: readonly Step[];
};

const order = (amount: string, to: string): Step[] => [
  ["POST /v2/checkout/orders", `An order for ${amount} to ${to}`],
  ["Approve in PayPal", "One tap. No card details shared"],
  ["POST /v2/checkout/orders/{id}/capture", "The money moves"],
  ["COMPLETED", "Receipt saved to Money Studio"],
];

export const samples: Sample[] = [
  {
    kind: "bill",
    label: "Electricity bill",
    heard: "a bill",
    title: "City Power",
    sub: "Electricity · due Wed, Nov 11",
    amount: 64.2,
    fields: [
      ["kind", "bill"],
      ["payee", "City Power"],
      ["account", "•••• 4821"],
      ["amount", "64.20 USD"],
      ["due", "2026-11-11"],
      ["repeats", "monthly"],
    ],
    action: "Pay $64.20 with PayPal",
    done: "Paid. Autopilot pays it every month now",
    wire: order("$64.20", "City Power"),
  },
  {
    kind: "receipt",
    label: "Dinner receipt",
    heard: "a receipt",
    title: "Nori Sushi",
    sub: "6 items · with tax and tip",
    amount: 86.28,
    fields: [
      ["kind", "receipt"],
      ["merchant", "Nori Sushi"],
      ["items", "6"],
      ["subtotal", "68.00 USD"],
      ["tax", "6.04 USD"],
      ["total", "86.28 USD (18% tip)"],
    ],
    action: "Split with 3 friends",
    done: "Requests sent to Maya, Leo and Priya",
    wire: [
      ["POST /v2/invoicing/invoices", "One request per friend, for their share"],
      ["POST /v2/invoicing/invoices/{id}/send", "Each friend gets a PayPal email"],
      ["Friend pays", "With PayPal or a card"],
      ["PAID", "Nudge stops following up"],
    ],
  },
  {
    kind: "tag",
    label: "Price tag",
    heard: "a price tag",
    title: "Trail runners",
    sub: "Stride Co · size 10 · in stock",
    amount: 89,
    fields: [
      ["kind", "product"],
      ["item", "Trail runners"],
      ["seller", "Stride Co"],
      ["size", "10"],
      ["price", "89.00 USD"],
      ["stock", "in stock online"],
    ],
    action: "Buy with PayPal · $89.00",
    done: "Ordered. Arrives Thursday",
    wire: order("$89.00", "Stride Co"),
  },
  {
    kind: "tip",
    label: "Tip jar",
    heard: "a tip jar",
    title: "Bean There Café",
    sub: "Tip jar · @beanthere",
    amount: 5,
    fields: [
      ["kind", "tip"],
      ["to", "Bean There Café"],
      ["paypal", "@beanthere"],
      ["suggested", "2 · 5 · 10 USD"],
      ["amount", "5.00 USD"],
      ["note", "Thanks for the flat white"],
    ],
    action: "Tip $5.00",
    done: "Tipped. Bean There says thanks",
    wire: [
      ["POST /v1/payments/payouts", "$5.00 to @beanthere"],
      ["Batch PENDING", "PayPal checks the recipient"],
      ["Item SUCCESS", "It lands in their PayPal balance"],
      ["Learned", "Fridays at Bean There, tip $5"],
    ],
  },
];

// --- Autopilot: this week's plan ------------------------------------------------------

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];
export const WEEKLY_CAP = 200;

export type PayeeIcon = "power" | "phone" | "friend" | "coffee" | "cart" | "ball";

export type Planned = {
  id: string;
  payee: string;
  what: string;
  icon: PayeeIcon;
  amount: number;
  day: Day;
  /** Autopilot's reason, from what it has seen you pay. */
  why: string;
};

export const week: Planned[] = [
  { id: "power", payee: "City Power", what: "Electricity", icon: "power", amount: 64.2, day: "Wed", why: "You snapped this bill on Nov 3. It's due Wednesday, Nov 11." },
  { id: "mobile", payee: "Mobile Co", what: "Phone plan", icon: "phone", amount: 25, day: "Thu", why: "Same amount on the 12th, every month." },
  { id: "pilates", payee: "Maya", what: "Pilates, your half", icon: "friend", amount: 9, day: "Thu", why: "You've split this with Maya four Thursdays running." },
  { id: "coffee", payee: "Bean There", what: "Friday tip", icon: "coffee", amount: 2, day: "Fri", why: "You tip here most Fridays." },
  { id: "grocery", payee: "Corner Grocery", what: "Groceries", icon: "cart", amount: 38.5, day: "Sat", why: "Your Saturday shop averages $38.50." },
  { id: "pitch", payee: "Leo", what: "Five-a-side pitch", icon: "ball", amount: 3.6, day: "Sun", why: "Sunday football, split six ways." },
];

// --- Splitter: the dinner receipt -------------------------------------------------------

export const TAX = 0.08875;
export const TIP = 0.18;

export type Item = { id: string; name: string; price: number } & Record<Friend["id"], boolean>;

export const receipt: Item[] = [
  { id: "salmon", name: "Salmon roll", price: 14, you: true, maya: true, leo: false, priya: false },
  { id: "dragon", name: "Dragon roll", price: 16.5, you: false, maya: false, leo: true, priya: true },
  { id: "gyoza", name: "Gyoza", price: 8.5, you: true, maya: true, leo: true, priya: true },
  { id: "edamame", name: "Edamame", price: 6, you: true, maya: true, leo: true, priya: true },
  { id: "miso", name: "Miso soup ×2", price: 7, you: true, maya: false, leo: true, priya: false },
  { id: "tea", name: "Green tea ×4", price: 16, you: true, maya: true, leo: true, priya: true },
];

// --- Nudge: who owes you ---------------------------------------------------------------

export const TONES = ["Friendly", "Funny", "Straight"] as const;
export type Tone = (typeof TONES)[number];

export type Owed = { friend: Friend; amount: number; what: string; days: number; drafts: Record<Tone, string> };

export const owed: Owed[] = [
  {
    friend: friends[1],
    amount: 27,
    what: "the airport cab",
    days: 12,
    drafts: {
      Friendly: "Hey Leo, hope the trip was good! Your half of the airport cab was $27.00. Link's below, no rush.",
      Funny: "Leo, the cab driver sends his regards. Your half was $27.00, whenever you're back on earth.",
      Straight: "Hi Leo, $27.00 for the airport cab has been open 12 days. Here's the PayPal link.",
    },
  },
  {
    friend: friends[0],
    amount: 18.4,
    what: "movie night",
    days: 6,
    drafts: {
      Friendly: "Hey Maya! Whenever you get a sec, it's $18.40 for movie night. Link's below.",
      Funny: "Maya, the popcorn is long gone but the $18.40 lives on. Settle up whenever.",
      Straight: "Hi Maya, $18.40 for movie night is still open. Here's the PayPal link.",
    },
  },
  {
    friend: friends[2],
    amount: 20.14,
    what: "Nori Sushi",
    days: 2,
    drafts: {
      Friendly: "Hi Priya! Your share of Nori Sushi came to $20.14. Thanks for a great dinner.",
      Funny: "Priya, the dragon roll was worth every cent. Specifically $20.14 of them.",
      Straight: "Hi Priya, your share of Nori Sushi is $20.14. Here's the PayPal link.",
    },
  },
];
