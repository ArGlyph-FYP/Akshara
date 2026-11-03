/**
 * Akshara Tamil handwriting aesthetic assessment rubric v0.3 (26 Oct 2026), rater-facing text.
 * Proposed instrument for expert review and pilot testing; a native Tamil reviewer must check the wording before the pilot.
 * Tamil text is taken from the rubric document. Where the document gives a look-for only in English (C2–C8), it is kept in English.
 * Codes (H1, C1–C8, L1) and stored values stay in English so exports line up with the rubric document.
 */
import type { Bands, CriterionText, ScoreQuestion } from "./si";

export const RUBRIC_DOC_VERSION = "0.3";

/** Five bands, best first: 9–10, 7–8, 5–6, 3–4, 1–2 (same boundaries as the Sinhala guide). */
export const BAND_NAMES: Bands = ["மிகச் சிறப்பு", "சிறப்பு", "நடுத்தரம்", "மேம்பாடு தேவை", "அதிக மேம்பாடு தேவை"];
export const BAND_NAMES_EN: Bands = ["Excellent", "Good", "Moderate", "Weak", "Very weak"];

export interface TaCriterionText extends CriterionText {
  /** English look-for and band descriptions from the rubric document. */
  lookForEn: string;
  bandsEn: Bands;
  /** Main scale the criterion is judged at (letter, word, line…). */
  scale: string;
}

export const INSTRUCTIONS: string[] = [
  "பந்தியை முதலில் முழுமையாகப் பார்த்து H1 மதிப்பைத் தேர்ந்தெடுக்கவும். பின்னர் L1 மற்றும் C1-C8 மதிப்புகளைத் தனித்தனியாக வழங்கவும். ஒரே ஒரு குறையை மட்டும் வைத்து முழுப் பந்தியையும் மதிப்பிட வேண்டாம்.",
  "Review the whole paragraph at the standard display size before zooming. Do not rate your own writing.",
  "Record H1 first and do not change it afterwards. Then record L1 and C1–C8. Do not revise H1 to match a total.",
  "For each criterion, choose the best-fitting level across the whole paragraph, considering both severity and how widely the issue occurs. An isolated small defect does not lower a whole paragraph to 1 or 2.",
  "Use 9–10 when minor natural variation does not disrupt the feature; perfection is not required. Use N/A only when a criterion cannot be judged, with a reason. Poor handwriting itself is not N/A.",
  "Assess accepted handwritten variants, including Grantha forms. Exclude spelling, meaning, pen colour, paper quality and decoration from the judgement.",
];

export const BAND_HOWTO =
  "முதலில் பந்திக்குப் பொருத்தமான விளக்கத்தைக் கொண்ட மதிப்பெண் பிரிவைத் தேர்ந்தெடுக்கவும். பின்னர் அந்தப் பிரிவில் உள்ள இரண்டு எண்களில் ஒன்றைத் தேர்ந்தெடுக்கவும். ஒவ்வொரு மதிப்பீட்டிற்கும் 1 முதல் 10 வரை ஒரு முழு எண்ணை வழங்கவும்.";

export const WITHIN_BAND_HOWTO =
  "தேர்ந்தெடுத்த பிரிவின் விளக்கத்துக்குப் பந்தி ஓரளவு மட்டுமே பொருந்தினால் குறைந்த எண்ணை வழங்கவும். அதே பிரிவிற்குள் அதிகச் சீர்மையுடனும் குறைந்த குறைகளுடனும் இருந்தால் உயர்ந்த எண்ணை வழங்கவும். ஒரு எழுத்தை மட்டும் வைத்து முடிவு செய்ய வேண்டாம்.";

