import { DEFAULT_FILTERS, type Filters } from "@/components/admin/SampleBrowser";
import type { StudyType } from "@/lib/types";

/** Per-type wording and defaults for the two study pages. */
export const COPY: Record<
  StudyType,
  { title: string; noun: string; description: string; sampleHint: string; filters: Filters; invite: string }
> = {
  perception: {
    title: "Perception study",
    noun: "perception study",
    description:
      "Phase A. Readers open your link, enter their details, then score each sample, say what looks good or bad, and can box those parts of the page.",
    sampleHint: "About 10–15 pilot samples with a range of quality works well.",
    filters: { ...DEFAULT_FILTERS, phase: "pilot" },
    invite:
      "Hello! We are researchers at the University of Moratuwa studying how handwriting looks. Could you spare about 15 minutes to rate a few handwriting samples? No sign-up needed:",
  },
  rubric: {
    title: "Main study",
    noun: "main study",
    description:
      "Phase C. Raters open your link, enter their details, then rate each sample's overall look, legibility and every rubric criterion, and box weak regions.",
    sampleHint: "Usually every approved main-phase scan. Calibration anchors (marked in the Dataset) are shown first to every rater.",
    filters: { ...DEFAULT_FILTERS, phase: "main", qc: "qc_ok" },
    invite: "Hello! Thank you for rating handwriting for the Akshara study (University of Moratuwa). Open this link, enter your name and start:",
  },
};
