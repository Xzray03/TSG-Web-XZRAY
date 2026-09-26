import type { Metadata } from "next";
import { MouseGuard } from "@/components/layout/MouseGuard";
import "../globals.css";
import { StudioAuthGuard } from "./StudioAuthGuard";

export const metadata: Metadata = {
  title: "Studio — The Smart Generation",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <MouseGuard />
        <StudioAuthGuard>{children}</StudioAuthGuard>
      </body>
    </html>
  );
}
