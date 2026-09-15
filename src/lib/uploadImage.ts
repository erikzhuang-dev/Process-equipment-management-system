"use client";

/** 图片上传（base64 → /api/uploads），台账与申请域共用。 */
export async function uploadImageFile(file: File): Promise<string> {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, dataBase64 }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.url) throw new Error(json?.error || "图片上传失败");
  return String(json.url);
}