export const OVERALL: ScoreQuestion = {
  code: "H1",
  label: "முழுமையான கையெழுத்து அழகு",
  question: "இந்தப் பந்தி முழுமையாகப் பார்க்கும்போது எவ்வளவு அழகாகத் தோன்றுகிறது?",
  help: "How visually pleasing is this paragraph as a whole? Record H1 first and do not change it afterwards.",
  bands: [
    "மிகவும் அழகிய தோற்றமுடைய கையெழுத்து. முழுப் பந்தியும் பார்ப்பதற்கு மிகவும் அழகாக உள்ளது.",
    "அழகிய தோற்றமுடைய கையெழுத்து. பொதுவாக அழகாகத் தோன்றுகிறது; சில சிறிய குறைகள் மட்டும் காணப்படுகின்றன.",
    "ஓரளவு அழகிய தோற்றமுடைய கையெழுத்து. அழகான பகுதிகளும் தோற்றத்தைப் பாதிக்கும் குறைகளும் கலந்து காணப்படுகின்றன.",
    "அழகிய தோற்றம் குறைந்த கையெழுத்து. பல குறைகள் கையெழுத்தின் அழகைக் குறைக்கின்றன.",
    "அழகிய தோற்றம் மிகவும் குறைந்த கையெழுத்து. பந்தி முழுவதும் தோற்றத்தைப் பாதிக்கும் குறைகள் அதிகமாக உள்ளன.",
  ],
  low: "1 (lowest)",
  high: "10 (highest)",
};

export const OVERALL_BANDS_EN: Bands = [
  "Very visually pleasing overall.",
  "Visually pleasing overall, with small distractions.",
  "Moderately pleasing; positive and distracting features coexist.",
  "Limited visual appeal; distractions are prominent.",
  "Very limited visual appeal; disruptions dominate.",
];

export const LEGIBILITY: ScoreQuestion = {
  code: "L1",
  label: "வாசிப்புத் தெளிவு",
  question: "மூலப் பந்தியைப் பார்க்காமல் இந்தக் கையெழுத்தை எவ்வளவு எளிதாக வாசிக்க முடிகிறது?",
  help: "How easily can you read the handwriting without using the reference passage? Rate it separately from aesthetics.",
  bands: [
    "கையெழுத்து முழுவதும் தெளிவாக உள்ளது; எழுத்துகளையும் சொற்களையும் சரளமாக வாசிக்க முடிகிறது.",
    "கையெழுத்து பெரும்பாலும் தெளிவாக உள்ளது; சில எழுத்துகளையோ சொற்களையோ மீண்டும் வாசித்து உறுதிப்படுத்த வேண்டியுள்ளது.",
    "கையெழுத்து ஓரளவு தெளிவாக உள்ளது; பல எழுத்துகளையும் சொற்களையும் அடையாளம் காணக் கூடுதல் கவனமும் அடிக்கடி மீளவாசிப்பும் தேவைப்படுகின்றன.",
    "கையெழுத்தின் பல பகுதிகள் தெளிவின்றிக் காணப்படுகின்றன; கவனமாக வாசித்த பின்னரும் பல சொற்களை அடையாளம் காண்பது கடினமாக உள்ளது.",
    "கையெழுத்தின் பெரும்பகுதி தெளிவின்றிக் காணப்படுகிறது; பெரும்பாலான சொற்களை உறுதியாக வாசிக்க இயலவில்லை.",
  ],
  low: "1 (hardest)",
  high: "10 (easiest)",
};

export const LEGIBILITY_BANDS_EN: Bands = [
  "Read effortlessly at normal viewing size.",
  "Read easily; a few items need a second look.",
  "Read with noticeable effort and repeated checking.",
  "Many words remain difficult despite careful inspection.",
  "Most of the paragraph cannot be read confidently.",
];

export const CRITERIA_INTRO = "ஒவ்வொரு கூறிற்கும் பொருத்தமான ஒரு மதிப்பை வழங்கவும்.";

