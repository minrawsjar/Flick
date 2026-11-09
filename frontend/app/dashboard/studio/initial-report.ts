// The built-in Money Studio report, as AG Studio report state: Flick's own pages first (this week,
// what friends owe, what the agents did), then the PayPal account's revenue, receivables, cash and
// catalogue. Field ids ('flickPayments.amount') refer to the data sources in ./data.ts.

import type { AgPageState, AgReportState, AgWidgetLayoutState } from 'ag-studio';

// --- Helpers ----------------------------------------------------------------------

// Position on the canvas grid, in tracks: 24 columns wide, rows of studioCanvasRowHeight.
const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({
  xTrack,
  yTrack,
  xSpan,
  ySpan,
});
const title = (text: string) => ({ title: { enabled: true, text } });
const sum = (id: string) => ({ id, aggregation: 'sum' as const });
const avg = (id: string) => ({ id, aggregation: 'avg' as const });
const countd = (id: string) => ({ id, aggregation: 'countd' as const });

// Charts draw on canvas, so they need the font stack itself: --font-sans in app/globals.css.
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Helvetica Neue", Arial, sans-serif';

const typography = (fontSize: number, fontWeight: 'normal' | 'bold' = 'normal') => ({
  fontFamily: FONT,
  fontSize,
  fontWeight,
  fontStyle: 'normal' as const,
});

// A KPI tile, styled the same everywhere: bold title, large value, optional sparkline along `sparklineX`.
const kpi = (text: string, value: { id: string; aggregation?: 'sum' | 'avg' | 'countd' }, sparklineX?: string) => ({
  type: 'value' as const,
  dataMapping: {
    value: [value],
    ...(sparklineX && { sparklineX: [{ id: sparklineX }] }),
  },
  format: {
    title: { enabled: true, text, typography: typography(14, 'bold') },
    caption: { enabled: true, text: '', typography: typography(0) },
    style: { typography: typography(22) },
  },
});

// --- Flick's pages -----------------------------------------------------------------

const week: AgPageState = {
  id: 'week',
  widgets: {
    'kpi-planned': kpi('This week', sum('flickPayments.amount')),
    'kpi-paid': kpi('Paid so far', sum('flickPayments.paid')),
    'kpi-to-pay': kpi('Still to pay', sum('flickPayments.toPay')),
    'kpi-owed': kpi('Owed to you', sum('flickRequests.outstanding')),
    'by-day': {
      type: 'column-chart-stacked',
      dataMapping: {
        categoryKey: [{ id: 'flickPayments.date' }],
        valueKey: [sum('flickPayments.amount')],
        legendKey: [{ id: 'flickPayments.status' }],
      },
      format: {
        ...title("This week's payments by day"),
        style: { theme: { common: { legend: { enabled: true } } } },
      },
    },
    'where-it-goes': {
      type: 'donut-chart',
      dataMapping: {
        categoryKey: [{ id: 'flickHistory.payee' }],
        valueKey: [sum('flickHistory.amount')],
      },
      format: {
        ...title('Where the money went, past weeks'),
        style: { custom: { pieDataLabel: { enabled: true }, totalLabel: { enabled: true } } },
      },
    },
    plan: {
      type: 'grid',
      dataMapping: {
        cols: [
          { id: 'flickPayments.date' },
          { id: 'flickPayments.payee' },
          { id: 'flickPayments.what' },
          { id: 'flickPayments.status' },
          sum('flickPayments.amount'),
          { id: 'flickPayments.reason' },
        ],
      },
      sort: [{ field: { id: 'flickPayments.date' }, direction: 'asc' }],
      format: title("Autopilot's plan, and why"),
    },
  },
  widgetLayout: {
    'kpi-planned': at(0, 0, 6, 7),
    'kpi-paid': at(6, 0, 6, 7),
    'kpi-to-pay': at(12, 0, 6, 7),
    'kpi-owed': at(18, 0, 6, 7),
    'by-day': at(0, 7, 15, 17),
    'where-it-goes': at(15, 7, 9, 17),
    plan: at(0, 24, 24, 22),
  },
};

