import { sql } from "drizzle-orm";
import { getDb, resolveDatabaseUrl } from "@server/db";

export const dynamic = "force-dynamic";

function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.password = "***";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return "***";
  }
}

/** 诊断端点：检查应用与数据库连接可用性（迁移自原 Express /api/health）。 */
export async function GET() {
  const databaseUrl = resolveDatabaseUrl();
  let database = "unavailable";
  let detail = "数据库未初始化";

  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`SELECT 1`);
      database = "connected";
      detail = "数据库连接正常";
    } else {
      database = "unavailable";
      detail = "数据库连接初始化失败";
    }
  } catch (error) {
    database = "error";
    detail = error instanceof Error ? error.message : "数据库查询异常";
  }

  const healthy = database === "connected";
  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      env: process.env.COZE_PROJECT_ENV ?? "DEV",
      database,
      databaseDetail: detail,
      databaseUrl: maskDatabaseUrl(databaseUrl),
      time: new Date().toISOString(),
    },
    { status: 200 }
  );
}