export const CRITERIA: TaCriterionText[] = [
  {
    key: "c1",
    code: "C1",
    labelEn: "Letter formation and components",
    label: "எழுத்து வடிவமும் உறுப்புகளும்",
    scale: "Letter",
    lookFor:
      "எழுத்தின் உறுப்புகள் விடுபடுதல்; வளைவுகள் மற்றும் சுழிகளின் வடிவம் மாறுதல் (ழ→ம); எழுத்துகளின் தனித்துவமான வடிவம் மாறுதல் (ண→ன, ல→வ); தேவையற்ற பகுதிகள் சேர்க்கப்படுதல்; ஒரே எழுத்தின் அடிப்படை வடிவத்தில் சீரற்ற தன்மை. எழுத்துகள் அச்சு எழுத்துகளைப் போலவே இருக்க வேண்டிய அவசியமில்லை; பெரியவர்களின் கையெழுத்தில் காணப்படும் இயல்பான வடிவ வேறுபாடுகளைப் பிழைகளாகக் கருத வேண்டாம்.",
    lookForEn:
      "Judge whether each letter has its conventional parts and balanced curves, loops and openings, using accepted adult forms rather than a printed font. Look for missing, additional or distorted components and whether the letter's distinctive structure is preserved. Stroke tidiness is scored under C8.",
    bands: [
      "எழுத்துகளின் உறுப்புகள் முழுமையாக உள்ளன; அவற்றின் வடிவங்கள் பந்தி முழுவதும் சீராகவும் முறையாகவும் அமைந்துள்ளன.",
      "எழுத்துகளின் உறுப்புகளும் வடிவங்களும் பெரும்பாலும் சீராக உள்ளன; சில எழுத்துகளில் மட்டும் சிறிய வடிவக் குறைபாடுகள் காணப்படுகின்றன.",
      "பல எழுத்துகள் சீராக அமைந்திருந்தாலும், எழுத்து வடிவங்களிலும் உறுப்புகளின் அமைப்பிலும் அடிக்கடி சீரற்ற தன்மை காணப்படுகிறது.",
      "பல எழுத்துகளின் வடிவங்கள் சிதைந்துள்ளன அல்லது சில உறுப்புகள் விடுபட்டுள்ளன; சில எழுத்துகள் வேறு எழுத்துகளைப் போலத் தோன்றுகின்றன.",
      "பந்தியின் பெரும்பகுதியில் எழுத்துகளின் வடிவங்கள் பெரிதும் சிதைந்து காணப்படுகின்றன; அவற்றின் உறுப்புகளும் பெரும்பாலும் முறையாக அமைந்திருக்கவில்லை.",
    ],
    bandsEn: [
      "Letter components are complete, and their forms are consistently well formed throughout the paragraph.",
      "Letter forms are mostly well formed, with a few minor irregularities.",
      "Well-formed letters coexist with recurring irregularities in shapes and components.",
      "Many letter forms are distorted or have missing components; some resemble other letters.",
      "Severe distortion of letter forms and components dominates the paragraph.",
    ],
  },
  {
    key: "c2",
    code: "C2",
    labelEn: "Pulli and vowel sign integration",
    label: "புள்ளி மற்றும் உயிர்க்குறிகளின் அமைவு",
    scale: "Letter and sign",
    lookFor:
      "புள்ளி as a small solid dot just above the middle of its consonant, not oversized, hollow, touching or drifting; both parts of கொ, கோ and கௌ close to their consonant; the கொம்பு of கெ not nearer the previous letter; the signs of கி, கீ, கு, கூ, சு and சூ attached in that consonant's form.",
    lookForEn:
      "Judge the size, placement and association of each புள்ளி or vowel sign with its own base, including both parts of two-part signs. A sign need not touch its base. Score a missing or extra mark here and log it as a copying difference.",
    bands: [
      "புள்ளிகளும் உயிர்க்குறிகளும் உரிய அளவிலும் இடத்திலும் உள்ளன; தொடர்பு தெளிவாக உள்ளது.",
      "குறிகளின் அமைவு பெரும்பாலும் சீராக உள்ளது; சில சிறிய இடமாற்றங்கள் உள்ளன.",
      "சில குறிகள் அளவிலோ இடத்திலோ சீரின்றி உள்ளன; பெரும்பாலும் தொடர்பு தெரிகிறது.",
      "பல குறிகள் மிக நெருக்கமாக அல்லது விலகி உள்ளன; அடுத்த எழுத்துடன் குழப்பம் ஏற்படுகிறது.",
      "புள்ளி மற்றும் உயிர்க்குறிகளின் அமைவு பந்தி முழுவதும் பெரிதும் சீர்குலைந்துள்ளது.",
    ],
    bandsEn: [
      "Marks are balanced and consistently associated with their own bases.",
      "Association is clear, with a few minor placement or size variations.",
      "Recurring placement or size variations occur; most associations remain apparent.",
      "Many marks crowd or drift from their bases, creating competing associations.",
      "Severely disrupted mark placement or association dominates.",
    ],
  },
  {
    key: "c3",
    code: "C3",
    labelEn: "Letter size and proportion consistency",
    label: "எழுத்துகளின் அளவும் வடிவ விகிதமும் ஒழுங்காக இருத்தல்",
    scale: "Letter and word",
    lookFor:
      "Body height drifting along or between lines; the tails of கு or கூ, or the curl of கீ, out of proportion to the body; signs such as the கொம்பு of கெ much taller or shorter than their consonant. Do not require every Tamil letter to have identical height or width.",
    lookForEn:
      "Compare similar letter bodies across the paragraph and the balance between each body and its extensions. Allow letters their natural differences in width and vertical extent.",
    bands: [
      "ஒத்த எழுத்துகளின் அளவு சீராக உள்ளது; உடற்பகுதியும் நீட்சிகளும் சமநிலையில் உள்ளன.",
      "அளவும் விகிதமும் பெரும்பாலும் சீராக உள்ளன; சிறிய மாற்றங்கள் மட்டும் உள்ளன.",
      "அளவும் விகிதமும் சில இடங்களில் மீண்டும் மீண்டும் மாறுகின்றன.",
      "பல சொற்களில் எழுத்தளவு திடீரென மாறுகிறது; நீட்சிகளின் அளவும் சீராக இல்லை.",
      "பந்தி முழுவதும் எழுத்தளவும் விகிதமும் பெரிதும் மாறுபடுகின்றன.",
    ],
    bandsEn: [
      "Comparable bodies are consistent; extensions remain proportionate.",
      "Size and proportions are mostly steady, with minor variation.",
      "Recurring body-size or proportion changes interrupt consistency.",
      "Frequent size jumps or disproportionate extensions disrupt many words.",
      "Large, pervasive size and proportion changes dominate.",
    ],
  },
  {
    key: "c4",
    code: "C4",
    labelEn: "Spacing within words",
    label: "சொல்லினுள் எழுத்துகளுக்கிடையிலான இடைவெளி",
    scale: "Word",
    lookFor:
      "Letters chained or touching, since Tamil letters are written separately; letters crowded inside a word; false gaps that split one word into two. Judge optical balance, not equal pixel distances; a detached vowel-sign component is not a separate character gap.",
    lookForEn:
      "Judge the visual rhythm between complete written units inside words. Each base and its associated signs form one unit; their internal spacing belongs to C2.",
    bands: [
      "எழுத்துகளுக்கிடையில் இயல்பான சீரான இடைவெளி உள்ளது; நெரிசலோ தேவையற்ற பிரிவோ இல்லை.",
      "சொல்லினுள் இடைவெளி பெரும்பாலும் சீராக உள்ளது; சில சிறிய மாற்றங்கள் உள்ளன.",
      "சில சொற்களில் நெருக்கமான அல்லது அதிகமான இடைவெளிகள் மீண்டும் காணப்படுகின்றன.",
      "பல சொற்களில் எழுத்துகள் நெருங்குகின்றன அல்லது தேவையின்றிப் பிரிந்து காணப்படுகின்றன.",
      "பெரும்பாலான சொற்களில் எழுத்துகள் மோதி அல்லது அதிகமாகப் பிரிந்து காணப்படுகின்றன.",
    ],
    bandsEn: [
      "Internal gaps form an even rhythm without crowding or false splits.",
      "Internal spacing is mostly even, with occasional small variations.",
      "Recurring tight or loose internal gaps interrupt several words.",
      "Frequent crowding or false internal breaks disrupt many words.",
      "Severe crowding or fragmentation dominates within words.",
    ],
  },
  {
    key: "c5",
    code: "C5",
    labelEn: "Spacing between words",
    label: "சொற்களுக்கிடையிலான இடைவெளி",
    scale: "Word and line",
    lookFor:
      "Words run together so the boundary is unclear; word gaps much wider in some places than others; word gaps no wider than the gaps inside words. Do not require a fixed gap or penalise the natural space next to punctuation.",
    lookForEn: "Judge whether word gaps form a steady rhythm and remain visually distinct from gaps within words.",
    bands: [
      "சொற்களின் பிரிவு தெளிவாக உள்ளது; இடைவெளிகள் சீராக அமைந்துள்ளன.",
      "பெரும்பாலான சொற்களுக்கிடையில் சீரான இடைவெளி உள்ளது; சிறிய மாற்றங்கள் உள்ளன.",
      "சில சொற்கள் நெருங்கியும் சில அதிகமாக விலகியும் காணப்படுகின்றன.",
      "பல சொற்கள் ஒன்றோடொன்று நெருங்குகின்றன அல்லது அதிக இடைவெளியால் சிதறிக் காணப்படுகின்றன.",
      "பந்தி முழுவதும் சொற்களின் இடைவெளி பெரிதும் சீரின்றி உள்ளது.",
    ],
    bandsEn: [
      "Word boundaries are distinct and gaps form a steady rhythm.",
      "Word gaps are mostly steady, with minor variations.",
      "Recurring tight and loose word gaps interrupt the line rhythm.",
      "Frequent near-mergers or large gaps disrupt many word boundaries.",
      "Pervasive near-mergers or very large gaps dominate the paragraph.",
    ],
  },
  {
    key: "c6",
    code: "C6",
    labelEn: "Line alignment and orientation consistency",
    label: "வரிகளின் ஒழுங்கும் எழுத்துச் சாய்வின் நிலைத்தன்மையும்",
    scale: "Line",
    lookFor:
      "Letter bodies bouncing above or dropping below the line; lines that rise, fall or wave across the page; slant that changes from word to word, or mixes left and right lean. Tamil is traditionally written upright, but a steady mild slant is not penalised.",
    lookForEn:
      "Judge drift in the line of letter bodies and abrupt changes in letter orientation. Ignore natural upper and lower extensions when estimating the body line.",
    bands: [
      "வரிகள் சீராகச் செல்கின்றன; எழுத்துகளின் சாய்வும் நிலையாக உள்ளது.",
      "சிறிய ஏற்ற இறக்கங்கள் இருந்தாலும் வரி ஒழுங்கும் சாய்வும் பெரும்பாலும் சீராக உள்ளன.",
      "சில வரிகளில் ஏற்ற இறக்கங்களும் சாய்வு மாற்றங்களும் மீண்டும் காணப்படுகின்றன.",
      "பல வரிகளில் எழுத்துகள் மேல்கீழாக நகர்கின்றன அல்லது சாய்வு அடிக்கடி மாறுகிறது.",
      "பந்தி முழுவதும் வரிகளின் போக்கும் எழுத்துச் சாய்வும் பெரிதும் சீர்குலைந்துள்ளன.",
    ],
    bandsEn: [
      "Body lines are steady and letter orientation remains consistent.",
      "Small drifts occur, but alignment and orientation are mostly steady.",
      "Recurring drift or orientation shifts interrupt several line segments.",
      "Frequent body-line drift or orientation changes disrupt many segments.",
      "Severe drift or unstable orientation dominates across lines.",
    ],
  },
  {
    key: "c7",
    code: "C7",
    labelEn: "Line spacing and paragraph layout",
    label: "வரி இடைவெளியும் பந்தி அமைப்பும்",
    scale: "Line and paragraph",
    lookFor:
      "The tails of கு or கூ, or the curl of கீ, touching the line below or above; line gaps that shrink towards the end of the paragraph; a left margin that drifts in or out; writing crushed against the edge of the response area. A ragged right edge and a short final line are normal. Mark N/A if cropping removes margin context.",
    lookForEn:
      "Judge line gaps and clearance, the alignment of line starts, and the balance of the block within its response area. At least two lines and the area boundary are needed.",
    bands: [
      "வரி இடைவெளியும் வரித் தொடக்கங்களும் சீராக உள்ளன; பந்தி சமநிலையுடன் உள்ளது.",
      "வரி இடைவெளியும் ஓரங்களும் பெரும்பாலும் சீராக உள்ளன; சிறிய மாற்றங்கள் மட்டும் உள்ளன.",
      "சில இடங்களில் வரி இடைவெளி அல்லது வரித் தொடக்கங்கள் சீரின்றி உள்ளன.",
      "பல வரிகள் நெருங்கியோ விலகியோ உள்ளன; சில குறிகள் மோதுகின்றன அல்லது பந்தி ஓரத்தை நெருங்குகிறது.",
      "பல இடங்களில் வரிகள் மோதுகின்றன அல்லது சிதறுகின்றன; பந்தியின் அமைப்பு பெரிதும் சீரின்றி உள்ளது.",
    ],
    bandsEn: [
      "Line gaps and line starts are steady; the block is balanced in its area.",
      "Line spacing and margins are mostly steady, with minor changes.",
      "Recurring tight or open line pairs, or shifting line starts, interrupt the block.",
      "Frequent crowding, collisions between lines, start-position shifts or edge crowding disrupt the block.",
      "Widespread collisions, extreme gaps or disordered margins dominate the block.",
    ],
  },
  {
    key: "c8",
    code: "C8",
    labelEn: "Stroke neatness and control",
    label: "எழுத்துக் கீற்றுகளின் நேர்த்தியும் தூய்மையும்",
    scale: "Letter and stroke",
    lookFor:
      "A letter written over itself instead of a clean correction; crossed-out words; shaky or wobbly lines; retraced or doubled strokes; tails and hooks that overshoot where they should stop; blots and stray marks. Ignore pen colour, ink density and scanner shading.",
    lookForEn:
      "Judge whether strokes are steady and clean and the paragraph is free of overwriting, strike-outs and stray marks. Score C1 too only if a letter shape is wrong.",
    bands: [
      "கோடுகள் சீராகவும் தெளிவாகவும் உள்ளன; திருத்தங்களோ மேல் எழுதுதலோ இல்லை.",
      "கோடுகள் பெரும்பாலும் சீராக உள்ளன; ஓரிரு சிறிய திருத்தங்கள் அல்லது நடுக்கம் மட்டும் உள்ளன.",
      "சில இடங்களில் நடுங்கும் கோடுகள், மேல் எழுதுதல் அல்லது அடித்தல்கள் காணப்படுகின்றன.",
      "பல இடங்களில் மேல் எழுதுதல், அடித்தல்கள், கறைகள் அல்லது கட்டுப்பாடற்ற கோடுகள் உள்ளன.",
      "பந்தி முழுவதும் கோடுகள் கட்டுப்பாடின்றியும் திருத்தங்கள் நிறைந்தும் உள்ளன.",
    ],
    bandsEn: [
      "Strokes are steady and clean throughout, with no corrections or stray marks.",
      "Strokes are mostly steady, with one or two small corrections or wobbles.",
      "Recurring shaky strokes, overwriting or strike-outs, but the page still looks orderly.",
      "Frequent overwriting, strike-outs, blots or uncontrolled strokes make the page look untidy.",
      "Uncontrolled strokes and corrections dominate the paragraph.",
    ],
  },
];

