import type { ReactNode } from "react";
import type { Script } from "../types";
import * as si from "./si";
import * as ta from "./ta";
import type { Bands, ScoreQuestion } from "./si";

/** One short block of the help dialog: a code badge (H1, L1, C1–C8…), a title and a few short points. */
export interface HelpGroup {
  code: string;
  /** Card colour (strip, tint, badge and title). */
  color: string;
  title: string;
  points: string[];
}

/** A short hint under the scan toolbar, shown as an icon chip. */
export interface Hint {
  icon: "zoom" | "drag" | "draw" | "optional";
  text: string;
}

/**
 * Sinhala v12: criteria answered by picking one described option (five levels, or four for A6a–A6c) instead of 1–10,
 * with "not applicable", copy_error / unscorable boxes and the problem-to-criterion table in the help.
 */
export interface ChoiceRubric {
  criterion: (key: string) => si.SiCriterion | null;
  options: (key: string) => si.Option[];
  group: typeof si.A6_GROUP;
  na: string;
  copyError: typeof si.COPY_ERROR_Q;
  unscorable: typeof si.UNSCORABLE_Q;
  required: string;
  withinBand: string;
  problemTitle: string;
  problemMap: typeof si.PROBLEM_MAP;
  problemNote: string;
  tieBreaksTitle: string;
  tieBreaks: string[];
}

/** Everything the main-study form shows that depends on the script: rubric text, box tags and the form's own wording. */
export interface FormRubric {
  instructions: string[];
  /** When set, the help dialog shows these short groups instead of the instruction list. */
  helpGroups: HelpGroup[] | null;
  bandHowto: string;
  bandNames: Bands;
  overall: ScoreQuestion;
  legibility: ScoreQuestion;
  /** Ask L straight after O (both rubrics do now). */
  legibilityFirst: boolean;
  criteriaIntro: string;
  /** `bands` is null for choice criteria (Sinhala v12), which take their options from `choices`. */
  criterionText: (key: string) => { code: string; label: string; lookFor: string; bands: Bands | null } | null;
  commentQ: string;
  /** Sinhala v12 choice criteria and extra boxes; null for 1–10 criteria (Tamil). */
  choices: ChoiceRubric | null;
  issueTags: Record<string, { value: string; label: string }[]>;
  /** Criterion key whose boxes can record a letter part, and the parts. */
  partsKey: string | null;
  parts: { value: string; label: string }[];
  flags: { value: string; label: string }[];
  severity: Record<2 | 3, string>;
  /** When set, the scan hints show as icon chips (move mode / draw mode) instead of the hint sentence. */
  hints: { move: Hint[]; draw: Hint[] } | null;
  ui: FormUi;
}

export interface FormUi {
  calibration: string;
  block: (n: number) => string;
  paragraph: (at: number, of: number) => string;
  help: string;
  blockChanged: ReactNode;
  /** Label of the Move / zoom tool button. */
  move: string;
  draw: string;
  showBoxes: string;
  hideBoxes: string;
  opacity: string;
  drawPrompt: string;
  hintDraw: string;
  hintMove: string;
  removedAll: string;
  removedOne: string;
  missing: string;
  weakTitle: string;
  weakHint: string;
  clearAll: string;
  severity: string;
  clearBox: string;
  optional: string;
  finish: string;
  next: string;
  helpTitle: string;
  /** Label of the button that switches the form to the other language (only shown when the script has an English view). */
  switchLang: string;
  start: string;
  calTitle: string;
  calBody: (you: { overall: ReactNode; legibility: ReactNode }, ref: { overall: ReactNode; legibility: ReactNode }) => ReactNode;
  continue: string;
  lookFor: string;
  details: string;
  moreFlags: string;
  show: string;
  hide: string;
  layers: string;
  layersOpen: string;
  layersOpenTitle: string;
  layersFold: string;
  layersFoldTitle: string;
  noBoxes: string;
  allShow: string;
  allHide: string;
  layerShow: string;
  layerHide: string;
  noLayers: string;
  whatAbout: string;
  changeCriterion: string;
  issue: string;
  part: string;
  note: string;
  ok: string;
}

