import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineResource, withUserIdCheckResource } from '../../shared/toolsUtils';
import { getSummaryResource } from './summary';
import { getHivesResource } from './hives';
import { getTasksResource } from './tasks';

const apiaryResources = [
  defineResource({
    name: 'apiary-summary',
    uri: 'apiary://summary',
    description:
      'Overview: yard count, hive count, pending task count, 5 most recent logs, 5 upcoming tasks',
    mimeType: 'application/json',
    callback: getSummaryResource,
  }),
  defineResource({
    name: 'apiary-hives',
    uri: 'apiary://hives',
    description: 'All active hives with their yard name, queen status, and box count',
    mimeType: 'application/json',
    callback: getHivesResource,
  }),
  defineResource({
    name: 'apiary-tasks',
    uri: 'apiary://tasks',
    description: 'All pending (uncompleted) tasks, sorted by due date (soonest first), with hive name',
    mimeType: 'application/json',
    callback: getTasksResource,
  }),
];

export function registerApiaryResources(server: McpServer): void {
  for (const resource of apiaryResources) {
    server.registerResource(
      resource.name,
      resource.uri,
      { description: resource.description, mimeType: resource.mimeType },
      resource.skipUserIdCheck ? resource.callback : withUserIdCheckResource(resource.callback),
    );
  }
}
