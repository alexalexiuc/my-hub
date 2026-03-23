import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineTool, withUserIdCheck } from '../../shared/toolsUtils';
import {
  TravelAddReservationFromTextSchema,
  TravelAttachDocumentLinkSchema,
  TravelGetTripBriefSchema,
  TravelPlanTripSchema,
  TravelPrepareTripChecklistSchema,
  TravelWhoIsTravelingSchema,
  travelAddReservationFromTextTool,
  travelAttachDocumentLinkTool,
  travelGetTripBriefTool,
  travelPlanTripTool,
  travelPrepareTripChecklistTool,
  travelWhoIsTravelingTool,
} from './tasks';

const travelTools = [
  defineTool({
    name: 'travel_plan_trip',
    description:
      'Plan a new trip from natural language details. Optionally seeds a practical checklist for preparation.',
    inputSchema: TravelPlanTripSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelPlanTripTool,
  }),
  defineTool({
    name: 'travel_add_reservation_from_text',
    description: 'Capture a booking/reservation from raw text (email/snippet/chat) and attach it to an existing trip.',
    inputSchema: TravelAddReservationFromTextSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelAddReservationFromTextTool,
  }),
  defineTool({
    name: 'travel_prepare_trip_checklist',
    description:
      'Prepare a trip checklist with default travel-readiness items. Use when user asks what to prepare before departure.',
    inputSchema: TravelPrepareTripChecklistSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelPrepareTripChecklistTool,
  }),
  defineTool({
    name: 'travel_who_is_traveling',
    description: 'Manage and summarize trip companions in one task-oriented call (add/update/remove/list).',
    inputSchema: TravelWhoIsTravelingSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelWhoIsTravelingTool,
  }),
  defineTool({
    name: 'travel_get_trip_brief',
    description:
      'Get a concise trip brief with itinerary counts, checklist, and companions. Defaults to next upcoming trip if trip_id is omitted.',
    inputSchema: TravelGetTripBriefSchema.shape,
    annotations: { readOnlyHint: true },
    callback: travelGetTripBriefTool,
  }),
  defineTool({
    name: 'travel_attach_document_link',
    description: 'Attach a document URL to a trip (tickets, boarding passes, visas, vouchers, etc).',
    inputSchema: TravelAttachDocumentLinkSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: travelAttachDocumentLinkTool,
  }),
];

export function registerTravelTools(server: McpServer): void {
  for (const tool of travelTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      withUserIdCheck(tool.callback, tool.skipUserIdCheck),
    );
  }
}
