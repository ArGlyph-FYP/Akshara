import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStudyByPublicToken, listAssignments } from "@/lib/data";
import { formSize, publicLinkOpen, usableStudySamples } from "@/lib/public";
import { surveyPath, type Script } from "@/lib/types";
import { surveyText } from "./i18n";
import { JoinForm } from "./JoinForm";
import { Logo } from "@/components/Logo";

/** Public survey page behind /sin/survey/{token} and /tam/survey/{token}. */
export async function SurveyPage({ script, token }: { script: Script; token: string }) {
  const study = await getStudyByPublicToken(token);
  // A link with the wrong language prefix forwards to the right one.
  if (study && study.script !== script) redirect(surveyPath(study.script, token));
  const t = surveyText(study?.script ?? script);
  if (!publicLinkOpen(study)) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">{t.closedTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.closedBody}</p>
      </Shell>
    );
  }
  const session = await getSession();
  if (session) {
    const mine = await listAssignments({ studyId: study.id, raterId: session.uid });
    if (mine.length) redirect(`/rate/next?study=${study.id}`);
  }
  // What one new reader will get: anchors (main study) + their share of the samples + blinded repeats.
  // Main study: one form of 10 (more can be asked for at the end).
  const usable = await usableStudySamples(study);
  const anchors = study.type === "rubric" ? usable.filter((s) => s.isAnchor).length : 0;
  const others = usable.length - anchors;
  const perReader = study.type === "rubric" ? formSize(study) : study.perReader;
  const share = perReader ? Math.min(perReader, others) : others;
  const repeats = study.type === "rubric" ? Math.round(share * Math.min(50, study.repeatPct ?? 0) / 100) : 0;
  const count = anchors + share + repeats;
  return (
    <Shell>
      <JoinForm
        token={token}
        title={study.title}
        script={study.script}
        type={study.type}
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
