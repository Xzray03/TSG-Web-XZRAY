import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FloatingWhatsApp } from "@/components/layout/FloatingWhatsApp";
import { ScrollToTopButton } from "@/components/layout/ScrollToTopButton";
import { IntroLoader } from "@/components/layout/IntroLoader";
import { MouseGuard } from "@/components/layout/MouseGuard";
import { WaterRippleEffect } from "@/components/layout/WaterRippleEffect";
import { getDivisions, getSiteSettings } from "@/sanity/queries";
import "../globals.css";

// Selalu ambil data terbaru dari Sanity, jangan pakai cache halaman.
export const revalidate = 0;

import { SITE_URL } from "@/data/url_production";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${settings.name} (${settings.shortName}) — ${settings.slogan}`,
      template: `%s | ${settings.shortName}`,
    },
    description: settings.description,
    icons: settings.logoUrl ? {
      icon: settings.logoUrl,
      shortcut: settings.logoUrl,
      apple: settings.logoUrl,
    } : undefined,
    keywords: [
      "Robotics Club",
      "Science Club",
      "The Smart Generation",
      "TSG",
      "Robotics Indonesia",
      "Mechatronics",
      "STEM Education",
    ],
    openGraph: {
      type: "website",
      locale: "id_ID",
      url: SITE_URL,
      title: `${settings.name} (${settings.shortName})`,
      description: settings.description,
      siteName: settings.shortName,
    },
    twitter: {
      card: "summary_large_image",
      title: `${settings.name} (${settings.shortName})`,
      description: settings.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#c084fc", // Purple Lilac
  width: "device-width",
  initialScale: 1,
};

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [divisions, settings] = await Promise.all([
    getDivisions(),
    getSiteSettings(),
  ]);

  return (
    <html lang="id" data-scroll-behavior="smooth" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="bg-background font-body antialiased">
        <WaterRippleEffect />
        <MouseGuard />
        <IntroLoader />
        <Navbar shortName={settings.shortName} logoUrl={settings.logoUrl} />
        <ScrollToTopButton />
        <main>{children}</main>
        <Footer divisions={divisions} settings={settings} />
        <FloatingWhatsApp whatsappNumber={settings.whatsappNumber} />
      </body>
    </html>
  );
}