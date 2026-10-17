import { redirect } from "next/navigation";
import { requireRater } from "@/lib/auth";
import { raterQueue } from "@/lib/data";

export default async function NextItem({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRater();
  const study = (await searchParams).study;
  if (study) {
    const { next } = await raterQueue(s.uid, study);
    if (next) redirect(`/rate/${next.id}`);
  }
  redirect("/rate");
}
