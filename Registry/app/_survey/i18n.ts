import type { Script, StudyType } from "@/lib/types";

/**
 * Reader-facing text for the public survey pages and the main-study form.
 * Sinhala is a draft for proofreading; Tamil uses English until the Tamil text arrives.
 */
export interface SurveyText {
  greeting: string;
  intro: (type: StudyType, count: number, minutes: number) => string;
  name: string;
  age: string;
  ageError: string;
  occupation: string;
  occupationHint: string;
  contact: string;
  contactHint: string;
  firstLanguage: string;
  yes: string;
  no: string;
  adult: string;
  consent: string;
  start: string;
  resumeNote: string;
  closedTitle: string;
  closedBody: string;
  nothingToRate: string;
  allFull: string;
  required: string;
  // Form and end-of-form screens
  doneTitle: string;
  doneBody: (n: number) => string;
  rateMore: (n: number) => string;
  breakNote: string;
  continueForm: string;
}

const si: SurveyText = {
  greeting: "ආයුබෝවන්!",
  intro: (type, count, minutes) =>
    type === "rubric"
      ? `මොරටුව විශ්වවිද්‍යාලයේ Akshara පර්යේෂණය සඳහා සිංහල අත් අකුරු ඇගයීම. ඔබට අත් අකුරු ඡේද ${count}ක් එකින් එක පෙන්වනු ඇත. සෑම ඡේදයකටම එහි සමස්ත අලංකාරය, කියවීමේ පහසුව සහ නිර්ණායක අටක් සඳහා 1–10 ලකුණු දෙන්න; කැමති නම් දුර්වල තැන් සලකුණු කරන්න. මිනිත්තු ${minutes}ක් පමණ ගත වේ.`
      : `සිංහල අත් අකුරුවල පෙනුම පිළිබඳ පර්යේෂණයකි. ඔබට අත් අකුරු නියැදි ${count}ක් එකින් එක පෙන්වනු ඇත. සෑම එකකටම ලකුණක් දී, එය හොඳ හෝ නරක ලෙස පෙනෙන්නේ ඇයිදැයි ඔබේම වචනවලින් කියන්න. මිනිත්තු ${minutes}ක් පමණ ගත වේ.`,
  name: "ඔබේ නම",
  age: "වයස",
  ageError: "වයස 18 සිට 100 දක්වා අංකයක් ලෙස ඇතුළත් කරන්න.",
  occupation: "රැකියාව / අධ්‍යාපනය",
  occupationHint: "උදා: ගුරු, ඉංජිනේරු, උපාධි අපේක්ෂක, උසස් පෙළ",
  contact: "දුරකථන අංකය හෝ ඊමේල්",
  contactHint: "පර්යේෂණය සම්බන්ධයෙන් ඔබව සම්බන්ධ කර ගැනීමට පමණි",
  firstLanguage: "සිංහල ඔබේ මව් භාෂාවද?",
  yes: "ඔව්",
  no: "නැත",
  adult: "මගේ වයස අවුරුදු 18 හෝ ඊට වැඩිය.",
  consent:
    "මම මෙම පර්යේෂණයට සහභාගී වීමට එකඟ වෙමි. මගේ පිළිතුරු පර්යේෂණ ප්‍රකාශනවල සහ නම් රහිත පර්යේෂණ දත්ත කට්ටලයක භාවිත කළ හැක; මගේ නම සහ සම්බන්ධතා විස්තර කිසිවිටෙක ප්‍රසිද්ධ නොකෙරේ.",
  start: "ආරම්භ කරන්න",
  resumeNote: "ඔබේ ප්‍රගතිය මෙම උපාංගයේ සුරැකේ. පිටුව වසා පසුව මෙම සබැඳියෙන්ම නැවත පැමිණිය හැක.",
  closedTitle: "මෙම සමීක්ෂණය වසා ඇත",
  closedBody: "Akshara පර්යේෂණය කෙරෙහි ඔබ දැක්වූ උනන්දුවට ස්තූතියි.",
  nothingToRate: "මෙම සමීක්ෂණයේ ඇගයීමට තවම කිසිවක් නැත.",
  allFull: "සියලු ඡේදවලට අවශ්‍ය ඇගයීම් ලැබී ඇත. ඔබගේ සහාය ගැන ස්තූතියි!",
  required: "කරුණාකර සියලු තොරතුරු පුරවන්න.",
  doneTitle: "ස්තූතියි!",
  doneBody: (n) => `ඔබ ඡේද ${n}ක් ඇගයුවා. ඔබේ පිළිතුරු සුරැකිණි.`,
  rateMore: (n) => `තවත් ඡේද ${n}ක් ඇගයීමට`,
  breakNote: "ඔබ මේ වන විට ඡේද 30කට වඩා ඇගයුවා. නැවුම් ඇසකින් බැලීමට, තවත් ඇගයීමට පෙර විවේකයක් ගන්න.",
  continueForm: "නැවත ආරම්භ කරන්න",
};

const en: SurveyText = {
  greeting: "Hello!",
  intro: (type, count, minutes) =>
    type === "rubric"
      ? `You'll rate ${count} handwriting samples, one at a time: how good each looks overall, how easy it is to read, and eight listed qualities, each 1–10. You can also box the weak parts. It takes about ${minutes} minutes.`
      : `A research study on how handwriting looks. You'll see ${count} handwriting samples, one at a time. For each, give a score and say in your own words what makes it look good or bad. It takes about ${minutes} minutes.`,
  name: "Your name",
  age: "Age",
  ageError: "Enter your age as a number from 18 to 100.",
  occupation: "Occupation / education",
  occupationHint: "e.g. teacher, engineer, undergraduate, A/L",
  contact: "Phone or email",
  contactHint: "only to contact you about the study",
  firstLanguage: "Is this script's language your first language?",
  yes: "Yes",
  no: "No",
  adult: "I am 18 years old or older.",
  consent:
    "I agree to take part. My answers may be used in research publications and in an anonymised research dataset; my name and contact details are never published.",
  start: "Start",
  resumeNote: "Your progress is saved on this device, so you can close the page and come back to this link later.",
  closedTitle: "This survey is closed",
  closedBody: "Thank you for your interest in the Akshara study.",
  nothingToRate: "There is nothing to rate in this survey yet.",
  allFull: "Every sample already has enough ratings. Thank you for your help!",
  required: "Please fill in every field.",
  doneTitle: "Thank you!",
  doneBody: (n) => `You rated ${n} samples. Your answers are saved.`,
  rateMore: (n) => `Rate ${n} more`,
  breakNote: "You have rated more than 30 samples. Take a break before rating more, so you see them with fresh eyes.",
  continueForm: "Continue",
};

export const surveyText = (script: Script): SurveyText => (script === "si" ? si : en);