const owed: AgPageState = {
  id: 'owed',
  widgets: {
    'kpi-owed': kpi('Still owed to you', sum('flickRequests.outstanding')),
    'kpi-repaid': kpi('Paid back', sum('flickRequests.repaid')),
    'kpi-reminders': kpi('Reminders sent', sum('flickRequests.reminders')),
    'by-friend': {
      type: 'column-chart-stacked',
      dataMapping: {
        categoryKey: [{ id: 'flickRequests.friend' }],
        valueKey: [sum('flickRequests.amount')],
        legendKey: [{ id: 'flickRequests.status' }],
      },
      format: {
        ...title('Requested from each friend'),
        style: { theme: { common: { legend: { enabled: true } } } },
      },
    },
    requests: {
      type: 'grid',
      dataMapping: {
        cols: [
          { id: 'flickRequests.friend' },
          { id: 'flickRequests.what' },
          { id: 'flickRequests.requested' },
          { id: 'flickRequests.status' },
          sum('flickRequests.reminders'),
          sum('flickRequests.amount'),
        ],
      },
      sort: [{ field: { id: 'flickRequests.requested' }, direction: 'desc' }],
      format: title('Requests, as PayPal invoices'),
    },
  },
  widgetLayout: {
    'kpi-owed': at(0, 0, 8, 7),
    'kpi-repaid': at(8, 0, 8, 7),
    'kpi-reminders': at(16, 0, 8, 7),
    'by-friend': at(0, 7, 10, 18),
    requests: at(10, 7, 14, 18),
  },
};

const agents: AgPageState = {
  id: 'agents',
  widgets: {
    'by-agent': {
      type: 'donut-chart',
      dataMapping: {
        categoryKey: [{ id: 'flickActivity.agent' }],
        valueKey: [countd('flickActivity.id')],
      },
      format: {
        ...title('What each agent did'),
        style: { custom: { pieDataLabel: { enabled: true }, totalLabel: { enabled: true } } },
      },
    },
    log: {
      type: 'grid',
      dataMapping: {
        cols: [{ id: 'flickActivity.date' }, { id: 'flickActivity.agent' }, { id: 'flickActivity.text' }, sum('flickActivity.amount')],
      },
      sort: [{ field: { id: 'flickActivity.date' }, direction: 'desc' }],
      format: title('Activity'),
    },
  },
  widgetLayout: {
    'by-agent': at(0, 0, 8, 20),
    log: at(8, 0, 16, 20),
  },
};

// --- PayPal's pages -------------------------------------------------------------------

const revenue: AgPageState = {
  id: 'revenue',
  widgets: {
    'invoice-date': {
      type: 'date-filter',
      dataMapping: { value: [{ id: 'invoices.invoiceDate' }] },
      // No default period: a relative date filter in saved state fails to apply on load in
      // Studio 3.0 ("must be a two-element range"), though it works once picked in the widget.
      format: { style: { filterType: 'relative' } },
    },
    'kpi-invoiced': kpi(
      'Invoiced',
      sum('invoices.issuedAmount'),
      'calendar::month',
    ),
    'kpi-collected': kpi(
      'Collected',
      sum('invoices.paidAmount'),
      'calendar::month',
    ),
    'kpi-outstanding': kpi(
      'Outstanding',
      sum('invoices.outstanding'),
      'invoices.outstanding',
    ),
    'kpi-overdue': kpi(
      'Overdue',
      sum('invoices.overdueAmount'),
      'invoices.overdueAmount',
    ),
    'billed-vs-collected': {
      type: 'combo-chart-grouped-column-line',
      dataMapping: {
        categoryKey: [{ id: 'calendar::month' }],
        valueKey: [sum('invoices.issuedAmount'), sum('invoices.paidAmount')],
        secondaryValueKey: [{ id: 'collectionRate' }],
      },
      format: {
        ...title('Invoiced and paid by invoice month, with collection rate'),
        style: { theme: { common: { legend: { enabled: true } } } },
      },
    },
    'collection-rate': {
      type: 'radial-gauge',
      dataMapping: { value: [{ id: 'collectionRate' }] },
      format: {
        ...title('Collection rate'),
        style: {
          scaleLabel: { min: 0, max: 1 },
          label: { typography: typography(24, 'bold') },
          secondaryLabel: {
            enabled: true,
            text: 'of invoiced value paid',
            typography: typography(12),
          },
        },
      },
    },
    'status-sunburst': {
      type: 'sunburst-chart',
      dataMapping: {
        categoryKey: [
          { id: 'invoices.statusGroup' },
          { id: 'customers.company' },
        ],
        valueKey: [sum('invoices.total')],
      },
      format: title('Invoice value by status and customer'),
    },
    'items-treemap': {
      type: 'treemap-chart',
      dataMapping: {
        categoryKey: [{ id: 'invoiceItems.unit' }, { id: 'invoiceItems.name' }],
        valueKey: [sum('invoiceItems.lineTotal')],
      },
      format: title('Billing by unit'),
    },
    'payment-methods': {
      type: 'nightingale-chart',
      dataMapping: {
        categoryKey: [{ id: 'invoicePayments.method' }],
        valueKey: [sum('invoicePayments.amount')],
      },
      format: {
        ...title('Payments by method'),
        style: {
          theme: {
            nightingale: {
              series: { label: { enabled: true, ...typography(2) } },
            },
          },
        },
      },
    },
    'invoice-status-pivot': {
      type: 'pivot-grid',
      dataMapping: {
        rows: [{ id: 'customers.company' }, { id: 'invoices.number' }],
        columns: [{ id: 'invoices.status' }],
        values: [sum('invoices.total')],
      },
      format: {
        style: {
          totalColumns: true,
          totalColumnsPlacement: 'before',
          grandTotalRow: { enabled: true },
        },
      },
    },
  },
  widgetLayout: {
    'kpi-invoiced': at(0, 0, 4, 7),
    'kpi-collected': at(4, 0, 4, 7),
    'kpi-outstanding': at(8, 0, 4, 7),
    'kpi-overdue': at(12, 0, 4, 7),
    'invoice-date': at(16, 0, 8, 7),
    'billed-vs-collected': at(0, 7, 16, 16),
    'collection-rate': at(16, 7, 8, 16),
    'status-sunburst': at(0, 23, 8, 18),
    'items-treemap': at(8, 23, 8, 18),
    'payment-methods': at(16, 23, 8, 18),
    'invoice-status-pivot': at(0, 41, 24, 20),
  },
};

