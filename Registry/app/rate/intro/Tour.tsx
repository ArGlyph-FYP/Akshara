"use client";

import { ArrowLeft, ArrowRight, GraduationCap, Loader2, SquareDashedMousePointer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScoreButtons } from "@/components/ScoreButtons";
import { Button } from "@/components/ui/button";
import { BAND_NAMES, BAND_RANGES, CRITERIA, OVERALL, bandIndex } from "@/lib/rubric/si";
import { cn } from "@/lib/utils";
import { recordTraining } from "../actions";

/** A one-minute Sinhala tour of the main-study form (4 cards), which raters can skip. */
export function Tour({ studyId }: { studyId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null); // null = the choice screen
  const [busy, setBusy] = useState(false);
  const [tryScore, setTryScore] = useState<number | null>(null);

  async function finish(choice: "done" | "skipped") {
    setBusy(true);
    await recordTraining(choice);
    router.push(`/rate/next?study=${studyId}`);
  }

  if (step === null) {
    return (
      <main className="mx-auto max-w-md space-y-6 px-4 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ඇගයීම ආරම්භ කිරීමට පෙර</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            ඇගයීම කරන ආකාරය පිළිබඳ කෙටි හැඳින්වීමක් (මිනිත්තුවක් පමණ) බැලීමට ඔබට හැක. පෙර අත්දැකීම් ඇත්නම් එය skip කළ හැක.
          </p>
        </div>
        <Button className="h-12 w-full text-base" onClick={() => setStep(0)} disabled={busy}>
          <GraduationCap /> කෙටි පුහුණුව (මිනිත්තු 1)
        </Button>
        <Button variant="outline" className="h-12 w-full text-base" onClick={() => finish("skipped")} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Skip කර ඇගයීම අරඹන්න
        </Button>
      </main>
    );
  }

  const cards = [
    {
      title: "මෙහි ‘ලස්සන’ යනු කුමක්ද?",
      body: (
        <ul className="list-disc space-y-2 pl-5">
          <li>
            අපි ඇගයන්නේ අත් අකුරු <b>පෙනුමෙන් කෙතරම් ලස්සනද</b> යන්න පමණි. අක්ෂර වින්‍යාසය, අන්තර්ගතය හෝ අර්ථය නොසලකන්න.
          </li>
          <li>පාසල් ආකෘතියට සමාන වීම පමණක් වැඩි ලකුණකට හේතුවක් නොවේ. ස්ථාවර, හොඳින් සැකසූ පෞද්ගලික ශෛලියක් දෝෂයක් නොවේ.</li>
          <li>කඩදාසිය, ස්කෑන් ගුණාත්මකභාවය සහ පෑනේ වර්ණය නොසලකන්න.</li>
        </ul>
      ),
    },
    {
      title: "ලකුණු 1–10: පළමුව කාණ්ඩය, පසුව අංකය",
      body: (
        <div className="space-y-3">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 rounded-lg bg-muted/60 p-3">
            {BAND_RANGES.map((r, i) => (
              <div key={r} className="contents">
                <span className="font-medium tabular-nums">{r}</span>
                <span>{BAND_NAMES[i]}</span>
              </div>
            ))}
          </div>
          <p>
            <b>5–6 යනු සාමාන්‍ය වැඩිහිටි අත් අකුරකි.</b> සම්පූර්ණ පරාසයම භාවිත කරන්න. ගැළපෙන කාණ්ඩය තෝරා, පසුව එහි අඩු හෝ වැඩි අංකය තෝරන්න.
          </p>
          <div className="rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground">උත්සාහ කර බලන්න: අංකයක් tap කරන්න</p>
            <ScoreButtons compact scale={{ min: 1, max: 10 }} value={tryScore} onChange={setTryScore} lowLabel={OVERALL.low} highLabel={OVERALL.high} />
            <p className="mt-1 min-h-10 text-xs text-primary">
              {tryScore !== null && (
                <>
                  {BAND_NAMES[bandIndex(tryScore)]}: {OVERALL.bands[bandIndex(tryScore)]}
                </>
              )}
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "එක් පිටුවක් = එක් ඡේදයක්",
      body: (
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <b>සමස්ත අලංකාරය (O)</b> — මුළු ඡේදයම බලා, මුල් හැඟීම අනුව (තත්පර 10ක් පමණ) ලකුණු දෙන්න. පසුව එය වෙනස් නොකරන්න.
          </li>
          <li>
            <b>සැරසිලි</b> සහ <b>කපා හැරීම්</b> — කෙටි ප්‍රශ්න දෙකකි.
          </li>
          <li>
            <b>නිර්ණායක අට (A1–A8)</b> — තනි නරකම අකුර අනුව නොව, සාමාන්‍ය අකුර අනුව. “බලන්න” tap කළ විට එක් එක් එකේ විස්තර පෙනේ.
            <span className="mt-1 block text-xs text-muted-foreground">{CRITERIA.map((c) => c.label).join(" · ")}</span>
          </li>
          <li>
            <b>කියවීමේ පහසුව (L)</b> — ලස්සන බව නොසලකා, කියවීම කෙතරම් පහසුද.
          </li>
        </ol>
      ),
    },
    {
      title: "දුර්වල තැන් සහ පාඨ දෙක",
      body: (
        <div className="space-y-3">
          <p>
            <SquareDashedMousePointer className="mr-1 inline size-4 text-primary" />
            <b>“දුර්වල තැනක් සලකුණු කරන්න”</b> tap කර, රූපයේ දුර්වල තැන වටා කොටුවක් අඳින්න. ඉන්පසු නිර්ණායකය, ගැටලුව සහ බරපතලකම (2 = පැහැදිලිව පෙනේ, 3 =
            වචනය හෝ පේළිය නරක් කරයි) තෝරන්න. මෙය <b>අනිවාර්ය නොවේ</b>.
          </p>
          <p>
            එක් පෝරමයක ඡේද 10ක් ඇත: මුලින් <b>පාඨය 1</b> ඡේද 5ක්, පසුව <b>පාඨය 2</b> ඡේද 5ක්. එකම පාඨය විවිධ අය ලියා ඇත. අවසානයේ කැමති නම් තවත් ඡේද 10ක් ඇගයිය හැක.
          </p>
          <p className="text-muted-foreground">එක දිගට ඡේද 30කට වඩා ඇගයීමෙන් වළකින්න. අවශ්‍ය නම් විවේක ගන්න.</p>
        </div>
      ),
    },
  ];
  const last = step === cards.length - 1;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg flex-col px-4 py-8">
      <div className="mb-4 flex items-center gap-1.5">
        {cards.map((_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {step + 1} / {cards.length}
      </p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight">{cards[step].title}</h1>
      <div className="mt-4 flex-1 text-sm leading-relaxed">{cards[step].body}</div>
      <div className="mt-6 flex gap-2">
        <Button variant="outline" className="h-11" onClick={() => setStep(step === 0 ? null : step - 1)} disabled={busy}>
          <ArrowLeft /> ආපසු
        </Button>
        {last ? (
          <Button className="h-11 flex-1" onClick={() => finish("done")} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} ඇගයීම අරඹන්න
          </Button>
        ) : (
          <Button className="h-11 flex-1" onClick={() => setStep(step + 1)}>
            ඊළඟ <ArrowRight />
          </Button>
        )}
      </div>
      {!last && (
        <button
          type="button"
          className="mt-3 text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => finish("skipped")}
          disabled={busy}
        >
          පුහුණුව Skip කර ඇගයීම අරඹන්න
        </button>
      )}
    </main>
  );
}
