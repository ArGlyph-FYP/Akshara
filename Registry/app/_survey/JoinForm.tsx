"use client";

import { signInAnonymously, signOut } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { clientAuth } from "@/lib/firebase/client";
import type { Script, StudyType } from "@/lib/types";
import { joinAsSelf } from "./actions";
import { surveyText } from "./i18n";


export function JoinForm(props: {
  token: string;
  title: string;
  script: Script;
  type: StudyType;
  instructions: string;
  count: number;
  signedInAs: string | null;
}) {
  const router = useRouter();
  const t = surveyText(props.script);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [occupation, setOccupation] = useState("");
  const [contact, setContact] = useState("");
  const [nativeReader, setNativeReader] = useState<"yes" | "no" | "">("");
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ageNum = Number(age);
  const ageOk = Number.isInteger(ageNum) && ageNum >= 18 && ageNum <= 100;
  const ready = name.trim() && ageOk && occupation.trim() && contact.trim() && nativeReader && adult && consent;
  const minutes = Math.max(5, Math.round(props.count * (props.type === "perception" ? 1.2 : 1.5)));

  async function post() {
    const auth = clientAuth();
    if (!auth.currentUser || !auth.currentUser.isAnonymous) await signInAnonymously(auth);
    const send = async () =>
      fetch("/api/public-join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idToken: await auth.currentUser!.getIdToken(true),
          token: props.token,
          name,
          age: ageNum,
          occupation,
          contact,
          nativeReader: nativeReader === "yes",
          adult,
          consent,
        }),
      });
    let res = await send();
    if (res.status === 401 && (await res.clone().json().catch(() => ({}))).stale) {
      // The old browser sign-in is too old to start a session: begin a fresh one.
      await signOut(auth);
      await signInAnonymously(auth);
      res = await send();
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Could not start the survey");
    return body.next as string;
  }

  async function start() {
    if (!ready) return setError(age && !ageOk ? t.ageError : t.required);
    setBusy(true);
    setError(null);
    try {
      router.push(await post());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (props.signedInAs) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{props.title}</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;re signed in as <b>{props.signedInAs}</b>. To see what readers see, open this link in a private
          window, or take part with your own account.
        </p>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await joinAsSelf(props.token);
            if (r.error) {
              setError(r.error);
              setBusy(false);
            } else router.push(r.next!);
          }}
        >
          Take part as {props.signedInAs}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{t.greeting}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{props.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.intro(props.type, props.count, minutes)}</p>
        {props.instructions && <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm whitespace-pre-line">{props.instructions}</p>}
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div>
          <Label htmlFor="join-name" className="mb-1.5">{t.name}</Label>
          <Input id="join-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="grid gap-4 sm:grid-cols-[110px_1fr]">
          <div>
            <Label htmlFor="join-age" className="mb-1.5">{t.age}</Label>
            <Input
              id="join-age"
              type="number"
              inputMode="numeric"
              min={18}
              max={100}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              aria-invalid={!!age && !ageOk}
            />
          </div>
          <div>
            <Label htmlFor="join-occ" className="mb-1.5">{t.occupation}</Label>
            <Input id="join-occ" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder={t.occupationHint} />
          </div>
        </div>
        {age && !ageOk && <p className="-mt-2 text-xs text-destructive">{t.ageError}</p>}
        <div>
          <Label htmlFor="join-contact" className="mb-1.5">
            {t.contact}
          </Label>
          <Input id="join-contact" value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="tel" />
          <p className="mt-1 text-xs text-muted-foreground">{t.contactHint}</p>
        </div>
        <div>
          <Label className="mb-1.5">{t.firstLanguage}</Label>
          <RadioGroup value={nativeReader} onValueChange={(v) => setNativeReader(v as "yes" | "no")} className="flex h-8 gap-6">
            <label className="flex items-center gap-1.5 text-sm">
              <RadioGroupItem value="yes" /> {t.yes}
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <RadioGroupItem value="no" /> {t.no}
            </label>
          </RadioGroup>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={adult} onCheckedChange={(v) => setAdult(!!v)} className="mt-0.5" /> {t.adult}
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
          <span>{t.consent}</span>
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="h-10 w-full" disabled={busy} onClick={start}>
        {busy && <Loader2 className="animate-spin" />} {t.start}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t.resumeNote}</p>
    </div>
  );
}
