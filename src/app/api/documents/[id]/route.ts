import { serveOwnFile } from "@/server/files";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return serveOwnFile("documents", "documents", id, new URL(req.url).searchParams.get("v") === "thumb" ? "thumb" : "file");
}
