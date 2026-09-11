import RadarConsole from "@/components/RadarConsole";
import { getInitialState } from "@/lib/repository";

export default async function CredibilityPage() {
  const initialState = await getInitialState();

  return <RadarConsole initialState={initialState} view="credibility" />;
}
