"use server";

import { assertStaff } from "@/lib/auth";
import { col, getStudyByPublicToken } from "@/lib/data";
import { assignPublicReader, publicLinkOpen } from "@/lib/public";

/** Someone already signed in (e.g. an admin trying the link) joins with their own account. */
export async function joinAsSelf(token: string): Promise<{ error?: string; next?: string }> {
  try {
    const s = await assertStaff();
    const study = await getStudyByPublicToken(token);
    if (!publicLinkOpen(study)) return { error: "This survey link is closed." };
    if (!s.user.scripts.includes(study.script)) {
      await col.users().doc(s.uid).update({ scripts: [...s.user.scripts, study.script] });
    }
    const n = await assignPublicReader(study, s.uid);
    if (!n) return { error: "There is nothing to rate in this survey yet." };
    return { next: `/rate/next?study=${study.id}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
