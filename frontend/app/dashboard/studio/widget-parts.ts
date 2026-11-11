import type { DashboardData } from '@backend/dashboard-data';

/** What dashboard.tsx hands AG Studio as `context`: Money Studio's data, for its own widgets (custom-widgets.tsx). */
export type StudioContext = { data: DashboardData };
