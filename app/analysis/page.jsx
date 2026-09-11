import RadarConsole from "@/components/RadarConsole";
import { getInitialState } from "@/lib/repository";

export default async function AnalysisPage({ searchParams }) {
  const initialState = await getInitialState();
  const params = await searchParams;
  const initialArticleId = Number(params?.article) || undefined;

  return <RadarConsole initialArticleId={initialArticleId} initialState={initialState} view="analysis" />;
}
