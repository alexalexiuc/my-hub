import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProfileTools } from './tools/profile';
import { registerMealTools } from './tools/meals';
import { registerSummaryTools } from './tools/summary';
import { registerMeasurementTools } from './tools/measurements';
import { registerCaloriesResources } from './resources';

export function createCaloriesServer(): McpServer {
  const server = new McpServer({
    name: 'calories-tracker-mcp-server',
    version: '1.0.0',
  });

  registerProfileTools(server);
  registerMealTools(server);
  registerSummaryTools(server);
  registerMeasurementTools(server);
  registerCaloriesResources(server);

  return server;
}
