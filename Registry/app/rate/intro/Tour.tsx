"use client";

import { ArrowLeft, ArrowRight, GraduationCap, Loader2, SquareDashedMousePointer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScoreButtons } from "@/components/ScoreButtons";
import { Button } from "@/components/ui/button";
import { BAND_NAMES, BAND_RANGES, COUNT_NAMES, CRITERIA, LEVEL_NAMES, OVERALL, bandIndex } from "@/lib/rubric/si";
import { cn } from "@/lib/utils";
import { recordTraining } from "../actions";

/** A short Sinhala tour of the main-study form (Rubric v_final, 4 cards), which raters can skip. */
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
            <b>සමස්ත අලංකාරය (O)</b> යනු ලිවීම සමස්තයක් ලෙස කෙතරම් හොඳින් පෙනේද යන්නයි (සුසංයෝගය, පිළිවෙළ, රිද්මය). එය{" "}
            <b>කියවීමේ පහසුවෙන් (L)</b> වෙනස් දෙයකි.
          </li>
          <li>මුළු ඡේදයටම සාමාන්‍ය දේ අනුව ඇගයන්න. එක් වරක් පමණක් සිදු වූ වැරැද්දක් නිසා ලකුණ අඩු නොකරන්න; නැවත නැවත සිදු වන හෝ බරපතල ගැටලු ගණන් ගන්න.</li>
          <li>
            ලියා ඇති දේ පමණක් විනිශ්චය කරන්න. පාඨයට සාපේක්ෂව අකුරක් හෝ ලකුණක් අඩු, අමතර හෝ වැරදි නම් <b>පිටපත් කිරීමේ වැරැද්ද</b> තෝරන්න; O සහ L
            ඇතුළු කිසිදු ලකුණක් එය නිසා අඩු නොකරන්න.
          </li>
          <li>සෑම ගැටලුවක්ම එක් වරක් පමණක්, එය අයත් නිර්ණායකය යටතේ ගණන් ගන්න.</li>
        </ul>
      ),
    },
    {
      title: "O සහ L: ලකුණු 1–10",
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
            පළමුව ගැළපෙන කාණ්ඩය තෝරා, පසුව එහි අඩු හෝ වැඩි අංකය තෝරන්න. <b>O</b> ඡේදය තත්පර 10ක් පමණ බලා මුල් හැඟීම අනුව දෙන්න; පසුව එය වෙනස් නොකරන්න.
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
      title: "A1–A8: ගැළපෙන විස්තරය තෝරන්න",
      body: (
        <div className="space-y-3">
          <p>
            <b>A1–A5, A7, A8</b> සඳහා ඡේදයට වඩාත්ම ගැළපෙන විස්තරය ඇති විකල්පය තෝරන්න:
          </p>
          <p className="rounded-lg bg-muted/60 p-3">{LEVEL_NAMES.join(" · ")}</p>
          <p>
            <b>A6 පරතරය</b> හි කෙටි ප්‍රශ්න තුනක් ඇත (වචනය තුළ, වචන අතර, පේළි අතර). පැහැදිලිව පෙනෙන ගැටලු ඇති තැන් ගණන අනුව මට්ටමක් තෝරන්න:
          </p>
          <p className="rounded-lg bg-muted/60 p-3">{COUNT_NAMES.map((n, i) => `${i}: ${n}`).join(" · ")}</p>
          <p className="text-muted-foreground">
            “බලන්න” tap කළ විට විනිශ්චය කළ යුතු දේ සහ සෑම විකල්පයකම විස්තරය පෙනේ. විනිශ්චය කිරීමට කිසිවක් නැති විට පමණක් “අදාළ නොවේ” තෝරන්න (උදා: එක් පේළියක ඡේදයක A6c).
          </p>
          <span className="block text-xs text-muted-foreground">
            {CRITERIA.filter((c) => !c.group).map((c) => `${c.code} ${c.label}`).join(" · ")}
          </span>
        </div>
      ),
    },
    {
      title: "එක් පිටුවක් = එක් ඡේදයක්",
      body: (
        <div className="space-y-3">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              <b>O</b> සමස්ත අලංකාරය, පසුව <b>L</b> කියවීමේ පහසුව (1–10).
            </li>
            <li>
              <b>A1–A8</b> (A6 ප්‍රශ්න තුනක් සමඟ).
            </li>
            <li>
              අවශ්‍ය නම් <b>පිටපත් කිරීමේ වැරැද්ද</b> තෝරන්න. රූපය බොඳ, කැපී ගොස් හෝ බොහෝ දුරට කපා හැර ඇත්නම් <b>ඇගයිය නොහැක</b> තෝරා හේතුව ලියන්න; එවිට අනෙක්
              ප්‍රශ්න හිස්ව තබන්න.
            </li>
          </ol>
          <p>
            <SquareDashedMousePointer className="mr-1 inline size-4 text-primary" />
            <b>“දුර්වල තැනක් සලකුණු කරන්න”</b> tap කර, රූපයේ දුර්වල තැන වටා කොටුවක් අඳින්න. ඉන්පසු නිර්ණායකය, ගැටලුව සහ බරපතලකම (2 = පැහැදිලිව පෙනේ, 3 =
            වචනය හෝ පේළිය නරක් කරයි) තෝරන්න. මෙය <b>අනිවාර්ය නොවේ</b>.
          </p>
          <p>
            එක් පෝරමයක ඡේද 10ක් ඇත: මුලින් <b>පාඨය 1</b> ඡේද 5ක්, පසුව <b>පාඨය 2</b> ඡේද 5ක්. එකම පාඨය විවිධ අය ලියා ඇත. අවසානයේ කැමති නම් තවත් ඡේද 10ක් ඇගයිය හැක.
          </p>
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
