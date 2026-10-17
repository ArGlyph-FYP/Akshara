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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clientAuth } from "@/lib/firebase/client";
import type { Script } from "@/lib/types";
import { joinAsSelf } from "./actions";

const AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const GREETING: Record<Script, string> = { si: "ආයුබෝවන්!", ta: "வணக்கம்!" };

export function JoinForm(props: {
  token: string;
  title: string;
  language: string;
  script: Script;
  instructions: string;
  count: number;
  signedInAs: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [nativeReader, setNativeReader] = useState<"yes" | "no" | "">("");
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = name.trim() && nativeReader && adult && consent;

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
          contact,
          ageGroup,
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
        <p className="text-sm font-medium text-primary">{GREETING[props.script]}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{props.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A research study on how {props.language} handwriting looks. You&apos;ll see {props.count} handwriting
          samples, one at a time. For each, give a score and say in your own words what makes it look good or bad.
          It takes about {Math.max(5, Math.round(props.count * 1.2))} minutes.
        </p>
        {props.instructions && <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm whitespace-pre-line">{props.instructions}</p>}
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div>
          <Label htmlFor="join-name" className="mb-1.5">Your name</Label>
          <Input id="join-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="join-contact" className="mb-1.5">
            Email or phone <span className="font-normal text-muted-foreground">(optional, only to contact you about the study)</span>
          </Label>
          <Input id="join-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5">Age group</Label>
            <Select value={ageGroup} onValueChange={setAgeGroup}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {AGE_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5">Is {props.language} your first language?</Label>
            <RadioGroup value={nativeReader} onValueChange={(v) => setNativeReader(v as "yes" | "no")} className="flex h-8 gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <RadioGroupItem value="yes" /> Yes
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <RadioGroupItem value="no" /> No
              </label>
            </RadioGroup>
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={adult} onCheckedChange={(v) => setAdult(!!v)} className="mt-0.5" /> I am 18 years old or older.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
          <span>
            I agree to take part. My answers may be used in research publications and in an anonymised research dataset;
            my name and contact details are never published.
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="h-10 w-full" disabled={!ready || busy} onClick={start}>
        {busy && <Loader2 className="animate-spin" />} Start
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Your progress is saved on this device, so you can close the page and come back to this link later.
      </p>
    </div>
  );
}
