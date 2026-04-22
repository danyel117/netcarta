import type { Metadata } from "next";

import { AppConvexProvider } from "@/providers/convex-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Netcarta Online Edition",
  description: "Encarta-inspired multiplayer Wikipedia racing built with Next.js and Convex.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppConvexProvider>{children}</AppConvexProvider>
      </body>
    </html>
  );
}
