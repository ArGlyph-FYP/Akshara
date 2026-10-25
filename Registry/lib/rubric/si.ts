/**
 * Akshara aesthetic rating rubric v1 (24 Oct 2026), rater-facing Sinhala text.
 * Draft translation: a native speaker must proofread it and Dr. Samarawickrama review it before the pilot.
 * Issue-tag and part names (weak-region boxes) are a first Sinhala draft and also need proofreading.
 * Codes (O, A1–A8, L, D) and stored values stay in English so exports line up with the rubric document.
 */

/** Five bands, best first: 9–10, 7–8, 5–6, 3–4, 1–2. */
export type Bands = [string, string, string, string, string];

export const BAND_NAMES: Bands = ["විශිෂ්ටයි", "හොඳයි", "සාමාන්‍යයි", "දුර්වලයි", "ඉතා දුර්වලයි"];
export const BAND_RANGES = ["9–10", "7–8", "5–6", "3–4", "1–2"] as const;

/** Index into a Bands tuple for a 1–10 score. */
export const bandIndex = (score: number) => (score >= 9 ? 0 : score >= 7 ? 1 : score >= 5 ? 2 : score >= 3 ? 3 : 4);

export interface ScoreQuestion {
  code: string;
  label: string;
  question: string;
  help: string;
  bands: Bands;
  low: string;
  high: string;
}

export interface CriterionText {
  /** Matches Criterion.key in Firestore (a1…a8). */
  key: string;
  code: string;
  labelEn: string;
  label: string;
  lookFor: string;
  bands: Bands;
}

export const INSTRUCTIONS: string[] = [
  "ඔබට පෙන්වන්නේ එක් අයෙකු ලියූ අත් අකුරු ඡේදයකි.",
  "ඔබ ඇගයිය යුත්තේ අත් අකුරු පෙනුමෙන් කෙතරම් ලස්සනද යන්නයි. අක්ෂර වින්‍යාසය, අන්තර්ගතය හෝ අර්ථය ගැන නොසලකන්න.",
  "1 සිට 10 දක්වා සම්පූර්ණ පරාසයම භාවිත කරන්න. 5–6 යනු සාමාන්‍ය වැඩිහිටි අත් අකුරකි.",
  "පාසලේ උගන්වන අකුරු ආකෘතියට සමාන වීම පමණක් වැඩි ලකුණු දීමට හේතුවක් නොවේ. ස්ථාවර, හොඳින් සැකසූ පෞද්ගලික ශෛලියක් දෝෂයක් නොවේ.",
  "කඩදාසිය, ස්කෑන් කිරීමේ ගුණාත්මකභාවය සහ පෑනේ වර්ණය නොසලකා හරින්න.",
  "ඔබේම, ඔබේ පවුලේ අයගේ හෝ මිතුරන්ගේ අත් අකුරු හඳුනාගත හොත්, එම ඡේදය ඇගයීමට ලක් නොකර skip කරන්න.",
  "එක දිගට ඡේද 30කට වඩා ඇගයීමෙන් වළකින්න. අවශ්‍ය නම් විවේක ගන්න.",
];

export const BAND_HOWTO = "පළමුව විස්තර අනුව ගැළපෙන කාණ්ඩය තෝරා, ඉන්පසු එම කාණ්ඩයේ අඩු හෝ වැඩි අංකය තෝරන්න.";

