import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProfileTools } from "./tools/profile.js";
import { registerMealTools } from "./tools/meals.js";
import { registerSummaryTools } from "./tools/summary.js";

export function createCaloriesServer(userId: string): McpServer {
  const server = new McpServer({
    name: "calories-tracker-mcp-server",
    version: "1.0.0",
  });

  registerProfileTools(server, userId);
  registerMealTools(server, userId);
  registerSummaryTools(server, userId);

  return server;
}
