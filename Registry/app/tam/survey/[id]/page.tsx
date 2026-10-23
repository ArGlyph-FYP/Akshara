import { SurveyPage } from "@/app/_survey/SurveyPage";

export const dynamic = "force-dynamic";

export default async function TamilSurvey({ params }: { params: Promise<{ id: string }> }) {
  return <SurveyPage script="ta" token={(await params).id} />;
}
