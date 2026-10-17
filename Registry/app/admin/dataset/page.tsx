import { requireAdmin } from "@/lib/auth";
import { listParticipants } from "@/lib/data";
import { datasetRows } from "@/lib/dataset";
import { currentScript } from "@/lib/script";
import { DatasetView } from "./DatasetView";

export const dynamic = "force-dynamic";

export default async function DatasetPage() {
  const s = await requireAdmin();
  const script = await currentScript(s.user);
  const [{ rows, studies }, writers] = await Promise.all([datasetRows(script), listParticipants(script)]);
  const scanCount: Record<string, number> = {};
  for (const r of rows) scanCount[r.code] = (scanCount[r.code] ?? 0) + 1;
  const known = Object.fromEntries(
    (await listParticipants()).map((p) => [p.code, { consent: !!p.consentReceivedAt, withdrawn: p.status === "withdrawn" }]),
  );
  return <DatasetView script={script} rows={rows} studies={studies} writers={writers} scanCount={scanCount} known={known} />;
}
