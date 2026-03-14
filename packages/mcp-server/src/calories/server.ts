import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProfileTools } from "./tools/profile";
import { registerMealTools } from "./tools/meals";
import { registerSummaryTools } from "./tools/summary";

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
