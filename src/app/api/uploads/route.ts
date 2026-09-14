import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_EXT_WHITELIST = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

/**
 * POST /api/uploads
 * body: { filename: string; dataBase64: string }
 * 仅接受白名单内的图片类型，大小 <= 5MB，写入 public/uploads 并返回可访问 URL。
 * 迁移自原 Express server/_core/uploads.ts（Next 的 public 目录同时承担 dev/prod 静态托管）。
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      filename?: string;
      dataBase64?: string;
    };
    const filename = String(body.filename ?? "");
    const dataBase64 = String(body.dataBase64 ?? "");
    const ext = filename.includes(".")
      ? filename.split(".").pop()!.toLowerCase()
      : "";
    if (!UPLOAD_EXT_WHITELIST.has(ext)) {
      return Response.json(
        { error: "仅支持 png/jpg/jpeg/webp/gif 图片" },
        { status: 400 }
      );
    }
    if (!dataBase64) {
      return Response.json({ error: "缺少图片数据" }, { status: 400 });
    }
    const base64 = dataBase64.includes(",")
      ? dataBase64.slice(dataBase64.indexOf(",") + 1)
      : dataBase64;
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) {
      return Response.json({ error: "图片数据为空" }, { status: 400 });
    }
    if (buffer.length > UPLOAD_MAX_BYTES) {
      return Response.json(
        { error: "图片大小不能超过 5MB" },
        { status: 413 }
      );
    }
    const dir = path.resolve(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, name), buffer);
    return Response.json({ url: `/uploads/${name}` });
  } catch (error) {
    console.error("[uploads] failed", error);
    return Response.json({ error: "图片上传失败" }, { status: 500 });
  }
}
