import { getSession } from "@/lib/auth";
import { col, getSettings, getSurveyByToken } from "@/lib/data";
import { seededRandom, shuffle } from "@/lib/random";
import { SCRIPT_LABEL } from "@/lib/types";
import { SurveyItem, SurveyStart } from "./SurveyClient";

export const dynamic = "force-dynamic";

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const survey = await getSurveyByToken(token);

  if (!survey?.open) {
    return (
      <Shell>
        <h1 className="h1">This survey is closed</h1>
        <p className="mt-2 text-sm text-muted">Thank you for your interest in the Akshara study.</p>
      </Shell>
    );
  }

  const session = await getSession();
  const readerDoc = session ? await col.surveys().doc(survey.id).collection("readers").doc(session.uid).get() : null;

  if (!session || !readerDoc?.exists) {
    return (
      <Shell>
        <SurveyStart
          token={token}
          hasSession={!!session}
          title={survey.title}
          language={SCRIPT_LABEL[survey.script]}
          instructions={survey.instructions}
          count={survey.sampleIds.length}
        />
      </Shell>
    );
  }

  const answered = new Set(
    (await col.surveys().doc(survey.id).collection("responses").where("respondentUid", "==", session.uid).get()).docs.map(
      (d) => d.data().sampleId as string,
    ),
  );
  // Each reader gets their own fixed random order.
  const order = shuffle(survey.sampleIds, seededRandom(`${survey.id}:${session.uid}`));
  const next = order.find((id) => !answered.has(id));

  if (!next) {
    return (
      <Shell>
        <h1 className="h1">Thank you! ස්තුතියි! நன்றி!</h1>
        <p className="mt-2 text-sm text-muted">
          Your responses have been saved. You can close this page.
        </p>
      </Shell>
    );
  }

  const { surveyScale } = await getSettings();
  return (
    <SurveyItem
      key={next}
      token={token}
      sampleId={next}
      imageSrc={`/api/image/${next}?survey=${survey.id}`}
      position={answered.size + 1}
      total={order.length}
      scale={surveyScale}
      language={SCRIPT_LABEL[survey.script]}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <p className="mb-2 text-xs font-semibold tracking-widest text-accent">AKSHARA</p>
      {children}
    </main>
  );
}
