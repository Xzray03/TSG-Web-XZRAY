"use client";

import { motion } from "framer-motion";
import {
  Mail,
  MapPin,
  Clock,
} from "lucide-react";
import { FaInstagram, FaYoutube, FaWhatsapp } from "react-icons/fa";
import type { SiteSettings } from "@/types";

interface ContactDetailProps {
  settings: SiteSettings;
}

export function ContactDetail({ settings }: ContactDetailProps) {
  const methods = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      value: settings.whatsappNumber,
      href: `https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, "")}`,
      icon: FaWhatsapp,
      color: "text-[#25D366] bg-[#25D366]/15",
    },
    {
      id: "email",
      label: "Email",
      value: settings.contactEmail,
      href: `mailto:${settings.contactEmail}`,
      icon: Mail,
      color: "text-primary bg-primary/15",
    },
    settings.instagramUrl && {
      id: "instagram",
      label: "Instagram",
      value: "@thesmartgeneration",
      href: settings.instagramUrl,
      icon: FaInstagram,
      color: "text-accent bg-accent/15",
    },
    settings.youtubeUrl && {
      id: "youtube",
      label: "YouTube",
      value: "The Smart Generation",
      href: settings.youtubeUrl,
      icon: FaYoutube,
      color: "text-red-400 bg-red-400/15",
    },
  ].filter(Boolean) as {
    id: string;
    label: string;
    value: string;
    href: string;
    icon: typeof Mail;
    color: string;
  }[];

  const mapsUrl = settings.mapsEmbedUrl?.includes("pb=")
    ? (() => {
        const match = settings.mapsEmbedUrl.match(/!2d([0-9.]+)!3d([0-9.]+)/);
        return match ? `https://www.google.com/maps?q=${match[2]},${match[1]}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`;
      })()
    : settings.mapsEmbedUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`;

  return (
    <section className="relative px-6 py-20 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute right-0 top-1/3 -z-10 h-[440px] w-[440px] rounded-full bg-primary/10 blur-[140px]" />

      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Contact method cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {methods.map((method, index) => (
              <motion.a
                key={method.id}
                href={method.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                whileHover={{ y: -4 }}
                className="glass flex flex-col gap-4 rounded-2xl border border-white/[0.08] p-6 transition-colors duration-200 hover:border-accent/40"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${method.color}`}
                >
                  <method.icon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs text-slate-500">{method.label}</p>
                  <p className="mt-1 break-all text-sm font-medium text-white">
                    {method.value}
                  </p>
                </div>
              </motion.a>
            ))}

            {settings.officeHours && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: methods.length * 0.08 }}
                className="glass flex flex-col gap-4 rounded-2xl border border-white/[0.08] p-6 sm:col-span-2"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue/15 text-blue">
                  <Clock className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs text-slate-500">Jam Operasional</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {settings.officeHours}
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Map */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass flex flex-col overflow-hidden rounded-2xl border border-white/[0.08]"
          >
            <div className="flex items-start gap-3 p-6 pb-4">
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
            {settings.mapsEmbedUrl ? (
              <iframe
                title="Lokasi TSG"
                src={settings.mapsEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full min-h-[280px] w-full flex-1 grayscale invert-[0.9]"
              />
            ) : (
              <div className="flex min-h-[280px] flex-1 items-center justify-center text-sm text-slate-600">
                Peta belum tersedia.
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
