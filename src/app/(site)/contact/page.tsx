import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { getSiteSettings } from "@/sanity/queries";
import { ContactDetail } from "@/components/contact/ContactDetail";

export const revalidate = false;

export const metadata: Metadata = {
  title: "Kontak",
  description:
    "Hubungi The Smart Generation (TSG) lewat WhatsApp, email, atau kunjungi sekretariat kami.",
};

export default async function ContactPage() {
  const settings = await getSiteSettings();

  return (
    <div className="bg-grid relative overflow-hidden pb-10 pt-36">
      <div className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]" />

      <div className="mx-auto max-w-3xl px-6 text-center sm:px-10">
        <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
          <Mail className="h-3.5 w-3.5" />
          Hubungi Kami
        </div>
        <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
          Kami Siap <span className="text-gradient">Membantu Kamu</span>
        </h1>
        <p className="mt-4 text-base text-slate-400">
          Mau tanya soal pendaftaran, divisi, kolaborasi, atau media? Pilih
          kanal yang paling nyaman buat kamu.
        </p>
      </div>

      <ContactDetail settings={settings} />
    </div>
  );
}
