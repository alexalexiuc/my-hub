import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineResource, withUserIdCheckResource } from '../../shared/toolsUtils';
import { getFinancesContextResource } from './context';
import { getFinancesAccountResource } from './account';
import { getFinancesPayeesResource } from './payees';

const financeResources = [
  defineResource({
    name: 'finances-context',
    uri: 'finances://context',
    description:
      'Budget metadata, all non-archived accounts (with card hints), and full category tree with display names. ' +
      'Load this at session start to get IDs for all tools.',
    mimeType: 'application/json',
    callback: getFinancesContextResource,
  }),
  defineResource({
    name: 'finances-account-detail',
    uri: 'finances://accounts/{id}',
    description: 'Full detail for a single account including balance and type-specific metadata.',
    mimeType: 'application/json',
    callback: getFinancesAccountResource,
  }),
  defineResource({
    name: 'finances-payees',
    uri: 'finances://payees',
    description:
      'Full payee list for the active budget with optional aliases and AI descriptions. ' +
      'Use to match payee names when recording transactions.',
    mimeType: 'application/json',
    callback: getFinancesPayeesResource,
  }),
];

export function registerFinancesResources(server: McpServer): void {
  for (const resource of financeResources) {
    server.registerResource(
      resource.name,
      resource.uri,
      { description: resource.description, mimeType: resource.mimeType },
      withUserIdCheckResource(resource.callback),
    );
  }
}
