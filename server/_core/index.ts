import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerUploadRoutes } from "./uploads";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getDb, resolveDatabaseUrl } from "../db";
import { sql } from "drizzle-orm";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  app.get("/api/health", async (_req, res) => {
  const db = await getDb();
  let database = "unavailable";
  if (db) {
    try {
      await db.execute(sql`select 1`);
      database = "ok";
    } catch {
      database = "unreachable";
    }
  }
  res.json({
    status: "ok",
    database,
    databaseUrl: resolveDatabaseUrl().replace(/:[^:@/]+@/, ":***@"),
    env: process.env.COZE_PROJECT_ENV ?? "unknown",
    time: new Date().toISOString(),
  });
});

const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerUploadRoutes(app);
  // Health check: expose db availability for post-deploy diagnosis
  app.get("/api/health", async (_req, res) => {
    let dbOk = false;
    let dbError: string | null = null;
    try {
      const db = await getDb();
      if (db) {
        await db.execute(sql`SELECT 1`);
        dbOk = true;
      }
    } catch (error) {
      dbError = error instanceof Error ? error.message : String(error);
    }
    res.json({
      ok: dbOk,
      db: dbOk ? "up" : "down",
      dbError,
      databaseUrl: resolveDatabaseUrl().replace(/:[^:@/]+@/, ":***@"),
      env: process.env.COZE_PROJECT_ENV || "unknown",
      time: new Date().toISOString(),
    });
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