export const criterionText = (key: string) => CRITERIA.find((c) => c.key === key) ?? null;

/** Image suitability, recorded on the assessment sheet before scoring (value = stored English tag). */
export const IMAGE_SUITABILITY: { value: string; label: string }[] = [
  { value: "assessable", label: "Assessable" },
  { value: "rescan_needed", label: "Rescan needed" },
  { value: "incomplete", label: "Incomplete writing" },
];

/** Weak-region annotation starts with these criteria in the pilot; C3, C5 and C7 wait until their region types are defined. */
export const REGION_CRITERIA = ["c1", "c2", "c4", "c6", "c8"] as const;

/** Region type per criterion: a written unit, a gap between two units, a line segment or the overwritten mark. */
export const REGION_TYPES: Record<(typeof REGION_CRITERIA)[number], string> = {
  c1: "letter",
  c2: "letter_and_sign",
  c4: "gap",
  c6: "line_segment",
  c8: "mark",
};

export const CONFIDENCE: { value: "low" | "medium" | "high"; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const WEAKNESS_Q = "முக்கியமான காட்சி குறையும் அதன் இடமும்";
export const COMMENT_Q = "இந்தக் கையெழுத்தின் தோற்றத்தைப் பாதிக்கும் வேறு ஏதேனும் உள்ளதா?";

/**
 * Weak-region issue tags per criterion (value = stored English tag). The rubric document gives no closed list,
 * so these are a first draft taken from each criterion's look-fors; a native Tamil reviewer must check them.
 */
export const ISSUE_TAGS: Record<string, { value: string; label: string }[]> = {
  c1: [
    { value: "part_missing", label: "உறுப்பு விடுபட்டுள்ளது" },
    { value: "extra_part", label: "தேவையற்ற பகுதி" },
    { value: "curve_loop_distorted", label: "வளைவு / சுழி சிதைந்துள்ளது" },
    { value: "looks_like_other", label: "வேறு எழுத்தைப் போலத் தோன்றுகிறது" },
    { value: "inconsistent_form", label: "ஒரே எழுத்து வேறு வடிவில்" },
  ],
  c2: [
    { value: "pulli_misplaced", label: "புள்ளி தவறான இடத்தில்" },
    { value: "pulli_wrong_size", label: "புள்ளி மிகப் பெரியது / வெற்று" },
    { value: "sign_misplaced", label: "உயிர்க்குறி தவறான இடத்தில்" },
    { value: "sign_wrong_size", label: "குறி தவறான அளவில்" },
    { value: "sign_drifts", label: "குறி அடுத்த எழுத்தை நெருங்குகிறது" },
    { value: "two_part_split", label: "இரு பகுதிக் குறி (கொ, கோ, கௌ) விலகியுள்ளது" },
  ],
  c3: [
    { value: "body_size_jump", label: "எழுத்தளவு திடீரென மாறுகிறது" },
    { value: "extension_disproportionate", label: "நீட்சி (கு, கூ, கீ) விகிதமின்றி" },
    { value: "sign_height_off", label: "குறியின் உயரம் பொருந்தவில்லை" },
  ],
  c4: [
    { value: "letters_touching", label: "எழுத்துகள் தொடுகின்றன / இணைந்துள்ளன" },
    { value: "letters_crowded", label: "எழுத்துகள் நெருக்கமாக" },
    { value: "false_gap", label: "சொல்லினுள் தேவையற்ற இடைவெளி" },
  ],
  c5: [
    { value: "words_run_together", label: "சொற்கள் ஒன்றோடொன்று இணைகின்றன" },
    { value: "word_gap_too_small", label: "சொல் இடைவெளி மிகக் குறைவு" },
    { value: "word_gap_too_large", label: "சொல் இடைவெளி மிக அதிகம்" },
  ],
  c6: [
    { value: "above_line", label: "வரிக்கு மேலே எழுகிறது" },
    { value: "below_line", label: "வரிக்குக் கீழே இறங்குகிறது" },
    { value: "line_drifts", label: "வரி ஏறுகிறது / இறங்குகிறது / அலைகிறது" },
    { value: "slant_changes", label: "சாய்வு மாறுகிறது" },
  ],
  c7: [
    { value: "lines_collide", label: "வரிகள் மோதுகின்றன" },
    { value: "line_gap_uneven", label: "வரி இடைவெளி சீரில்லை" },
    { value: "margin_drifts", label: "இடது ஓரம் நகர்கிறது" },
    { value: "edge_crowding", label: "எழுதும் பகுதியின் ஓரத்தை நெருங்குகிறது" },
  ],
  c8: [
    { value: "overwritten", label: "மேல் எழுதப்பட்டுள்ளது" },
    { value: "struck_out", label: "அடிக்கப்பட்ட சொல்" },
    { value: "shaky_stroke", label: "நடுங்கும் கோடு" },
    { value: "retraced", label: "மீண்டும் வரைந்த கோடு" },
    { value: "overshoot", label: "வால் / கொக்கி அதிகமாக நீள்கிறது" },
    { value: "blot", label: "கறை / தேவையற்ற குறி" },
  ],
};

/** Tamil boxes have no letter-part list (the Sinhala A1 parts don't carry over). */
export const PARTS: { value: string; label: string }[] = [];

/** Flags for boxes that are not about one criterion. Decoration is excluded from the Tamil judgement, so it has no flag. */
export const FLAGS: { value: "illegible" | "correction" | "copy_error"; label: string }[] = [
  { value: "illegible", label: "வாசிக்க இயலாத எழுத்து" },
  { value: "correction", label: "அடித்தல் / திருத்தம்" },
  { value: "copy_error", label: "நகல் பிழை (தவறான / விடுபட்ட எழுத்து அல்லது குறி)" },
];

export const SEVERITY = {
  2: "சாதாரண தூரத்தில் தெளிவாகத் தெரிகிறது",
  3: "சொல்லையோ வரியையோ பாதிக்கிறது",
} as const;

/** English labels for the same tags, flags and severity levels (the form's English view). */
export const ISSUE_TAGS_EN: Record<string, { value: string; label: string }[]> = {
  c1: [
    { value: "part_missing", label: "Component missing" },
    { value: "extra_part", label: "Unnecessary component" },
    { value: "curve_loop_distorted", label: "Curve / loop distorted" },
    { value: "looks_like_other", label: "Looks like another letter" },
    { value: "inconsistent_form", label: "Same letter written differently" },
  ],
  c2: [
    { value: "pulli_misplaced", label: "Pulli misplaced" },
    { value: "pulli_wrong_size", label: "Pulli oversized / hollow" },
    { value: "sign_misplaced", label: "Vowel sign misplaced" },
    { value: "sign_wrong_size", label: "Sign wrong size" },
    { value: "sign_drifts", label: "Sign drifts towards the next letter" },
    { value: "two_part_split", label: "Two-part sign (கொ, கோ, கௌ) split" },
  ],
  c3: [
    { value: "body_size_jump", label: "Sudden size change" },
    { value: "extension_disproportionate", label: "Tail (கு, கூ, கீ) out of proportion" },
    { value: "sign_height_off", label: "Sign height does not match" },
  ],
  c4: [
    { value: "letters_touching", label: "Letters touching / chained" },
    { value: "letters_crowded", label: "Letters crowded" },
    { value: "false_gap", label: "False gap inside the word" },
  ],
  c5: [
    { value: "words_run_together", label: "Words run together" },
    { value: "word_gap_too_small", label: "Word gap too small" },
    { value: "word_gap_too_large", label: "Word gap too large" },
  ],
  c6: [
    { value: "above_line", label: "Rises above the line" },
    { value: "below_line", label: "Drops below the line" },
    { value: "line_drifts", label: "Line rises / falls / waves" },
    { value: "slant_changes", label: "Slant changes" },
  ],
  c7: [
    { value: "lines_collide", label: "Lines collide" },
    { value: "line_gap_uneven", label: "Uneven line gaps" },
    { value: "margin_drifts", label: "Left margin drifts" },
    { value: "edge_crowding", label: "Crowds the edge of the area" },
  ],
  c8: [
    { value: "overwritten", label: "Overwritten" },
    { value: "struck_out", label: "Struck-out word" },
    { value: "shaky_stroke", label: "Shaky stroke" },
    { value: "retraced", label: "Retraced stroke" },
    { value: "overshoot", label: "Tail / hook overshoots" },
    { value: "blot", label: "Blot / stray mark" },
  ],
};

export const FLAGS_EN: typeof FLAGS = [
  { value: "illegible", label: "Illegible letter" },
  { value: "correction", label: "Strike-out / correction" },
  { value: "copy_error", label: "Copying error (wrong / missing letter or sign)" },
];

export const SEVERITY_EN = {
  2: "Clearly visible at normal viewing distance",
  3: "Spoils the word or line",
} as const;
