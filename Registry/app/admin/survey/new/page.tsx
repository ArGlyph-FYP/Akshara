import { requireAdmin } from "@/lib/auth";
import { currentCriteria, ratersFor } from "@/lib/data";
import { datasetRows } from "@/lib/dataset";
import { currentScript } from "@/lib/script";
import { NewStudyWizard } from "./NewStudyWizard";

export const dynamic = "force-dynamic";

export default async function NewStudyPage() {
  const s = await requireAdmin();
  const script = await currentScript(s.user);
  const [{ rows, studies }, raters, { criteria }] = await Promise.all([datasetRows(script), ratersFor(script), currentCriteria(script)]);
  return (
    <NewStudyWizard
      script={script}
      rows={rows.filter((r) => r.status !== "excluded" && r.status !== "rejected")}
      studies={studies}
      raters={raters.filter((r) => !r.public).map((r) => ({ uid: r.uid, name: r.displayName, email: r.email, alias: r.alias, role: r.role }))}
      criteriaCount={criteria.length}
    />
  );
}
