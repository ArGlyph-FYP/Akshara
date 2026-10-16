import { redirect } from "next/navigation";
import { requireRater } from "@/lib/auth";
import { raterQueue } from "@/lib/data";

export default async function NextItem({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRater();
  const script = (await searchParams).script;
  if (script === "si" || script === "ta") {
    const { next } = await raterQueue(s.uid, script);
    if (next) redirect(`/rate/${next.id}`);
  }
  redirect("/rate");
}