const SI: FormRubric = {
  instructions: si.INSTRUCTIONS,
  helpGroups: null,
  hints: null,
  bandHowto: si.BAND_HOWTO,
  bandNames: si.BAND_NAMES,
  overall: si.OVERALL,
  legibility: si.LEGIBILITY,
  // v12 order: O, L, then A1–A8.
  legibilityFirst: true,
  criteriaIntro: si.CRITERIA_INTRO,
  criterionText: (key) => {
    const c = si.criterionText(key);
    return c && { code: c.code, label: c.label, lookFor: c.lookFor, bands: null };
  },
  commentQ: si.COMMENT_Q,
  choices: {
    criterion: si.criterionText,
    options: (key) => {
      const c = si.criterionText(key);
      return c ? si.optionsFor(c) : [];
    },
    group: si.A6_GROUP,
    na: si.NA_LABEL,
    copyError: si.COPY_ERROR_Q,
    unscorable: si.UNSCORABLE_Q,
    required: "(අනිවාර්යයි)",
    withinBand: si.WITHIN_BAND_HOWTO,
    problemTitle: "ගැටලුවක් අයත් වන්නේ කුමන නිර්ණායකයටද?",
    problemMap: si.PROBLEM_MAP,
    problemNote: si.PROBLEM_MAP_NOTE,
    tieBreaksTitle: "ඉක්මන් තීරණ",
    tieBreaks: si.TIE_BREAKS,
  },
  issueTags: si.ISSUE_TAGS,
  partsKey: "a1",
  parts: si.PARTS,
  flags: si.FLAGS,
  severity: si.SEVERITY,
  ui: {
    calibration: "ක්‍රමාංකන ඡේදය",
    block: (n) => `පාඨය ${n}`,
    paragraph: (at, of) => `ඡේදය ${at} / ${of}`,
    help: "උපදෙස්",
    blockChanged: (
      <>
        මෙතැන් සිට ඇත්තේ <b>වෙනත් පාඨයකි (පාඨය 2)</b>. එකම පාඨය විවිධ අය ලියූ ඡේද ඔබට පෙනේ.
      </>
    ),
    move: "Move",
    draw: "දුර්වල තැනක් සලකුණු කරන්න",
    showBoxes: "කොටු පෙන්වන්න",
    hideBoxes: "කොටු සඟවන්න",
    opacity: "කොටුවල පැහැදිලිකම",
    drawPrompt: "කුමක් ගැනද? තෝරා, රූපයේ දුර්වල තැන වටා කොටුවක් අඳින්න.",
    hintDraw: "Move තෝරා රූපය ඇදගෙන යන්න. Zoom කිරීමට + / − බොත්තම් හෝ ඇඟිලි දෙක භාවිත කරන්න.",
    hintMove: "අනිවාර්ය නොවේ. Zoom කිරීමට + / − බොත්තම් හෝ ඇඟිලි දෙක භාවිත කරන්න; රූපය ඇදගෙන යා හැක.",
    removedAll: "කොටු සියල්ල ඉවත් කළා",
    removedOne: "කොටුව ඉවත් කළා",
    missing: "තවම පිළිතුරු නොදුන්: ",
    weakTitle: "දුර්වල තැන්",
    weakHint: "— එකක් tap කර විස්තර තෝරන්න",
    clearAll: "සියල්ල clear කරන්න",
    severity: "බරපතලකම",
    clearBox: "කොටුව clear කරන්න",
    optional: "(අනිවාර්ය නොවේ)",
    finish: "අවසන් කරන්න",
    next: "ඊළඟ",
    helpTitle: "ඇගයීමට පෙර කියවන්න",
    switchLang: "English",
    start: "හරි, ආරම්භ කරමු",
    calTitle: "ක්‍රමාංකන යොමුව",
    calBody: (you, ref) => (
      <>
        ඔබ සමස්ත අලංකාරයට <b>{you.overall}</b> සහ කියවීමේ පහසුවට <b>{you.legibility}</b> දුන්නා. පර්යේෂණ කණ්ඩායමේ යොමු ලකුණු: සමස්ත
        අලංකාරය <b>{ref.overall}</b>, කියවීමේ පහසුව <b>{ref.legibility}</b>.
      </>
    ),
    continue: "ඉදිරියට",
    lookFor: "බලන්න",
    details: "විස්තර",
    moreFlags: "+ වෙනත් ලකුණු (කියවිය නොහැකි අකුර, පිටපත් කිරීමේ වැරැද්ද, කපා හැරීම)",
    show: "පෙන්වන්න",
    hide: "සඟවන්න",
    layers: "ස්ථර",
    layersOpen: "ස්ථර පෙන්වන්න",
    layersOpenTitle: "ස්ථර (layers) පෙන්වන්න",
    layersFold: "ස්ථර හකුළන්න",
    layersFoldTitle: "හකුළන්න (scan එක ලොකු කරන්න)",
    noBoxes: "කොටු නැත",
    allShow: "සියලු කොටු පෙන්වන්න",
    allHide: "සියලු කොටු සඟවන්න",
    layerShow: "මෙම ස්ථරය පෙන්වන්න",
    layerHide: "මෙම ස්ථරය සඟවන්න",
    noLayers: "කොටු තවම නැත. ඔබ අඳින කොටු මෙහි ස්ථර ලෙස පෙනේ.",
    whatAbout: "කුමක් ගැනද?",
    changeCriterion: "නිර්ණායකය වෙනස් කරන්න",
    issue: "ගැටලුව",
    part: "අකුරේ කොටස (අනිවාර්ය නොවේ)",
    note: "සටහන (අනිවාර්ය නොවේ)",
    ok: "හරි",
  },
};