export const OVERALL: ScoreQuestion = {
  code: "O",
  label: "සමස්ත අලංකාරය",
  question: "මුළු ඡේදයම එක වර බලන්න. මෙම අත් අකුරු සමස්තයක් ලෙස ඔබට කෙතරම් ලස්සන ලෙස පෙනේද?",
  help: "ඡේදය මුළුමනින්ම තිරයේ පෙනෙන සේ තබා, ඔබේ මුල් හැඟීම අනුව (තත්පර 10ක් පමණ) ලකුණු දෙන්න. ලකුණ දුන් පසු එය වෙනස් නොකරන්න.",
  bands: [
    "ආදර්ශයක් ලෙස පෙන්විය හැකි තරම් ලස්සන අත් අකුරු",
    "පැහැදිලිවම ප්‍රසන්නයි; ඉතා සමීපව බැලූ විට පමණක් කුඩා අඩුපාඩු පෙනේ",
    "සාමාන්‍ය එදිනෙදා අත් අකුරු; විශේෂයෙන් හොඳ හෝ නරක දෙයක් කැපී පෙනෙන්නේ නැත",
    "තැනින් තැන අපිළිවෙළයි; අඩුපාඩු ඇසට හසු වේ",
    "නොසැලකිලිමත් හෝ අවුල් සහගතයි; බැලීමට අප්‍රසන්නයි",
  ],
  low: "ඉතා දුර්වලයි",
  high: "විශිෂ්ටයි",
};

export const LEGIBILITY: ScoreQuestion = {
  code: "L",
  label: "කියවීමේ පහසුව",
  question: "ලස්සන බව ගැන නොසලකා, මෙහි සෑම අකුරක්ම සහ වචනයක්ම කියවීම කෙතරම් පහසුද?",
  help: "",
  bands: [
    "සෑම අකුරක්ම සහ වචනයක්ම මුල් බැල්මෙන්ම කියවිය හැක",
    "කියවිය හැක; කලාතුරකින් අකුරක් දෙවරක් බැලිය යුතුය",
    "කියවිය හැක, නමුත් සමහර වචන දෙවරක් බැලිය යුතුය",
    "වචන කිහිපයක් කියවීමට උත්සාහයක් හෝ වාක්‍යයේ අර්ථය අවශ්‍ය වේ",
    "බොහෝ අකුරු හෝ වචන කියවිය නොහැක",
  ],
  low: "කියවීමට ඉතා අපහසුයි",
  high: "කියවීමට ඉතා පහසුයි",
};

export type Decoration = "none" | "present_ok" | "present_hurts";
export type Alterations = "none" | "1-2" | "3+";
export const DECORATIONS: Decoration[] = ["none", "present_ok", "present_hurts"];
export const ALTERATIONS: Alterations[] = ["none", "1-2", "3+"];

export const DECORATION_Q = {
  code: "D",
  label: "සැරසිලි",
  question: "අකුරුවල අමතර සැරසිලි (ලස්සනට එක් කළ අමතර ඉරි, රවුම්, අග දිගු කිරීම් ආදිය) තිබේද?",
  options: { none: "නැත", present_ok: "ඇත — කියවීමට බාධාවක් නැත", present_hurts: "ඇත — කියවීමට බාධා කරයි" } as Record<Decoration, string>,
};

export const ALTERATIONS_Q = {
  label: "කපා හැරීම් / නැවත ලිවීම්",
  question: "ඡේදයේ කපා හැරි, මකා දැමූ හෝ උඩින් නැවත ලියූ තැන් කීයක් තිබේද?",
  options: { none: "නැත", "1-2": "1–2", "3+": "3 හෝ ඊට වැඩි" } as Record<Alterations, string>,
};

export const COMMENT_Q = "මෙම අත් අකුරුවල පෙනුමට බලපාන වෙනත් යමක් තිබේද?";

export const CRITERIA_INTRO =
  "පහත නිර්ණායක අටට වෙන වෙනම ලකුණු දෙන්න. තනි නරකම අකුර අනුව නොව, ඡේදයේ සාමාන්‍ය අකුර අනුව ඡේදය සමස්තයක් ලෙස විනිශ්චය කරන්න.";

