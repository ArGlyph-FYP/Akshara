import { listParticipants } from "@/lib/data";
import { Uploader } from "./Uploader";

export default async function UploadPage() {
  const participants = await listParticipants();
  const known = Object.fromEntries(
    participants.map((p) => [p.code, { consent: !!p.consentReceivedAt, withdrawn: p.status === "withdrawn" }]),
  );
  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Upload scans</h1>
        <p className="text-sm text-muted">
          Drop one or many scans. Files named like <code>SI-001.jpg</code> or <code>TA-014_p2.png</code> are matched
          automatically; otherwise type the code. JPEG or PNG, 300 dpi recommended.
        </p>
      </div>
      <Uploader known={known} />
    </div>
  );
}
