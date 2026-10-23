import { SurveyPage } from "@/app/_survey/SurveyPage";

export const dynamic = "force-dynamic";

export default async function SinhalaSurvey({ params }: { params: Promise<{ id: string }> }) {
  return <SurveyPage script="si" token={(await params).id} />;
}
