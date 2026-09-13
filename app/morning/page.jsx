import RadarConsole from "@/components/RadarConsole";
import { getInitialState } from "@/lib/repository";

export const dynamic = 'force-dynamic';

export default async function MorningPage() {
  const initialState = await getInitialState();

  return <RadarConsole initialState={initialState} view="morning" />;
}
