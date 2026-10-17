import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStudyByPublicToken, listAssignments } from "@/lib/data";
import { publicLinkOpen } from "@/lib/public";
import { SCRIPT_LABEL } from "@/lib/types";
import { JoinForm } from "./JoinForm";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const study = await getStudyByPublicToken(token);
  if (!publicLinkOpen(study)) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">This survey is closed</h1>
        <p className="mt-2 text-sm text-muted-foreground">Thank you for your interest in the Akshara study.</p>
      </Shell>
    );
  }
  const session = await getSession();
  if (session) {
    const mine = await listAssignments({ studyId: study.id, raterId: session.uid });
    if (mine.length) redirect(`/rate/next?study=${study.id}`);
  }
  const count = study.perReader ? Math.min(study.perReader, study.sampleIds.length) : study.sampleIds.length;
  return (
    <Shell>
      <JoinForm
        token={token}
        title={study.title}
        language={SCRIPT_LABEL[study.script]}
        script={study.script}
        instructions={study.instructions}
        count={count}
        signedInAs={session && !session.user.public ? session.user.displayName || session.user.email : null}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-8">
        <Logo sub="University of Moratuwa" />
      </div>
      {children}
    </main>
  );
}
