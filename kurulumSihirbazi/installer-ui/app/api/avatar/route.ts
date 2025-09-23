import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  const filePath = process.env.AVATAR_FILE_PATH;
  if (filePath) {
    try {
      const data = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const type = ext === ".png" ? "image/png"
        : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
        : ext === ".svg" ? "image/svg+xml" : "application/octet-stream";
      return new NextResponse(data, { headers: { "Content-Type": type } });
    } catch {
      // fallthrough to default
    }
  }
  // Fallback: serve bundled placeholder from public
  try {
    const local = path.join(process.cwd(), "public", "avatars", "user.svg");
    const data = await fs.readFile(local);
    return new NextResponse(data, { headers: { "Content-Type": "image/svg+xml" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
