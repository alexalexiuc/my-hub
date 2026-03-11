import type { FastifyInstance } from "fastify";

/**
 * MCP router — mounts each MCP sub-server module.
 *
 * Pattern: POST /mcp/:serverId  → forward to the matching McpServer instance.
 * GET  /mcp/:serverId  → SSE transport (Streamable HTTP).
 *
 * TODO: wire up hiveManager, calories, and products McpServer instances
 *       in the follow-up migration.
 */
export async function mcpRoutes(app: FastifyInstance) {
  app.get("/", async (_req, reply) => {
    return reply.send({
      message: "MCP endpoint",
      servers: ["hive", "calories", "products"],
    });
  });

  // Placeholder route — replace with real McpServer transport in follow-up
  app.post<{ Params: { serverId: string } }>(
    "/:serverId",
    async (req, reply) => {
      const { serverId } = req.params;
      app.log.info({ serverId }, "MCP request received");
      return reply.status(501).send({ error: "Not yet implemented", serverId });
    },
  );
}
