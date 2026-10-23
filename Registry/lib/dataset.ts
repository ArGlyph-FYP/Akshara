import "server-only";
import { listAssignments, listSamples, listStudies } from "./data";
import type { RatingState, SampleRow, StudyRef } from "./dataset-types";
import type { Script } from "./types";

/** Everything the Dataset grid and the Survey sample picker need, for one script. */
export async function datasetRows(script: Script): Promise<{ rows: SampleRow[]; studies: StudyRef[] }> {
  const [samples, assignments, studies] = await Promise.all([
    listSamples({ script }),
    listAssignments({ script }),
    listStudies(script),
  ]);
  const counts = new Map<string, { assigned: number; done: number }>();
  for (const a of assignments) {
    if (a.kind === "repeat") continue;
    const c = counts.get(a.sampleId) ?? { assigned: 0, done: 0 };
    c.assigned++;
    if (a.status === "done") c.done++;
    counts.set(a.sampleId, c);
  }
  const inStudies = new Map<string, string[]>();
  for (const st of studies) for (const id of st.sampleIds) inStudies.set(id, [...(inStudies.get(id) ?? []), st.id]);

  const rows: SampleRow[] = samples.map((s) => {
    const c = counts.get(s.id) ?? { assigned: 0, done: 0 };
    const rating: RatingState = c.done === 0 ? "not_rated" : c.done < c.assigned ? "in_progress" : "rated";
    return {
      id: s.id,
      code: s.participantCode,
      pageNo: s.pageNo,
      part: s.part ?? null,
      phase: s.phase,
      status: s.status,
      isAnchor: s.isAnchor,
      writerId: s.writerId,
      uploadedAt: s.uploadedAt,
      assigned: c.assigned,
      done: c.done,
      rating,
      studyIds: inStudies.get(s.id) ?? [],
    };
  });
  return {
    rows,
    studies: studies.map((s) => ({ id: s.id, title: s.title, type: s.type, open: s.open })),
  };
}