export const CRITERIA: CriterionText[] = [
  {
    key: "a1",
    code: "A1",
    labelEn: "Letter form and parts",
    label: "අකුරු හැඩය සහ කොටස්",
    lookFor:
      "සෑම අකුරකම අවශ්‍ය කොටස් (ඇස, ගැටය, වක්‍ර, සෘජු ඉරි, නෙරීම්, කොක්ක ආදිය) පැහැදිලිව සාදා තිබේද? කොටස් එකිනෙක සම්බන්ධ වන තැන් සහ ඉරිවල අග පිරිසිදුද? හොඳින් සැකසූ පෞද්ගලික ආකාරයක් දෝෂයක් නොවේ.",
    bands: [
      "සෑම අකුරක්ම සම්පූර්ණයෙන් සාදා ඇත; ඇස් සහ ගැට පිළිවෙළයි; සන්ධි සහ ඉරිවල අග පිරිසිදුයි",
      "බොහෝ දුරට සියලු අකුරු හොඳින් සාදා ඇත; දුර්වල කොටස් 1–2ක් පමණි",
      "බොහෝ අකුරු හොඳින් සාදා ඇත; දුර්වල කොටස් කිහිපයක් ඇත (විවෘත ගැටයක්, තෙරපුණු ඇසක්, අඩු කොක්කක් වැනි)",
      "බොහෝ අකුරුවල දුර්වල කොටස් ඇත; සමහර අකුරු හැඩයෙන් හඳුනාගැනීම අපහසුයි",
      "බොහෝ අකුරු විකෘතියි හෝ කොටස් අඩුයි",
    ],
  },
  {
    key: "a2",
    code: "A2",
    labelEn: "Curves and balance",
    label: "වක්‍ර රවුම් බව සහ සමබර බව",
    lookFor:
      "රවුම් කොටස් පිරුණු හා සුමටද? පැතලි, උල් හෝ නොසුමට තැන් නැද්ද? අකුරු ස්ථාවරව සිටිනවාද (එක් පැත්තකට බර නොවී)? වක්‍ර පරිපූර්ණ කව විය යුතු නැත.",
    bands: [
      "රවුම් කොටස් පිරුණු හා සුමටයි; අකුරු ස්ථාවරව සිටී",
      "සුමටයි; කලාතුරකින් පැතලි හෝ උල් තැනක් පමණි",
      "සමහර වක්‍ර පැතලි, උල් හෝ නොසුමටයි; අකුරු කිහිපයක් ඇලවී ඇත",
      "බොහෝ වක්‍ර පැතලි, කෝණික හෝ නොසුමටයි; බොහෝ අකුරු එක් පැත්තකට බරයි",
      "වක්‍ර කැඩී හෝ කෝණිකව ඇත; අකුරු අස්ථාවර ලෙස පෙනේ",
    ],
  },
  {
    key: "a3",
    code: "A3",
    labelEn: "Proportion and size",
    label: "සමානුපාතය සහ ප්‍රමාණය",
    lookFor:
      "එක් එක් අකුරේ උස සහ පළල ගැළපේද? කොටස් අතර සමානුපාතය නිවැරදිද (උදා: ගැටය අධික ලෙස විශාල නොවේ)? අකුරේ ප්‍රධාන කොටස (මැද කලාපය) ඡේදය පුරා එකම උසකින් පවතීද? ඉහළට හෝ පහළට දිගු වන කොටස් සසඳන්නේ එවැනිම අකුරු සමඟය.",
    bands: [
      "සෑම අකුරක්ම හොඳ සමානුපාතයකින් යුතුයි; ප්‍රධාන කොටසේ උස ස්ථාවරයි",
      "හොඳ සමානුපාත; ප්‍රධාන කොටසේ උස මඳක් වෙනස් වේ",
      "සමහර අකුරු ඉතා පළල්, පටු, උස හෝ කොටයි",
      "බොහෝ අකුරු සමානුපාතයෙන් තොරයි; ප්‍රධාන කොටසේ උස පැහැදිලිව අසමානයි",
      "අකුරුවල ප්‍රමාණය සහ සමානුපාතය දැඩි ලෙස වෙනස් වේ",
    ],
  },
  {
    key: "a4",
    code: "A4",
    labelEn: "Line placement",
    label: "රේඛා මත පිහිටීම",
    lookFor:
      "අකුරු ස්ථාවර පාදක රේඛාවක් මත පිහිටා තිබේද? ඉහළට හා පහළට දිගු වන කොටස් එකාකාර උසකට ළඟා වේද? පේළි සෘජුවද (ඇල නොවී, රැලි නොගැසී)? ඉරි නොමැති කඩදාසියක ලියූ නිසා, පාසල් ඉරිවලට හරියටම ගැළපීම නොව ස්ථාවරභාවය විනිශ්චය කරන්න.",
    bands: [
      "ස්ථාවර පාදක රේඛාවක්; ඉහළ සහ පහළ කොටස්වල උස එකාකාරයි; පේළි සෘජුයි",
      "තැන් කිහිපයක පමණක් සුළු ලෙස ඉහළ පහළ යයි",
      "අකුරු පාදක රේඛාවෙන් ඉහළට හෝ පහළට පැහැදිලිව ඉවත් වේ, නැතහොත් පේළිය මඳක් රැලි ගැසේ",
      "නිතර ඉවත් වේ; පේළි පැහැදිලිව ඇල වේ හෝ රැලි ගැසේ",
      "ස්ථාවර පාදක රේඛාවක් නැත; අකුරු පාවෙන්නාක් මෙන් පෙනේ",
    ],
  },
  {
    key: "a5",
    code: "A5",
    labelEn: "Pili and signs",
    label: "පිලි සහ ලකුණු",
    lookFor:
      "කොම්බුව, ඉස්පිල්ල, පාපිල්ල, ඇලපිල්ල, හල් කිරීම, යංශය සහ රකාරාංශය නිසි තැනට, නිසි ප්‍රමාණයට ලියා තිබේද? අකුරට සම්බන්ධ විය යුතු පිලි පිරිසිදුව සම්බන්ධ වී තිබේද? කොම්බුව වැනි වෙන්ව ලියන ලකුණු ස්වාභාවික දුරකින් තිබේද? වැරදි හෝ අඩු පිල්ලක් ලිවීමේ වැරැද්දකි (අක්ෂර වින්‍යාස දෝෂයකි) — එය මෙහි ලකුණුවලට ගණන් නොගන්න.",
    bands: [
      "සෑම පිල්ලක්ම නිසි තැනට, නිසි ප්‍රමාණයට ලියා ඇත",
      "පිලි හොඳින් පිහිටා ඇත; 1–2ක් පමණක් ප්‍රමාණයෙන් හෝ පිහිටීමෙන් මඳක් වෙනස්",
      "පිලි කිහිපයක් ඉතා විශාල, ඉතා කුඩා, අකුරෙන් ඈත් වී හෝ ඊළඟ අකුරට තෙරපී ඇත",
      "බොහෝ පිලි වැරදි තැන්වල ඇත, නැතහොත් වෙනත් අකුරුවල හැපී ඇත",
      "පිලි බොහෝ දුරට අහඹු ලෙස තබා ඇත",
    ],
  },
  {
    key: "a6",
    code: "A6",
    labelEn: "Spacing",
    label: "පරතරය",
    lookFor:
      "වචනයක් තුළ අකුරු අතර පරතරය සමානද? වචන අතර පරතරය පැහැදිලිව විශාල හා සමානද? පේළි අතර පරතරය සමාන හා පේළි එකිනෙක නොගැටේද?",
    bands: [
      "අකුරු අතර පරතරය සමානයි; වචන අතර පරතරය පැහැදිලි හා සමානයි; පේළි හොඳින් වෙන්ව ඇත",
      "බොහෝ දුරට සමානයි; අසමාන පරතර කිහිපයක් පමණි",
      "සමහර අකුරු තෙරපී හෝ ලිහිල්ව ඇත; වචන අතර පරතර කිහිපයක් අපැහැදිලියි",
      "බොහෝ පරතර අසමානයි; සමහර විට වචන එකට එකතු වේ",
      "අකුරු එකිනෙක හැපේ හෝ විසිරී ඇත; වචන වෙන් කර හඳුනාගත නොහැක",
    ],
  },
  {
    key: "a7",
    code: "A7",
    labelEn: "Stroke quality",
    label: "ඉරිවල ගුණය",
    lookFor:
      "ඉරි සුමට හා විශ්වාසයෙන් ඇඳ තිබේද — වෙව්ලීම්, නැවත නැවත ඇඳීම් හෝ තීන්ත පැල්ලම් නොමැතිව? ඉරිවල ඝනකම එකාකාරද? (ඇලවීම A8 යටතේ ලකුණු කරන්න.)",
    bands: [
      "එකාකාර ඝනකමින් යුත් සුමට, විශ්වාසවන්ත ඉරි",
      "සුමටයි; රළු තැන් කිහිපයක් පමණි",
      "සමහර ඉරි වෙව්ලන, නැවත ඇඳි හෝ අසමාන ඝනකමින් යුතුයි",
      "බොහෝ ඉරි වෙව්ලයි හෝ නැවත ඇඳ ඇත; පැල්ලම් කිහිපයක් ඇත",
      "ඡේදය පුරා ඉරි වෙව්ලයි, කැඩී ඇත හෝ පැල්ලම් සහිතයි",
    ],
  },
  {
    key: "a8",
    code: "A8",
    labelEn: "Consistency of style and slant",
    label: "ශෛලියේ සහ ඇලවීමේ ඒකාකාරී බව",
    lookFor:
      "එකම අකුර සෑම විටම එකම ආකාරයෙන් ලියා තිබේද? අකුරුවල ඇලවීම ස්ථාවරද (අකුරු කෙළින් සිටීම අවශ්‍ය නැත)? ඡේදය පුරා එකම ශෛලියක් පවතීද?",
    bands: [
      "නැවත එන අකුරු එක සමානයි; ඇලවීම ස්ථාවරයි; ඡේදය පුරා එකම ශෛලියක්",
      "නැවත එන අකුරුවල හෝ ඇලවීමේ කුඩා වෙනස්කම් පමණි",
      "සමහර අකුරු ආකාර දෙකකින් ලියා ඇත, නැතහොත් ඇලවීම වෙනස් වේ",
      "අකුරුවල හැඩය හෝ ඇලවීම නිතර වෙනස් වේ",
      "අකුරෙන් අකුරට ශෛලිය සහ ඇලවීම වෙනස් වේ",
    ],
  },
];

