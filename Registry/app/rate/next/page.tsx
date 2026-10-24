import { redirect } from "next/navigation";
import { requireRater } from "@/lib/auth";
import { getStudy, raterQueue } from "@/lib/data";

export default async function NextItem({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRater();
  const study = (await searchParams).study;
  if (study) {
    const { next, items } = await raterQueue(s.uid, study);
    if (next) redirect(`/rate/${next.id}`);
    // Main study: a finished form ends on the thank-you screen, where the reader can ask for 10 more.
    if (items.length && (await getStudy(study))?.type === "rubric") redirect(`/rate/done?study=${study}`);
  }
  redirect("/rate");
}
