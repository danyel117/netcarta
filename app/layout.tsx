import type { Metadata } from "next";

import { AppConvexProvider } from "@/providers/convex-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Netcarta",
  description: "Minimal Next.js + Convex starter.",
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