export const criterionText = (key: string) => CRITERIA.find((c) => c.key === key) ?? null;

/** Weak-region issue tags: the closed list from the annotation protocol (value = stored English tag). */
export const ISSUE_TAGS: Record<string, { value: string; label: string }[]> = {
  a1: [
    { value: "part_missing", label: "කොටසක් අඩුයි" },
    { value: "extra_part", label: "අමතර කොටසක්" },
    { value: "eye_malformed", label: "ඇස වැරදි හැඩයි" },
    { value: "knot_open_or_blotted", label: "ගැටය විවෘතයි / පැල්ලම්" },
    { value: "curve_part_misshapen", label: "කොක්ක / නෙරීම / වළල්ල / දඟරය වැරදි හැඩයි" },
    { value: "broken_joint", label: "සන්ධිය කැඩී ඇත" },
    { value: "ragged_end", label: "ඉරේ අග රළුයි" },
  ],
  a2: [
    { value: "curve_flattened", label: "වක්‍රය පැතලියි" },
    { value: "curve_pointed", label: "වක්‍රය උල් / කෝණිකයි" },
    { value: "curve_wobbly", label: "වක්‍රය නොසුමටයි" },
    { value: "letter_leaning", label: "අකුර ඇලවී / එක් පැත්තකට බරයි" },
  ],
  a3: [
    { value: "too_wide", label: "ඉතා පළල්" },
    { value: "too_narrow", label: "ඉතා පටු" },
    { value: "body_too_tall_or_short", label: "ප්‍රධාන කොටස ඉතා උස / කොට" },
    { value: "ascender_descender_off", label: "ඉහළ / පහළ කොටස සමානුපාතික නැත" },
    { value: "part_over_under_sized", label: "කොටසක් ඉතා විශාල / කුඩා" },
  ],
  a4: [
    { value: "above_baseline", label: "පාදක රේඛාවට ඉහළින්" },
    { value: "below_baseline", label: "පාදක රේඛාවට පහළින්" },
    { value: "wrong_height", label: "හිස / ඉහළ / පහළ කොටස වැරදි උසක" },
    { value: "line_drifts", label: "පේළිය ඇල වේ / රැලි ගැසේ" },
  ],
  a5: [
    { value: "sign_misplaced", label: "පිල්ල වැරදි තැනක" },
    { value: "sign_wrong_size", label: "පිල්ල වැරදි ප්‍රමාණයක" },
    { value: "sign_not_joined", label: "සම්බන්ධ විය යුතු පිල්ල සම්බන්ධ නැත" },
    { value: "sign_too_far", label: "වෙන් පිල්ල ඉතා ඈතින්" },
    { value: "sign_colliding", label: "අකුරක / පේළියක හැපේ" },
  ],
  a6: [
    { value: "letters_touching", label: "අකුරු එකිනෙක ගැටේ" },
    { value: "gap_too_wide_in_word", label: "වචනය තුළ පරතරය ඉතා විශාලයි" },
    { value: "word_gap_too_small", label: "වචන අතර පරතරය ඉතා කුඩයි" },
    { value: "word_gap_too_large", label: "වචන අතර පරතරය ඉතා විශාලයි" },
    { value: "lines_too_close", label: "පේළි ඉතා ළඟ / ගැටේ" },
  ],
  a7: [
    { value: "shaky_stroke", label: "වෙව්ලන ඉර" },
    { value: "retraced", label: "නැවත ඇඳ ඇත / උඩින් ලියා ඇත" },
    { value: "blot", label: "තීන්ත පැල්ලමක්" },
    { value: "uneven_thickness", label: "අසමාන ඝනකම" },
  ],
  a8: [
    { value: "slant_off", label: "ඇලවීම අනෙක් අකුරුවලින් වෙනස්" },
    { value: "form_differs", label: "එම අකුරම වෙනත් ආකාරයකින් ලියා ඇත" },
  ],
};

