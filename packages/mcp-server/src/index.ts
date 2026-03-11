import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { mcpRoutes } from "./routes/mcp.js";

const PORT = Number(process.env["PORT"] ?? 3001);
const HOST = process.env["HOST"] ?? "0.0.0.0";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
    },
  });

  await app.register(cors, {
    origin: process.env["CORS_ORIGIN"] ?? "*",
  });

  await app.register(healthRoutes);
  await app.register(mcpRoutes, { prefix: "/mcp" });

  return app;
}

async function main() {
  const app = await buildApp();
  await app.listen({ port: PORT, host: HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
