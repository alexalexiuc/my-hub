import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineTool, withUserIdCheck } from '../../shared/toolsUtils';
import {
  CreateYardSchema,
  createYardTool,
  ListYardsSchema,
  listYardsTool,
  UpdateYardSchema,
  updateYardTool,
} from './yards';
import {
  CreateHiveSchema,
  createHiveTool,
  ListHivesSchema,
  listHivesTool,
  UpdateHiveSchema,
  updateHiveTool,
  GetHiveStatusSchema,
  getHiveStatusTool,
} from './hives';
import {
  LogInspectionSchema,
  logInspectionTool,
  LogTreatmentSchema,
  logTreatmentTool,
  LogFeedingSchema,
  logFeedingTool,
  LogHarvestSchema,
  logHarvestTool,
  LogQueenEventSchema,
  logQueenEventTool,
  LogRelocationSchema,
  logRelocationTool,
  AddNoteSchema,
  addNoteTool,
  GetHiveLogsSchema,
  getHiveLogsTool,
  DeleteLogSchema,
  deleteLogTool,
} from './logs';
import {
  ListTasksSchema,
  listTasksTool,
  CreateTaskSchema,
  createTaskTool,
  CompleteTaskSchema,
  completeTaskTool,
  DeleteTaskSchema,
  deleteTaskTool,
} from './tasks';
import {
  GetActiveTreatmentsSchema,
  getActiveTreatmentsTool,
  GetOverdueInspectionsSchema,
  getOverdueInspectionsTool,
  MoveHivesSchema,
  moveHivesTool,
  GetYardBriefingSchema,
  getYardBriefingTool,
} from './semantic';

