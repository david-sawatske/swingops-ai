import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { disconnectPrisma } from "./lib/prisma.js";

const app = buildApp();

async function startServer(): Promise<void> {
  try {
    await app.listen({
      host: env.API_HOST,
      port: env.API_PORT
    });
  } catch (error) {
    app.log.error(error, "Failed to start API server");
    process.exit(1);
  }
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, "Shutting down API server");

  try {
    await app.close();
    await disconnectPrisma();
    process.exit(0);
  } catch (error) {
    app.log.error(error, "Error during API shutdown");
    process.exit(1);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await startServer();
