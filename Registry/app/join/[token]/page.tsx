import { notFound, redirect } from "next/navigation";
import { getStudyByPublicToken } from "@/lib/data";
import { surveyPath } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Old-style links (/join/{token}) keep working: they forward to /sin|tam/survey/{token}. */
export default async function OldJoinLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const study = await getStudyByPublicToken(token);
  if (!study) notFound();
  redirect(surveyPath(study.script, token));
}
