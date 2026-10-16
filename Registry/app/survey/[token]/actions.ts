"use server";

import { run } from "@/lib/action";
import { assertReader } from "@/lib/auth";
import { col, getSettings, getSurveyByToken, surveyResponseId } from "@/lib/data";
import type { SurveyReader, SurveyResponse } from "@/lib/types";

async function openSurvey(token: string) {
  const survey = await getSurveyByToken(token);
  if (!survey?.open) throw new Error("This survey is closed.");
  return survey;
}

export async function joinSurvey(token: string, answers: { adult: boolean; nativeReader: boolean; consent: boolean }) {
  return run(async () => {
    const s = await assertReader();
    const survey = await openSurvey(token);
    if (!answers.adult || !answers.consent) throw new Error("You must be 18 or older and agree to take part.");
    const reader: SurveyReader = {
      uid: s.uid,
      nativeReader: !!answers.nativeReader,
      adultConfirmed: true,
      consentedAt: Date.now(),
    };
    await col.surveys().doc(survey.id).collection("readers").doc(s.uid).set(reader);
  });
}

export async function submitSurveyResponse(
  token: string,
  input: { sampleId: string; overall: number; likedText: string; dislikedText: string; durationMs: number },
) {
  return run(async () => {
    const s = await assertReader();
    const survey = await openSurvey(token);
    if (!survey.sampleIds.includes(input.sampleId)) throw new Error("Unknown sample");
    const surveyRef = col.surveys().doc(survey.id);
    if (!(await surveyRef.collection("readers").doc(s.uid).get()).exists) throw new Error("Please start the survey again.");

    const { surveyScale } = await getSettings();
    if (!Number.isInteger(input.overall) || input.overall < surveyScale.min || input.overall > surveyScale.max) {
      throw new Error("Choose a score");
    }
    const likedText = String(input.likedText ?? "").trim().slice(0, 2000);
    const dislikedText = String(input.dislikedText ?? "").trim().slice(0, 2000);
    if (!likedText && !dislikedText) throw new Error("Please write at least one reason");

    const response: SurveyResponse = {
      respondentUid: s.uid,
      sampleId: input.sampleId,
      overall: input.overall,
      likedText,
      dislikedText,
      durationMs: Math.max(0, Math.round(Number(input.durationMs) || 0)),
      submittedAt: Date.now(),
    };
    // Deterministic ID: a double submit or refresh overwrites instead of duplicating.
    await surveyRef.collection("responses").doc(surveyResponseId(s.uid, input.sampleId)).set(response);
  });
}
