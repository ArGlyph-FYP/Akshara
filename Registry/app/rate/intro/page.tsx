import { redirect } from "next/navigation";
import { requireRater } from "@/lib/auth";
import { getStudy } from "@/lib/data";
import { Tour } from "./Tour";

/** Main study: before the first form, the rater takes a short tour or skips it. */
export default async function Intro({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRater();
  const id = (await searchParams).study;
  const study = id ? await getStudy(id) : null;
  if (!study) redirect("/rate");
  // Only the Sinhala tour exists so far.
  if (study.type !== "rubric" || study.script !== "si") redirect(`/rate/next?study=${study.id}`);
  return <Tour studyId={study.id} />;
}
