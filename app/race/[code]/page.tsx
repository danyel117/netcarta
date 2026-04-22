import { RaceRoomScreen } from "@/components/race/race-room-screen";

export default async function RaceRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RaceRoomScreen code={decodeURIComponent(code)} />;
}