/** A1 boxes can also record which letter part is weak. */
export const PARTS: { value: string; label: string }[] = [
  { value: "eye", label: "ඇස" },
  { value: "knot", label: "ගැටය" },
  { value: "hook", label: "කොක්ක" },
  { value: "hump", label: "නෙරීම" },
  { value: "loop", label: "වළල්ල" },
  { value: "spiral", label: "දඟරය" },
  { value: "stem", label: "සෘජු ඉර" },
  { value: "shoulder", label: "උරහිස" },
  { value: "terminal", label: "ඉරේ අග" },
];

export type RegionFlag = "illegible" | "correction" | "copy_error" | "decoration_helps" | "decoration_hurts";
export const FLAGS: { value: RegionFlag; label: string }[] = [
  { value: "illegible", label: "කියවිය නොහැකි අකුර" },
  { value: "correction", label: "කපා හැරීම / නිවැරදි කිරීම" },
  { value: "copy_error", label: "පිටපත් කිරීමේ වැරැද්ද (වැරදි / අඩු අකුර හෝ පිල්ල)" },
  { value: "decoration_helps", label: "සැරසිල්ල — පෙනුමට උපකාරී" },
  { value: "decoration_hurts", label: "සැරසිල්ල — පෙනුමට හානිකර" },
];

export const SEVERITY = {
  2: "සාමාන්‍ය දුරින් පැහැදිලිව පෙනේ",
  3: "වචනය හෝ පේළිය නරක් කරයි",
} as const;