const apiaryTools = [
  // ---- Yard tools (3) ----
  defineTool({
    name: 'apiary_create_yard',
    description: 'Create a new yard (physical location where hives are kept)',
    inputSchema: CreateYardSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: createYardTool,
  }),
  defineTool({
    name: 'apiary_list_yards',
    description: 'List all yards for the authenticated user',
    inputSchema: ListYardsSchema.shape,
    annotations: { readOnlyHint: true },
    callback: listYardsTool,
  }),
  defineTool({
    name: 'apiary_update_yard',
    description: "Update an existing yard's details",
    inputSchema: UpdateYardSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: updateYardTool,
  }),
  defineTool({
    name: 'apiary_get_yard_briefing',
    description:
      'Get a full yard briefing — all hives at this yard, overdue inspections, active treatments, ' +
      'open hive-level tasks, and open yard-level tasks. ' +
      'Use when the beekeeper says "I\'m heading to yard X, what\'s waiting for me?"',
    inputSchema: GetYardBriefingSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getYardBriefingTool,
  }),
  // ---- Hive tools (4) ----
  defineTool({
    name: 'apiary_create_hive',
    description: 'Register a new hive. Optionally assign to a yard.',
    inputSchema: CreateHiveSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: createHiveTool,
  }),
  defineTool({
    name: 'apiary_list_hives',
    description: 'List hives with optional filters by yard and active status',
    inputSchema: ListHivesSchema.shape,
    annotations: { readOnlyHint: true },
    callback: listHivesTool,
  }),
  defineTool({
    name: 'apiary_update_hive',
    description: 'Update hive details (queen info, boxes, yard assignment, etc.)',
    inputSchema: UpdateHiveSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: updateHiveTool,
  }),
  defineTool({
    name: 'apiary_get_hive_status',
    description:
      'Get full status for a hive — returns the hive details, yard name, last inspection summary, ' +
      'any active treatments (computed from durationDays), and all open tasks. ' +
      'Use this when asked "How is Hive X doing?" for a single-call complete picture.',
    inputSchema: GetHiveStatusSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getHiveStatusTool,
  }),
  // ---- Typed log tools (7) ----
  defineTool({
    name: 'apiary_log_inspection',
    description:
      'Record a hive inspection with typed fields: temperament, brood pattern, queen sighting, population, disease signs.',
    inputSchema: LogInspectionSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: logInspectionTool,
  }),
  defineTool({
    name: 'apiary_log_treatment',
    description:
      'Record a treatment event with product, method, and duration. ' +
      'The durationDays field is used to compute active treatment windows (via apiary_get_active_treatments).',
    inputSchema: LogTreatmentSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: logTreatmentTool,
  }),
  defineTool({
    name: 'apiary_log_feeding',
    description: 'Record a feeding event with feed type, ratio, and amount.',
    inputSchema: LogFeedingSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: logFeedingTool,
  }),
  defineTool({
    name: 'apiary_log_harvest',
    description: 'Record a honey harvest with frame count, weight, and honey type.',
    inputSchema: LogHarvestSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: logHarvestTool,
  }),
  defineTool({
    name: 'apiary_log_queen_event',
    description:
      'Record a queen event (requeened, lost, seen, emerged, superseded) with optional queen source, mark color.',
    inputSchema: LogQueenEventSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: logQueenEventTool,
  }),
  defineTool({
    name: 'apiary_log_relocation',
    description: "Record a hive relocation to a different yard. Atomically updates the hive's yardId to toYardId.",
    inputSchema: LogRelocationSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: logRelocationTool,
  }),
  defineTool({
    name: 'apiary_add_note',
    description: 'Add a general freetext note, optionally tied to a specific hive.',
    inputSchema: AddNoteSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: addNoteTool,
  }),
  // ---- Log query tools (2) ----
  defineTool({
    name: 'apiary_get_hive_logs',
    description: 'Get the event history for a specific hive, filterable by type. Returns newest first.',
    inputSchema: GetHiveLogsSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getHiveLogsTool,
  }),
  defineTool({
    name: 'apiary_delete_log',
    description: 'Delete a log entry by ID.',
    inputSchema: DeleteLogSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: deleteLogTool,
  }),
  // ---- Semantic query tools (2) ----
  defineTool({
    name: 'apiary_get_active_treatments',
    description:
      'Get all currently active treatments — computes end dates from loggedAt + durationDays server-side. ' +
      'No manual date math needed. Optionally filter by hive.',
    inputSchema: GetActiveTreatmentsSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getActiveTreatmentsTool,
  }),
  defineTool({
    name: 'apiary_get_overdue_inspections',
    description:
      'Get hives where the last inspection was more than N days ago (default: 14). ' +
      'Includes hives that have never been inspected. Use to answer "Which hives need checking?"',
    inputSchema: GetOverdueInspectionsSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getOverdueInspectionsTool,
  }),
  // ---- Bulk operations (1) ----
  defineTool({
    name: 'apiary_move_hives',
    description:
      'Bulk-move multiple hives to a different yard in one call. ' +
      'Atomically updates yardId on all hives and creates a relocation log entry per hive. ' +
      'Use for seasonal moves like "I moved hives 1-40 to Forest 1 today".',
    inputSchema: MoveHivesSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: moveHivesTool,
  }),
  // ---- Task tools (4) ----
  defineTool({
    name: 'apiary_list_tasks',
    description: 'List tasks with optional filters by hive, yard, completion status, and due date.',
    inputSchema: ListTasksSchema.shape,
    annotations: { readOnlyHint: true },
    callback: listTasksTool,
  }),
  defineTool({
    name: 'apiary_create_task',
    description:
      'Create a beekeeping task. Can be tied to a specific hive (hiveId), a yard (yardId), or neither (general task). ' +
      'Cannot set both hiveId and yardId.',
    inputSchema: CreateTaskSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: createTaskTool,
  }),
  defineTool({
    name: 'apiary_complete_task',
    description: 'Mark a task as completed',
    inputSchema: CompleteTaskSchema.shape,
    annotations: { idempotentHint: true, destructiveHint: false },
    callback: completeTaskTool,
  }),
  defineTool({
    name: 'apiary_delete_task',
    description: 'Delete a task by ID',
    inputSchema: DeleteTaskSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: deleteTaskTool,
  }),
];

export function registerApiaryTools(server: McpServer): void {
  for (const tool of apiaryTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      withUserIdCheck(tool.callback),
    );
  }
}
