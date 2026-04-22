import { RaceRoom } from "@/components/race/race-room";

export default async function RaceRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RaceRoom code={decodeURIComponent(code)} />;
}
