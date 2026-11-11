'use client';

import type { AgWidgetsConfig } from 'ag-studio';
import type { AgWidgetDefinition } from 'ag-studio-react';
import { WeekTimelineWidget } from './WeekTimelineWidget';
import { WhoOwesYouWidget } from './WhoOwesYouWidget';

// Money Studio's own widgets, beside AG Studio's built-in ones: "Who owes you" and "Week timeline".
// They read Money Studio's data from Studio's `context` (dashboard.tsx passes it; see
// widget-parts.ts) rather than through a data mapping, so there's nothing to set up: drop one on a
// page and it shows. In the edit panel they're under "Flick".

const flickWidgets: AgWidgetDefinition[] = [
  {
    id: 'flick-who-owes-you',
    label: 'Who owes you',
    comp: WhoOwesYouWidget,
    form: ({ createDefaults }) => createDefaults({}),
    defaultState: { format: { title: { enabled: true, text: 'Who owes you' } } },
    defaultSize: { width: 8, height: 18 },
    minSize: { width: 6, height: 10 },
    ai: {
      label: 'Who owes you',
      description: "Each friend who still owes the person money, most first, with their face, how much, how many requests, since when and how many reminders were sent. Uses Flick's own requests; needs no data mapping.",
      usage: 'Use for money owed to the person, or who to chase.',
    },
  },
  {
    id: 'flick-week-timeline',
    label: 'Week timeline',
    comp: WeekTimelineWidget,
    form: ({ createDefaults }) => createDefaults({}),
    defaultState: { format: { title: { enabled: true, text: 'Week timeline' } } },
    defaultSize: { width: 16, height: 18 },
    minSize: { width: 10, height: 10 },
    ai: {
      label: 'Week timeline',
      description: "Autopilot's week as seven day columns, Monday to Sunday, each payment on its day, coloured by status (planned, scheduled, paid, skipped, failed). Uses Flick's own week; needs no data mapping.",
      usage: "Use for what's being paid when this week.",
    },
  },
];

/** Studio's `widgets`: the built-in widgets and menu, plus ours in a "Flick" group. */
export const withFlickWidgets = (defaults: AgWidgetsConfig): AgWidgetsConfig =>
  ({
    ...defaults,
    widgets: [...defaults.widgets, ...flickWidgets],
    menu: [...defaults.menu, { label: 'Flick', widgetIds: flickWidgets.map((w) => w.id) }],
  }) as AgWidgetsConfig;