const receivables: AgPageState = {
  id: 'receivables',
  widgets: {
    // Invoice money isn't converted between currencies, so this page is driven by a
    // single-select currency switch, starting on USD (see the page filter below).
    currency: {
      type: 'button-filter',
      dataMapping: { value: [{ id: 'invoices.currency' }] },
      format: {
        ...title('Currency'),
        style: {
          selection: { type: 'single' },
          dimensions: { height: 28, minWidth: 48 },
        },
      },
    },
    'kpi-outstanding': kpi('Outstanding', sum('invoices.outstanding')),
    'kpi-overdue': kpi('Overdue', sum('invoices.overdueAmount')),
    'kpi-open': kpi('Open invoices', countd('invoices.id')),
    'overdue-share': {
      type: 'radial-gauge',
      dataMapping: { value: [{ id: 'overdueShare' }] },
      format: {
        ...title('Overdue share'),
        style: {
          label: { typography: typography(24) },
          secondaryLabel: { enabled: true, text: 'of receivables past due' },
          scaleLabel: { min: 0, max: 1, typography: typography(11) },
        },
      },
    },
    aging: {
      type: 'column-chart-stacked',
      dataMapping: {
        categoryKey: [{ id: 'customers.name' }],
        valueKey: [sum('invoices.total')],
        legendKey: [{ id: 'invoices.status' }],
      },
      format: {
        ...title('Receivables aging by customer'),
        style: { theme: { common: { legend: { enabled: true } } } },
      },
    },
    'open-invoices': {
      type: 'grid',
      dataMapping: {
        cols: [
          { id: 'invoices.number' },
          { id: 'customers.name' },
          { id: 'customers.company' },
          { id: 'invoices.statusGroup' },
          { id: 'invoices.dueDate' },
          { id: 'invoices.daysOverdue' },
          sum('invoices.total'),
          sum('invoices.paidAmount'),
          sum('invoices.outstanding'),
        ],
      },
      sort: [{ field: { id: 'invoices.daysOverdue' }, direction: 'desc' }],
      format: title('Open invoices, most overdue first'),
    },
  },
  widgetLayout: {
    'kpi-outstanding': at(0, 0, 6, 7),
    'kpi-overdue': at(6, 0, 6, 7),
    'kpi-open': at(12, 0, 6, 7),
    currency: at(18, 0, 6, 7),
    aging: at(0, 7, 16, 18),
    'overdue-share': at(16, 7, 8, 18),
    'open-invoices': at(0, 25, 24, 20),
  },
  filter: {
    page: [
      {
        field: { id: 'invoices.currency' },
        model: { operator: 'isIn', value: ['USD'] },
        filterWidgetId: 'currency',
      },
      { field: { id: 'invoices.isReceivable' }, model: { operator: 'isTrue' } },
    ],
  },
};

