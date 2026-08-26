import type { SiteSettings } from "@/types";
import { Mail, MapPin } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

interface FooterContactProps {
  settings: SiteSettings;
}

export function FooterContact({ settings }: FooterContactProps) {
  const mapsUrl = settings.mapsEmbedUrl?.includes("pb=")
    ? (() => {
        const match = settings.mapsEmbedUrl.match(/!2d([0-9.]+)!3d([0-9.]+)/);
        return match ? `https://www.google.com/maps?q=${match[2]},${match[1]}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`;
      })()
    : settings.mapsEmbedUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`;

  return (
    <div>
      <h4 className="font-display text-sm font-semibold text-white">
        Kontak
      </h4>
      <ul className="mt-4 space-y-3">
        <li className="flex items-start gap-2.5 text-sm text-slate-500">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span className="text-slate-500">
            {settings.address}
          </span>
        </li>
        <li>
          <a
            href={`mailto:${settings.contactEmail}`}
            className="flex items-center gap-2.5 text-sm text-slate-500 transition-colors duration-200 hover:text-accent"
          >
            <Mail className="h-4 w-4 shrink-0 text-primary" />
            {settings.contactEmail}
          </a>
        </li>
        <li>
          <a
            href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 text-sm text-slate-500 transition-colors duration-200 hover:text-accent"
          >
            <FaWhatsapp className="h-4 w-4 shrink-0 text-primary" />
            {settings.whatsappNumber}
          </a>
        </li>
      </ul>
    </div>
  );
}
