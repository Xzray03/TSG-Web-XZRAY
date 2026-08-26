"use client";

import { motion } from "framer-motion";
import { Mail, MapPin } from "lucide-react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import type { SiteSettings } from "@/types";

interface ContactProps {
  settings: SiteSettings;
}

export function Contact({ settings }: ContactProps) {
  const contactMethods = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      value: settings.whatsappNumber,
      href: `https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, "")}`,
      icon: FaWhatsapp,
    },
    {
      id: "email",
      label: "Email",
      value: settings.contactEmail,
      href: `mailto:${settings.contactEmail}`,
      icon: Mail,
    },
    settings.instagramUrl && {
      id: "instagram",
      label: "Instagram",
      value: "@tsgbogor",
      href: settings.instagramUrl,
      icon: FaInstagram,
    },
  ].filter(Boolean) as {
    id: string;
    label: string;
    value: string;
    href: string;
    icon: typeof Mail;
  }[];

  const mapsUrl = settings.mapsEmbedUrl?.includes("pb=")
    ? (() => {
        const match = settings.mapsEmbedUrl.match(/!2d([0-9.]+)!3d([0-9.]+)/);
        return match ? `https://www.google.com/maps?q=${match[2]},${match[1]}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`;
      })()
    : settings.mapsEmbedUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`;

  return (
    <section className="relative px-6 py-24 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute right-0 top-1/2 -z-10 h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-primary/10 blur-[140px]" />

      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
            <Mail className="h-3.5 w-3.5" />
            Hubungi Kami
          </div>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Punya Pertanyaan? <span className="text-gradient">Kami Siap Bantu</span>
          </h2>
          <p className="mt-4 text-base text-slate-400">
            Mau tanya soal pendaftaran, divisi, atau kolaborasi? Hubungi kami
            langsung lewat salah satu kanal di bawah.
          </p>
        </motion.div>

        <div className="mt-12 flex flex-wrap items-stretch justify-center gap-4">
          {contactMethods.map((method, index) => (
            <motion.a
              key={method.id}
              href={method.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              whileHover={{ y: -4 }}
              className="glass flex w-[calc(50%-0.5rem)] flex-col items-center gap-3 rounded-2xl border border-white/[0.08] p-6 text-center transition-colors duration-200 hover:border-accent/40 sm:w-[calc(33.333%-0.75rem)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <method.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">{method.label}</p>
                <p className="mt-0.5 text-sm font-medium text-white">
                  {method.value}
                </p>
              </div>
            </motion.a>
          ))}
        </div>

        {/* Address + map */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.24 }}
          className="glass mt-6 overflow-hidden rounded-2xl border border-white/[0.08]"
        >
          <div className="flex items-start gap-4 p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-slate-500">Alamat</p>
              <p className="mt-0.5 text-sm font-medium text-white">
                {settings.address}
              </p>
            </div>
          </div>
          {settings.mapsEmbedUrl && (
            <iframe
              title="Lokasi TSG"
              src={settings.mapsEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-64 w-full grayscale invert-[0.9]"
            />
          )}
        </motion.div>
      </div>
    </section>
  );
}