import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_EXT_WHITELIST = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

function uploadDir(): string {
  // dev: Vite publicDir 托管 public；prod: express.static(dist/public)
  const base = process.env.NODE_ENV === "production"
    ? path.resolve(process.cwd(), "dist/public")
    : path.resolve(process.cwd(), "public");
  return path.join(base, "uploads");
}

/**
 * POST /api/uploads
 * body: { filename: string; dataBase64: string }
 * 仅接受白名单内的图片类型，大小 <= 5MB，写入静态托管目录并返回可访问 URL。
 */
export function registerUploadRoutes(app: Express): void {
  app.post("/api/uploads", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { filename?: string; dataBase64?: string };
      const filename = String(body.filename ?? "");
      const dataBase64 = String(body.dataBase64 ?? "");
      const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
      if (!UPLOAD_EXT_WHITELIST.has(ext)) {
        res.status(400).json({ error: "仅支持 png/jpg/jpeg/webp/gif 图片" });
        return;
      }
      if (!dataBase64) {
        res.status(400).json({ error: "缺少图片数据" });
        return;
      }
      const base64 = dataBase64.includes(",") ? dataBase64.slice(dataBase64.indexOf(",") + 1) : dataBase64;
      const buffer = Buffer.from(base64, "base64");
      if (buffer.length === 0) {
        res.status(400).json({ error: "图片数据为空" });
        return;
      }
      if (buffer.length > UPLOAD_MAX_BYTES) {
        res.status(413).json({ error: "图片大小不能超过 5MB" });
        return;
      }
      const dir = uploadDir();
      await mkdir(dir, { recursive: true });
      const name = `${randomUUID()}.${ext}`;
      await writeFile(path.join(dir, name), buffer);
      res.json({ url: `/uploads/${name}` });
    } catch (error) {
      console.error("[uploads] failed", error);
      res.status(500).json({ error: "图片上传失败" });
    }
  });
}