/** The Tamil rater instructions, shortened and grouped so the help dialog reads at a glance (Tamil and English). */
const TA_HELP: (HelpGroup & { titleEn: string; pointsEn: string[] })[] = [
  {
    code: "1",
    color: "#64748b",
    title: "தொடங்கும் முன்",
    titleEn: "Before you start",
    points: ["முதலில் முழுப் பந்தியையும் பாருங்கள்; பின்னர் பெரிதாக்கலாம்.", "உங்கள் சொந்தக் கையெழுத்தை மதிப்பிட வேண்டாம்."],
    pointsEn: ["Look at the whole paragraph first, then zoom.", "Do not rate your own writing."],
  },
  {
    code: "H1",
    color: "#4f46e5",
    title: "முழுமையான அழகு",
    titleEn: "Overall beauty",
    points: ["முதல் பார்வையில் தோன்றுவதை வைத்து H1 வழங்குங்கள்.", "பின்னர் அதை மாற்ற வேண்டாம்."],
    pointsEn: ["Give H1 from your first impression.", "Do not change it afterwards."],
  },
  {
    code: "L1",
    color: "#059669",
    title: "வாசிப்புத் தெளிவு",
    titleEn: "Legibility",
    points: ["அழகைப் பொருட்படுத்தாமல், எவ்வளவு எளிதாக வாசிக்க முடிகிறது என்பதை மட்டும் மதிப்பிடுங்கள்."],
    pointsEn: ["Rate only how easy it is to read, not how beautiful it is."],
  },
  {
    code: "C1–C8",
    color: "#d97706",
    title: "எட்டு அளவுகோல்கள்",
    titleEn: "Eight criteria",
    points: [
      "ஒவ்வொன்றையும் தனித்தனியாக, முழுப் பந்தியையும் வைத்து மதிப்பிடுங்கள்.",
      "ஒரு சிறிய குறைக்காக 1 அல்லது 2 வழங்க வேண்டாம்.",
      "9–10 வழங்க முழுமை தேவையில்லை.",
    ],
    pointsEn: [
      "Rate each one separately, across the whole paragraph.",
      "One small defect is not a reason for 1 or 2.",
      "9–10 does not require perfection.",
    ],
  },
  {
    code: "✕",
    color: "#dc2626",
    title: "கவனிக்க வேண்டாதவை",
    titleEn: "What to ignore",
    points: ["எழுத்துப்பிழை, பொருள், பேனா நிறம், காகிதம், அலங்காரம்.", "கிரந்த எழுத்துகள் உட்பட ஏற்கப்பட்ட கையெழுத்து வடிவங்கள் பிழை அல்ல."],
    pointsEn: ["Spelling, meaning, pen colour, paper and decoration.", "Accepted handwritten variants, including Grantha letters, are not errors."],
  },
];

