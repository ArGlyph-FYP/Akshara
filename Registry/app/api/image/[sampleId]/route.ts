import { getSession } from "@/lib/auth";
import { col, getSample } from "@/lib/data";
import { adminBucket, storageEmulated } from "@/lib/firebase/admin";

/**
 * Serves a scan only to someone allowed to see it:
 * admins, and raters with an assignment for the sample (in any study).
 */
export async function GET(req: Request, { params }: { params: Promise<{ sampleId: string }> }) {
  const { sampleId } = await params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const sample = await getSample(sampleId);
  if (!sample?.imagePath) return new Response("Not found", { status: 404 });

  let allowed = session.kind === "staff" && session.user.role === "admin";
  if (!allowed && session.kind === "staff") {
    const a = await col.assignments().where("raterId", "==", session.uid).where("sampleId", "==", sampleId).limit(1).get();
    allowed = !a.empty;
  }
  if (!allowed) return new Response("Forbidden", { status: 403 });

  // ?size=thumb serves the small preview when one exists (grids), else the full scan.
  const wantThumb = new URL(req.url).searchParams.get("size") === "thumb";
  const path = wantThumb && sample.thumbPath ? sample.thumbPath : sample.imagePath;
  const contentType = path === sample.thumbPath ? "image/jpeg" : sample.contentType;

  // In production, hand the browser a short-lived signed URL instead of piping the scan through
  // this function (serverless platforms cap response bodies at ~4.5 MB). The path has no participant code.
  if (!storageEmulated()) {
    const [url] = await adminBucket()
      .file(path)
      .getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 15 * 60 * 1000 });
    return new Response(null, {
      status: 302,
      headers: { location: url, "cache-control": "private, max-age=600" },
    });
  }

  const [buf] = await adminBucket().file(path).download();
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": contentType,
      "cache-control": "private, max-age=1800",
      "x-content-type-options": "nosniff",
    },
  });
}
