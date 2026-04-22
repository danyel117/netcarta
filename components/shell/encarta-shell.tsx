import Link from "next/link";
import { clsx } from "clsx";

import { SearchBox } from "@/components/search/search-box";

type ToolbarItem = {
  label: string;
  href?: string;
  disabled?: boolean;
};

const toolbarItems: ToolbarItem[] = [
  { label: "Home", href: "/" },
  { label: "Articles", href: "/articles/Encarta" },
  { label: "Race", href: "/race" },
  { label: "Atlas", disabled: true },
  { label: "MindMaze", disabled: true },
];

export function EncartaShell({
  title,
  subtitle,
  children,
  actions,
  sidebar,
  statusLeft,
  statusRight,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  sidebar?: React.ReactNode;
  statusLeft?: React.ReactNode;
  statusRight?: React.ReactNode;
}) {
  return (
    <div className="desktop-shell">
      <div className="window-frame overflow-hidden bg-panel text-black">
        <div className="title-bar">
          <div className="title-bar-text">Netcarta Online Edition</div>
          <div className="title-bar-controls">
            <button aria-label="Minimize" />
            <button aria-label="Maximize" />
            <button aria-label="Close" />
          </div>
        </div>

        <div className="border-b-2 border-black bg-[#d7d7d7] px-3 py-2 text-[12px]">
          <div className="mb-2 flex gap-5 uppercase tracking-[0.22em] text-[#222]">
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span>Favorites</span>
            <span>Tools</span>
            <span>Help</span>
          </div>
          <div className="encarta-toolbar flex flex-wrap gap-2">
            {toolbarItems.map((item) => {
              if (item.disabled) {
                return (
                  <button
                    key={item.label}
                    className="bevel bg-panel px-4 py-2 text-sm"
                    disabled
                  >
                    {item.label}
                  </button>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href!}
                  className="bevel inline-flex items-center bg-panel px-4 py-2 text-sm hover:bg-[#dcdcdc]"
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid min-h-[calc(100vh-170px)] grid-cols-1 bg-[linear-gradient(135deg,#eff7ff_0%,#f5eedf_38%,#d9e7f6_100%)] lg:grid-cols-[260px,1fr]">
          <aside className="border-r-2 border-black bg-[#efefef] p-4">
            {sidebar ?? (
              <>
                <div className="bevel-inset mb-4 bg-black px-3 py-4 text-white">
                  <div className="text-xs uppercase tracking-[0.3em] text-[#8dd3d3]">
                    Encyclopedia
                  </div>
                  <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
                  {subtitle ? (
                    <p className="mt-3 text-sm leading-5 text-[#d4d4d4]">{subtitle}</p>
                  ) : null}
                </div>

                <div className="space-y-4 text-sm">
                  <section>
                    <div className="mb-2 bg-[#b0b0b0] px-2 py-1 text-xl font-bold">
                      Search
                    </div>
                    <div className="px-2">
                      <SearchBox />
                    </div>
                  </section>

                  <section>
                    <div className="mb-2 bg-[#b0b0b0] px-2 py-1 text-xl font-bold">
                      Explore Netcarta
                    </div>
                    <div className="space-y-1 px-2 text-[17px]">
                      <Link
                        href="/articles/Internet"
                        className="block py-1 hover:underline"
                      >
                        Featured article
                      </Link>
                      <Link href="/race" className="block py-1 hover:underline">
                        Netcarta race lobby
                      </Link>
                      <span className="block py-1 text-[#6b7280]">Atlas</span>
                      <span className="block py-1 text-[#6b7280]">MindMaze</span>
                    </div>
                  </section>

                  <section>
                    <div className="mb-2 bg-[#b0b0b0] px-2 py-1 text-xl font-bold">
                      Session Tools
                    </div>
                    <div className="space-y-2 px-2 text-[15px] text-[#202020]">
                      <p>
                        Realtime rooms, cached articles, and a judge-friendly
                        leaderboard live in Convex.
                      </p>
                      <p>
                        Use the top toolbar to jump between the home hub, article
                        chrome, and race flow.
                      </p>
                    </div>
                  </section>
                </div>
              </>
            )}
          </aside>

          <main
            className={clsx(
              "relative flex min-h-full flex-col bg-[radial-gradient(circle_at_top_right,rgba(116,172,222,0.28),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0.15))]",
              actions && "pb-24"
            )}
          >
            {actions ? (
              <div className="border-b-2 border-black bg-[#d8d8d8] p-3">
                {actions}
              </div>
            ) : null}
            {children}
          </main>
        </div>

        <div className="flex items-center justify-between border-t-2 border-black bg-[#d7d7d7] px-3 py-1 text-xs">
          <span>{statusLeft ?? "Ready"}</span>
          <span>{statusRight ?? "Internet"}</span>
        </div>
      </div>
    </div>
  );
}
