import { addDays, mondayOf, ymd, type Past, type State } from './model.ts';
import { planWeek } from './rules.ts';

// The demo's starting point, built around the current week so it always looks fresh. Four weeks of
// history give Autopilot its habits; with a monthly phone plan and a bill Lens read, this week's plan
// comes out the same as the one-pager's: six payments, $142.30. Three months of bills set what's
// usual, so this month's electricity, 27% above it, is the one payment Autopilot flags.
//
// The emails are placeholders. To see money arrive, swap in your PayPal sandbox accounts' emails
// (developer.paypal.com → Testing tools → Sandbox accounts). Payouts to an address with no
// account still succeed in the sandbox, as "unclaimed".

/** A new visitor's workspace: nothing yet. The pages show their samples until there's something of theirs. */
export function blank(now = new Date()): State {
  return { payees: [], friends: [], history: [], monthly: [], scans: [], week: { starts: mondayOf(now), today: -1, payments: [] }, debts: [], checkouts: {}, activity: [], scout: { purchases: [] } };
}

export function seed(now = new Date()): State {
  const starts = mondayOf(now);
  const day = (offset: number) => addDays(starts, offset);

  const history: Past[] = [];
  const groceries = [38.5, 36.2, 41.1, 38.2];
  for (let week = 1; week <= 4; week++) {
    const w = -7 * week;
    history.push({ payeeId: 'maya', what: 'Pilates, your half', amount: 9, date: day(w + 3) });
    if (week !== 3) history.push({ payeeId: 'bean-there', what: 'Friday tip', amount: 2, date: day(w + 4) });
    history.push({ payeeId: 'corner-grocery', what: 'Groceries', amount: groceries[week - 1], date: day(w + 5) });
    history.push({ payeeId: 'leo', what: 'Five-a-side pitch', amount: 3.6, date: day(w + 6) });
  }
  const power = [51.8, 49.4, 50.2];
  for (let month = 1; month <= 3; month++) {
    history.push({ payeeId: 'mobile-co', what: 'Phone plan', amount: 25, date: monthsBack(day(3), month) });
    history.push({ payeeId: 'city-power', what: 'Electricity', amount: power[month - 1], date: monthsBack(day(2), month) });
  }

  const state: State = {
    payees: [
      { id: 'city-power', name: 'City Power', email: 'billing@citypower.example.com', icon: 'power' },
      { id: 'mobile-co', name: 'Mobile Co', email: 'pay@mobileco.example.com', icon: 'phone' },
      { id: 'bean-there', name: 'Bean There', email: 'tips@beanthere.example.com', icon: 'coffee' },
      { id: 'corner-grocery', name: 'Corner Grocery', email: 'shop@cornergrocery.example.com', icon: 'cart' },
      { id: 'maya', name: 'Maya', email: 'maya@flick.example.com', icon: 'friend' },
      { id: 'leo', name: 'Leo', email: 'leo@flick.example.com', icon: 'friend' },
    ],
    friends: [
      { id: 'maya', name: 'Maya', email: 'maya@flick.example.com', color: 'violet', shape: 'hexagon' },
      { id: 'leo', name: 'Leo', email: 'leo@flick.example.com', color: 'orange', shape: 'drop' },
      { id: 'priya', name: 'Priya', email: 'priya@flick.example.com', color: 'blue', shape: 'squircle' },
    ],
    history,
    monthly: [{ payeeId: 'mobile-co', what: 'Phone plan', amount: 25, dayOfMonth: Number(day(3).slice(8)), since: day(-90) }],
    scans: [
      {
        id: 'scan_seed',
        at: `${day(-6)}T18:20:00.000Z`,
        kind: 'bill',
        title: 'City Power',
        summary: 'Electricity',
        amount: 64.2,
        currency: 'USD',
        due: day(2),
        repeats: 'monthly',
        handle: null,
        items: [],
        tax: 0,
        tip: 0,
        fields: [
          ['kind', 'bill'],
          ['payee', 'City Power'],
          ['account', '•••• 4821'],
          ['amount', '64.20 USD'],
          ['due', day(2)],
          ['repeats', 'monthly'],
        ],
        status: 'read',
        payeeId: 'city-power',
      },
    ],
    week: { starts, today: -1, payments: [] },
    debts: [
      { id: 'debt_leo', friendId: 'leo', amount: 27, what: 'the airport cab', createdAt: `${day(-13)}T09:00:00.000Z`, status: 'requested', reminders: 0 },
      { id: 'debt_maya', friendId: 'maya', amount: 18.4, what: 'movie night', createdAt: `${day(-7)}T21:00:00.000Z`, status: 'requested', reminders: 0 },
    ],
    checkouts: {},
    activity: [
      { id: 'act_seed5', at: `${day(-1)}T18:05:00.000Z`, agent: 'autopilot', text: 'Paid Leo: Five-a-side pitch', amount: 3.6 },
      { id: 'act_seed4', at: `${day(-2)}T10:30:00.000Z`, agent: 'autopilot', text: 'Paid Corner Grocery: Groceries', amount: 38.5 },
      { id: 'act_seed3', at: `${day(-6)}T18:20:00.000Z`, agent: 'lens', text: 'Read a bill: City Power, $64.20', amount: 64.2 },
      { id: 'act_seed2', at: `${day(-7)}T21:10:00.000Z`, agent: 'splitter', text: 'Split movie night and asked Maya for $18.40', amount: 18.4 },
      { id: 'act_seed1', at: `${day(-13)}T09:00:00.000Z`, agent: 'splitter', text: 'Split the airport cab and asked Leo for $27.00', amount: 27 },
    ],
  };
  state.week.payments = planWeek(starts, state);
  return state;
}

/** The same day of the month, `n` months earlier: the month's last day if it's shorter. */
function monthsBack(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - n, 0)).getUTCDate();
  return ymd(new Date(Date.UTC(y, m - 1 - n, Math.min(d, last))));
}