/** Tamil form wording is a first draft; a native Tamil reviewer must check it before the pilot. */
const TA: FormRubric = {
  instructions: ta.INSTRUCTIONS,
  helpGroups: TA_HELP.map(({ code, color, title, points }) => ({ code, color, title, points })),
  hints: {
    move: [
      { icon: "zoom", text: "அளவை மாற்ற: + / − அல்லது இரு விரல்கள்" },
      { icon: "drag", text: "இழுத்து நகர்த்தவும்" },
      { icon: "optional", text: "குறிப்பது கட்டாயமில்லை" },
    ],
    draw: [
      { icon: "draw", text: "இழுத்துப் பெட்டி வரையவும்" },
      { icon: "drag", text: "நகர்த்த: நகர்த்து" },
      { icon: "zoom", text: "அளவை மாற்ற: + / − அல்லது இரு விரல்கள்" },
    ],
  },
  bandHowto: "முதலில் பொருந்தும் பிரிவைத் தேர்ந்தெடுங்கள்; பின்னர் அதில் குறைந்த அல்லது உயர்ந்த எண்ணைத் தேர்ந்தெடுங்கள்.",
  bandNames: ta.BAND_NAMES,
  overall: ta.OVERALL,
  legibility: ta.LEGIBILITY,
  legibilityFirst: true,
  criteriaIntro: ta.CRITERIA_INTRO,
  criterionText: ta.criterionText,
  commentQ: ta.COMMENT_Q,
  choices: null,
  issueTags: ta.ISSUE_TAGS,
  partsKey: null,
  parts: ta.PARTS,
  flags: ta.FLAGS,
  severity: ta.SEVERITY,
  ui: {
    calibration: "அளவுத்திருத்தப் பந்தி",
    block: (n) => `உரை ${n}`,
    paragraph: (at, of) => `பந்தி ${at} / ${of}`,
    help: "வழிமுறைகள்",
    blockChanged: (
      <>
        இங்கிருந்து <b>வேறு ஒரு உரை (உரை 2)</b> வருகிறது. ஒரே உரையைப் பலர் எழுதிய பந்திகளைக் காண்பீர்கள்.
      </>
    ),
    move: "நகர்த்து",
    draw: "மேம்பாட்டைக் குறிக்கவும்",
    showBoxes: "பெட்டிகளைக் காட்டு",
    hideBoxes: "பெட்டிகளை மறை",
    opacity: "பெட்டிகளின் தெளிவு",
    drawPrompt: "எதைப் பற்றி? தேர்ந்தெடுத்து, படத்தில் குறைபாடுள்ள பகுதியைச் சுற்றி ஒரு பெட்டி வரையவும்.",
    hintDraw: "படத்தை நகர்த்த Move-ஐத் தேர்ந்தெடுக்கவும். பெரிதாக்க + / − பொத்தான்களை அல்லது இரண்டு விரல்களைப் பயன்படுத்தவும்.",
    hintMove: "கட்டாயமில்லை. பெரிதாக்க + / − பொத்தான்களை அல்லது இரண்டு விரல்களைப் பயன்படுத்தவும்; படத்தை இழுத்து நகர்த்தலாம்.",
    removedAll: "எல்லாப் பெட்டிகளும் நீக்கப்பட்டன",
    removedOne: "பெட்டி நீக்கப்பட்டது",
    missing: "இன்னும் பதிலளிக்கவில்லை: ",
    weakTitle: "குறைபாடுள்ள பகுதிகள்",
    weakHint: "— ஒன்றைத் தட்டி விவரங்களைத் தேர்ந்தெடுக்கவும்",
    clearAll: "எல்லாவற்றையும் நீக்கு",
    severity: "தீவிரம்",
    clearBox: "பெட்டியை நீக்கு",
    optional: "(கட்டாயமில்லை)",
    finish: "முடிக்கவும்",
    next: "அடுத்து",
    helpTitle: "மதிப்பிடுவதற்கு முன் படிக்கவும்",
    switchLang: "English",
    start: "சரி, தொடங்குவோம்",
    calTitle: "அளவுத்திருத்தக் குறிப்பு",
    calBody: (you, ref) => (
      <>
        நீங்கள் அழகுக்கு (H1) <b>{you.overall}</b>, வாசிப்புத் தெளிவுக்கு (L1) <b>{you.legibility}</b> வழங்கினீர்கள். ஆய்வுக் குழுவின்
        குறிப்பு மதிப்பெண்கள்: H1 <b>{ref.overall}</b>, L1 <b>{ref.legibility}</b>.
      </>
    ),
    continue: "தொடரவும்",
    lookFor: "கவனிக்க",
    details: "விவரம்",
    moreFlags: "+ வேறு குறிகள் (வாசிக்க இயலாத எழுத்து, அடித்தல், நகல் பிழை…)",
    show: "காட்டு",
    hide: "மறை",
    layers: "அடுக்குகள்",
    layersOpen: "அடுக்குகளைக் காட்டு",
    layersOpenTitle: "அடுக்குகளை (layers) காட்டு",
    layersFold: "அடுக்குகளைச் சுருக்கு",
    layersFoldTitle: "சுருக்கு (படத்தைப் பெரிதாக்க)",
    noBoxes: "பெட்டிகள் இல்லை",
    allShow: "எல்லாப் பெட்டிகளையும் காட்டு",
    allHide: "எல்லாப் பெட்டிகளையும் மறை",
    layerShow: "இந்த அடுக்கைக் காட்டு",
    layerHide: "இந்த அடுக்கை மறை",
    noLayers: "இன்னும் பெட்டிகள் இல்லை. நீங்கள் வரையும் பெட்டிகள் இங்கே அடுக்குகளாகத் தோன்றும்.",
    whatAbout: "எதைப் பற்றி?",
    changeCriterion: "அளவுகோலை மாற்று",
    issue: "குறைபாடு",
    part: "எழுத்தின் பகுதி (கட்டாயமில்லை)",
    note: "குறிப்பு (கட்டாயமில்லை)",
    ok: "சரி",
  },
};