const cash: AgPageState = {
  id: 'cash',
  widgets: {
    'kpi-balance': kpi('Available balance', sum('balances.available')),
    'kpi-paid-out': kpi('Paid out (31 days)', sum('payouts.amount')),
    'kpi-fees': kpi('Payout fees', sum('payouts.fee')),
    'kpi-recipients': kpi('Recipients', countd('payouts.recipient')),
    'payout-treemap': {
      type: 'treemap-chart',
      dataMapping: {
        // Payouts aren't related to customers, so recipient (not company) is the second level.
        categoryKey: [{ id: 'payouts.campaign' }, { id: 'payouts.recipient' }],
        valueKey: [sum('payouts.amount')],
      },
      format: title('Payouts by campaign and recipient'),
    },
    'campaign-donut': {
      type: 'donut-chart',
      dataMapping: {
        categoryKey: [{ id: 'payouts.campaign' }],
        valueKey: [sum('payouts.amount')],
      },
      format: {
        ...title('Payout share by campaign'),
        style: {
          custom: {
            pieDataLabel: { enabled: true },
            totalLabel: { enabled: true },
          },
        },
      },
    },
    ledger: {
      type: 'grid',
      dataMapping: {
        cols: [
          { id: 'transactions.date' },
          { id: 'transactions.eventType' },
          { id: 'transactions.status' },
          { id: 'transactions.counterparty' },
          { id: 'transactions.note' },
          sum('transactions.amount'),
          sum('transactions.fee'),
          sum('transactions.net'),
        ],
      },
      sort: [{ field: { id: 'transactions.date' }, direction: 'desc' }],
      format: title('Ledger'),
    },
  },
  widgetLayout: {
    'kpi-balance': at(0, 0, 6, 7),
    'kpi-paid-out': at(6, 0, 6, 7),
    'kpi-fees': at(12, 0, 6, 7),
    'kpi-recipients': at(18, 0, 6, 7),
    'payout-treemap': at(0, 7, 15, 18),
    'campaign-donut': at(15, 7, 9, 18),
    ledger: at(0, 25, 24, 30),
  },
};

const catalogue: AgPageState = {
  id: 'catalogue',
  widgets: {
    'kpi-products': kpi('Products', countd('products.id')),
    'kpi-plans': kpi('Billing plans', countd('plans.id')),
    'kpi-monthly': kpi('Avg monthly price', avg('plans.monthlyPrice')),
    'kpi-trial': kpi('Avg trial days', avg('plans.trialDays')),
    'catalogue-sunburst': {
      type: 'sunburst-chart',
      dataMapping: {
        categoryKey: [
          { id: 'products.type' },
          { id: 'products.name' },
          { id: 'plans.name' },
        ],
        valueKey: [sum('plans.monthlyPrice')],
      },
      format: title(
        'Catalogue: type, product and plan (sized by monthly price)',
      ),
    },
    'price-range': {
      type: 'bar-chart-grouped',
      dataMapping: {
        categoryKey: [{ id: 'products.name' }],
        valueKey: [
          { id: 'plans.monthlyPrice', aggregation: 'min' },
          avg('plans.monthlyPrice'),
          { id: 'plans.monthlyPrice', aggregation: 'max' },
        ],
      },
      format: {
        ...title('Monthly-normalised price range by product'),
        style: {
          theme: { common: { legend: { enabled: true, position: 'right' } } },
        },
      },
    },
    'plan-intervals': {
      type: 'donut-chart',
      dataMapping: {
        categoryKey: [{ id: 'plans.billingInterval' }],
        valueKey: [countd('plans.id')],
      },
      format: {
        ...title('Plans by billing interval'),
        style: {
          custom: {
            pieDataLabel: { enabled: true },
            totalLabel: { enabled: false },
          },
        },
      },
    },
    plans: {
      type: 'grid',
      dataMapping: {
        cols: [
          { id: 'products.name' },
          { id: 'plans.name' },
          { id: 'plans.status' },
          { id: 'plans.billingInterval' },
          sum('plans.price'),
          sum('plans.monthlyPrice'),
          sum('plans.trialDays'),
          sum('plans.setupFee'),
        ],
      },
      sort: [{ field: sum('plans.monthlyPrice'), direction: 'desc' }],
      format: title('Plan catalogue'),
    },
  },
  widgetLayout: {
    'kpi-products': at(0, 0, 6, 7),
    'kpi-plans': at(6, 0, 6, 7),
    'kpi-monthly': at(12, 0, 6, 7),
    'kpi-trial': at(18, 0, 6, 7),
    'plan-intervals': at(0, 7, 10, 20),
    'price-range': at(10, 7, 14, 20),
    plans: at(0, 27, 16, 24),
    'catalogue-sunburst': at(16, 27, 8, 24),
  },
};
// The report opens on its first page.
export const dashboardReport: AgReportState = {
  selectedPageId: week.id,
  pages: [week, owed, agents, revenue, receivables, cash, catalogue],
};
