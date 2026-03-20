import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineTool, withUserIdCheck } from '../../shared/toolsUtils';
import { CreateYardSchema, createYardTool, ListYardsSchema, listYardsTool, UpdateYardSchema, updateYardTool } from './yards';
import {
  CreateHiveSchema,
  createHiveTool,
  ListHivesSchema,
  listHivesTool,
  UpdateHiveSchema,
  updateHiveTool,
} from './hives';
import { LogEventSchema, logEventTool, GetLogsSchema, getLogsTool, DeleteLogSchema, deleteLogTool } from './logs';
import {
  CreateTaskSchema,
  createTaskTool,
  CompleteTaskSchema,
  completeTaskTool,
  DeleteTaskSchema,
  deleteTaskTool,
} from './tasks';

const apiaryTools = [
  // ---- Yard tools ----
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
  // ---- Hive tools ----
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
  // ---- Log tools ----
  defineTool({
    name: 'apiary_log_event',
    description:
      'Record a hive event (inspection, treatment, feeding, harvest, relocation, queen_event, or note). ' +
      'The `data` field holds type-specific details — see the JSONB payload table in the schema section.',
    inputSchema: LogEventSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: logEventTool,
  }),
  defineTool({
    name: 'apiary_get_logs',
    description: 'Retrieve event logs with optional filters. Returns newest first.',
    inputSchema: GetLogsSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getLogsTool,
  }),
  defineTool({
    name: 'apiary_delete_log',
    description: 'Delete a log entry by ID.',
    inputSchema: DeleteLogSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: deleteLogTool,
  }),
  // ---- Task tools ----
  defineTool({
    name: 'apiary_create_task',
    description: 'Create a beekeeping task, optionally tied to a specific hive',
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
      withUserIdCheck(tool.callback, tool.skipUserIdCheck),
    );
  }
}