/** The Tamil form in English, for raters who switch language. Codes, colours and stored values are the same as TA. */
const TA_EN: FormRubric = {
  ...TA,
  helpGroups: TA_HELP.map(({ code, color, titleEn, pointsEn }) => ({ code, color, title: titleEn, points: pointsEn })),
  hints: {
    move: [
      { icon: "zoom", text: "Zoom: + / − or pinch" },
      { icon: "drag", text: "Drag to move" },
      { icon: "optional", text: "Marking is optional" },
    ],
    draw: [
      { icon: "draw", text: "Drag to draw a box" },
      { icon: "drag", text: "To move: Move" },
      { icon: "zoom", text: "Zoom: + / − or pinch" },
    ],
  },
  bandHowto: "First choose the band whose description fits the paragraph, then choose its lower or higher number.",
  bandNames: ta.BAND_NAMES_EN,
  overall: {
    ...ta.OVERALL,
    label: "Overall handwriting aesthetics",
    question: "How visually pleasing is this paragraph as a whole?",
    help: "Record H1 first and do not change it afterwards.",
    bands: ta.OVERALL_BANDS_EN,
  },
  legibility: {
    ...ta.LEGIBILITY,
    label: "Legibility",
    question: "How easily can you read the handwriting without using the reference passage?",
    help: "Rate it separately from aesthetics.",
    bands: ta.LEGIBILITY_BANDS_EN,
  },
  criteriaIntro: "Give one score for each criterion.",
  // For C2–C8 the rubric's look-for examples are already in English (`lookFor`), so they follow the description.
  criterionText: (key) => {
    const c = ta.criterionText(key);
    return c && { code: c.code, label: c.labelEn, lookFor: key === "c1" ? c.lookForEn : `${c.lookForEn} ${c.lookFor}`, bands: c.bandsEn };
  },
  commentQ: "Is there anything else that affects how this handwriting looks?",
  issueTags: ta.ISSUE_TAGS_EN,
  flags: ta.FLAGS_EN,
  severity: ta.SEVERITY_EN,
  ui: {
    calibration: "Calibration paragraph",
    block: (n) => `Text ${n}`,
    paragraph: (at, of) => `Paragraph ${at} / ${of}`,
    help: "Instructions",
    blockChanged: (
      <>
        From here on it is <b>a different text (text 2)</b>. You will see the same text written by different people.
      </>
    ),
    move: "Move",
    draw: "Mark a weak area",
    showBoxes: "Show boxes",
    hideBoxes: "Hide boxes",
    opacity: "Box visibility",
    drawPrompt: "About what? Choose, then draw a box around the weak area on the scan.",
    hintDraw: "Choose Move to drag the scan. Zoom with the + / − buttons or two fingers.",
    hintMove: "Optional. Zoom with the + / − buttons or two fingers; you can drag the scan.",
    removedAll: "All boxes removed",
    removedOne: "Box removed",
    missing: "Not answered yet: ",
    weakTitle: "Weak areas",
    weakHint: "— tap one to choose details",
    clearAll: "Clear all",
    severity: "Severity",
    clearBox: "Clear box",
    optional: "(optional)",
    finish: "Finish",
    next: "Next",
    helpTitle: "Read before rating",
    switchLang: "தமிழ்",
    start: "OK, let’s start",
    calTitle: "Calibration reference",
    calBody: (you, ref) => (
      <>
        You gave <b>{you.overall}</b> for overall beauty (H1) and <b>{you.legibility}</b> for legibility (L1). The research team&rsquo;s
        reference scores: H1 <b>{ref.overall}</b>, L1 <b>{ref.legibility}</b>.
      </>
    ),
    continue: "Continue",
    lookFor: "Look for",
    details: "Details",
    moreFlags: "+ Other marks (illegible letter, strike-out, copying error…)",
    show: "Show",
    hide: "Hide",
    layers: "Layers",
    layersOpen: "Show layers",
    layersOpenTitle: "Show layers",
    layersFold: "Fold layers",
    layersFoldTitle: "Fold (make the scan bigger)",
    noBoxes: "no boxes",
    allShow: "Show all boxes",
    allHide: "Hide all boxes",
    layerShow: "Show this layer",
    layerHide: "Hide this layer",
    noLayers: "No boxes yet. The boxes you draw appear here as layers.",
    whatAbout: "About what?",
    changeCriterion: "Change criterion",
    issue: "Issue",
    part: "Letter part (optional)",
    note: "Note (optional)",
    ok: "OK",
  },
};

export const formRubric = (script: Script): FormRubric => (script === "ta" ? TA : SI);

/** The form in English, for scripts that have one (Tamil); null hides the language switch. */
export const formRubricEnglish = (script: Script): FormRubric | null => (script === "ta" ? TA_EN : null);
