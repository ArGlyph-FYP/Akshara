import type { ReactNode } from "react";
import type { Script } from "../types";
import * as si from "./si";
import * as ta from "./ta";
import type { Bands, ScoreQuestion } from "./si";

/** Everything the main-study form shows that depends on the script: rubric text, box tags and the form's own wording. */
export interface FormRubric {
  instructions: string[];
  bandHowto: string;
  bandNames: Bands;
  overall: ScoreQuestion;
  legibility: ScoreQuestion;
  /** Tamil asks L1 straight after H1; Sinhala asks L after the criteria. */
  legibilityFirst: boolean;
  criteriaIntro: string;
  criterionText: (key: string) => { code: string; label: string; lookFor: string; bands: Bands } | null;
  commentQ: string;
  /** Sinhala only: decoration (D) and crossings-out questions. */
  extras: { decoration: typeof si.DECORATION_Q; alterations: typeof si.ALTERATIONS_Q } | null;
  issueTags: Record<string, { value: string; label: string }[]>;
  /** Criterion key whose boxes can record a letter part, and the parts. */
  partsKey: string | null;
  parts: { value: string; label: string }[];
  flags: { value: string; label: string }[];
  severity: Record<2 | 3, string>;
  ui: FormUi;
}

export interface FormUi {
  calibration: string;
  block: (n: number) => string;
  paragraph: (at: number, of: number) => string;
  help: string;
  blockChanged: ReactNode;
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
  bandHowto: si.BAND_HOWTO,
  bandNames: si.BAND_NAMES,
  overall: si.OVERALL,
  legibility: si.LEGIBILITY,
  legibilityFirst: false,
  criteriaIntro: si.CRITERIA_INTRO,
  criterionText: si.criterionText,
  commentQ: si.COMMENT_Q,
  extras: { decoration: si.DECORATION_Q, alterations: si.ALTERATIONS_Q },
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
    moreFlags: "+ වෙනත් ලකුණු (කියවිය නොහැකි අකුර, කපා හැරීම, සැරසිලි…)",
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

/** Tamil form wording is a first draft; a native Tamil reviewer must check it before the pilot. */
const TA: FormRubric = {
  instructions: ta.INSTRUCTIONS,
  bandHowto: ta.BAND_HOWTO,
  bandNames: ta.BAND_NAMES,
  overall: ta.OVERALL,
  legibility: ta.LEGIBILITY,
  legibilityFirst: true,
  criteriaIntro: ta.CRITERIA_INTRO,
  criterionText: ta.criterionText,
  commentQ: ta.COMMENT_Q,
  extras: null,
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
    draw: "குறைபாடுள்ள பகுதியைக் குறிக்கவும்",
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

export const formRubric = (script: Script): FormRubric => (script === "ta" ? TA : SI);
