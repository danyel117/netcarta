import { EncartaShell } from "@/components/shell/encarta-shell";

export default function RacePage() {
  return (
    <EncartaShell title="Race" subtitle="Netcarta Race — coming next.">
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="border-2 border-black bg-[#fff2d8] px-6 py-5 text-lg">
          Race rooms and live multiplayer are on the roadmap. Try reading an
          article first to warm up.
        </div>
      </div>
    </EncartaShell>
  );
}
