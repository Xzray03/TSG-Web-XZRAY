import Link from "next/link";
import Image from "next/image";
import { Zap, Menu, X } from "lucide-react";
import { EXTERNAL_URLS } from "@/data/url";
import { cn } from "@/lib/utils";
import { InteractiveNav } from "./InteractiveNav";

interface NavbarLayoutProps {
  shortName: string;
  logoUrl?: string;
  isScrolled: boolean;
  setIsLogoModalOpen: (open: boolean) => void;
  handleNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function NavbarLayout({
  shortName,
  logoUrl,
  isScrolled,
  setIsLogoModalOpen,
  handleNavClick,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: NavbarLayoutProps) {
  return (
    <div
      className={cn(
        "flex w-full max-w-6xl items-center justify-between rounded-2xl border border-white/[0.08] px-5 py-4 transition-all duration-500 sm:px-7",
        isScrolled
          ? "glass-strong shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]"
          : "border-transparent bg-transparent"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <button
            type="button"
            onClick={() => setIsLogoModalOpen(true)}
            className="group relative flex h-20 w-20 items-center justify-center transition-transform duration-300 hover:scale-105 focus:outline-none cursor-pointer gpu-accelerated"
          >
            <span className="absolute inset-0 -z-10 rounded-full bg-primary/30 blur-xl" />
            <Image
              src={logoUrl}
              alt={shortName}
              width={80}
              height={80}
              className="h-full w-full object-contain"
              priority
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsLogoModalOpen(true)}
            className="group relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue text-background transition-transform duration-300 hover:scale-105 focus:outline-none cursor-pointer gpu-accelerated"
          >
            <Zap className="h-5 w-5" strokeWidth={2.5} />
            <span className="absolute inset-0 -z-10 rounded-xl bg-primary/40 blur-lg" />
          </button>
        )}

        <Link
          href="/"
          onClick={(e) => handleNavClick(e, "/")}
          className="font-display text-xl font-semibold tracking-tight text-white transition-colors hover:text-accent"
        >
          {shortName}
        </Link>
      </div>

      {/* Desktop nav */}
      <InteractiveNav handleNavClick={handleNavClick} />

      {/* CTA */}
      <div className="hidden lg:block">
        <Link
          href={EXTERNAL_URLS.registration}
          className="glow-cyan inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-blue px-5 py-2.5 text-sm font-semibold text-background transition-all duration-300 hover:bg-gradient-to-r hover:from-purple-500 hover:to-indigo-600 hover:text-white hover:shadow-[0_0_40px_-8px_rgba(168,85,247,0.45)] hover:scale-105 gpu-accelerated"
        >
          Join TSG
        </Link>
      </div>

      {/* Mobile toggle */}
      <button
        type="button"
        aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        aria-expanded={isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen((prev) => !prev)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/5 lg:hidden"
      >
        {isMobileMenuOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}