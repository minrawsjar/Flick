import { createAiHarness } from 'ag-studio';
import { openaiAdapter } from './openai-adapter';

/**
 * Read-only tool that fetches current household state from Flick's backend.
 */
export const readHouseholdStateTool = {
  name: 'readHouseholdState',
  description:
    'Fetches current household state, including flickPayments, flickRequests, autopilot settings, and balance breakdowns from Flick.',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) {
        throw new Error(`Failed to fetch state: ${res.statusText}`);
      }
      return await res.json();
    } catch (err: any) {
      return {
        error: true,
        message: err?.message || 'Unable to fetch household state.',
      };
    }
  },
};

/**
 * Configures the Flick AI Agent harness with built-in delegation and tools.
 */
export function buildAi(api: any) {
  return createAiHarness(api, {
    adapter: openaiAdapter,
    builder: ({ builtIn, tools }) => {
      return {
        agents: [
          {
            id: 'flick-agent',
            name: 'Flick',
            systemPrompt: `You are Flick, an expert AI financial co-pilot and household assistant for Money Studio.

Core Rules & Behavior:
1. Always keep all tools strictly read-only. Never modify state directly without explicit confirmation flows.
2. When users ask to generate or layout dashboard views/reports (e.g. "Build my Sunday recap" or "Create a spending summary"):
   - Call readHouseholdState first to gather full contextual data (flickRequests, flickPayments, etc.).
   - Delegate the page layout, grid arrangement, and widget composition directly to AG Studio's lead agent (builtIn.lead).
3. When users ask specific payment questions (e.g. "Why is City Power scheduled on Wednesday?"):
   - Call readHouseholdState, find the relevant entry in flickPayments or flickRequests, and give a concise, clear answer drawing directly from the item's 'reason' or schedule field.`,
            tools: [readHouseholdStateTool, ...tools],
            delegates: [builtIn.lead],
          },
          ...Object.values(builtIn),
        ],
        defaultAgentId: 'flick-agent',
      };
    },
  });
}

// Alias export for backward compatibility
export const setupAiHarness = buildAi;