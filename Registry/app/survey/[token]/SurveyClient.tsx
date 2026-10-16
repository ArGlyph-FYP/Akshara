"use client";

import { signInAnonymously } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImageAnnotator } from "@/components/ImageAnnotator";
import { ScoreButtons } from "@/components/ScoreButtons";
import { clientAuth, startServerSession } from "@/lib/firebase/client";
import type { Scale } from "@/lib/types";
import { joinSurvey, submitSurveyResponse } from "./actions";

export function SurveyStart(props: {
  token: string;
  hasSession: boolean;
  title: string;
  language: string;
  instructions: string;
  count: number;
}) {
  const router = useRouter();
  const [adult, setAdult] = useState(false);
  const [nativeReader, setNativeReader] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      if (!props.hasSession) {
        await signInAnonymously(clientAuth());
        await startServerSession();
      }
      const res = await joinSurvey(props.token, { adult, nativeReader: !!nativeReader, consent });
      if (res?.error) throw new Error(res.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">{props.title}</h1>
        <p className="mt-2 text-sm text-muted">
          A University of Moratuwa research study on how {props.language} handwriting looks. You will see{" "}
          {props.count} handwriting samples, one at a time. For each, give a score and say in your own words what
          makes it look good or bad. It takes about {Math.max(5, Math.round(props.count * 1.2))} minutes. We don&apos;t
          ask for your name or contact details.
        </p>
        {props.instructions && <p className="mt-3 text-sm whitespace-pre-line">{props.instructions}</p>}
      </div>
      <div className="card space-y-3 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={adult} onChange={(e) => setAdult(e.target.checked)} />I am 18
          years old or older.
        </label>
        <div>
          <p>Do you read and write {props.language} as a first (native) language?</p>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="native" checked={nativeReader === true} onChange={() => setNativeReader(true)} /> Yes
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="native" checked={nativeReader === false} onChange={() => setNativeReader(false)} /> No
            </label>
          </div>
        </div>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I
          agree to take part. My anonymous answers may be used in research publications and released in an anonymised
          research dataset.
        </label>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn btn-primary w-full py-2" disabled={!adult || !consent || nativeReader === null || busy} onClick={start}>
        {busy ? "Starting…" : "Start"}
      </button>
    </div>
  );
}

export function SurveyItem(props: {
  token: string;
  sampleId: string;
  imageSrc: string;
  position: number;
  total: number;
  scale: Scale;
  language: string;
}) {
  const router = useRouter();
  const started = useRef(Date.now());
  const [overall, setOverall] = useState<number | null>(null);
  const [liked, setLiked] = useState("");
  const [disliked, setDisliked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (overall === null) return setError("Choose a score");
    if (!liked.trim() && !disliked.trim()) return setError("Please write at least one reason");
    setBusy(true);
    setError(null);
    const res = await submitSurveyResponse(props.token, {
      sampleId: props.sampleId,
      overall,
      likedText: liked,
      dislikedText: disliked,
      durationMs: Date.now() - started.current,
    });
    if (res?.error) {
      setBusy(false);
      return setError(res.error);
    }
    router.refresh();
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-xs font-semibold tracking-widest text-accent">AKSHARA</span>
          <span className="text-muted">
            {props.position} / {props.total}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-accent" style={{ width: `${(100 * (props.position - 1)) / props.total}%` }} />
        </div>
        <ImageAnnotator src={props.imageSrc} heightClass="h-[60vh] lg:h-[calc(100vh-6rem)]" />
      </div>
      <aside className="space-y-4 lg:pt-8">
        <div className="card space-y-4">
          <div>
            <h2 className="text-sm font-semibold">How good does this handwriting look?</h2>
            <p className="text-xs text-muted">Judge only how it looks, not spelling or content.</p>
            <ScoreButtons scale={props.scale} value={overall} onChange={setOverall} lowLabel="very poor" highLabel="excellent" />
          </div>
          <div>
            <label className="label">What makes it look good?</label>
            <textarea className="input" rows={3} value={liked} onChange={(e) => setLiked(e.target.value)} placeholder={`You can write in ${props.language} or English`} />
          </div>
          <div>
            <label className="label">What makes it look bad, or could be better?</label>
            <textarea className="input" rows={3} value={disliked} onChange={(e) => setDisliked(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn btn-primary w-full py-2" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : props.position === props.total ? "Finish" : "Next"}
          </button>
        </div>
      </aside>
    </main>
  );
}
