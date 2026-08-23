import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Zap } from "lucide-react";
import { navLinks } from "@/data/nav";
import { EXTERNAL_URLS } from "@/data/url";
import { cn } from "@/lib/utils";
import { LogoModal } from "../LogoModal";

interface NavbarMobileProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  handleNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  isLogoModalOpen: boolean;
  setIsLogoModalOpen: (open: boolean) => void;
  logoUrl?: string;
  shortName: string;
}

export function NavbarMobile({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  handleNavClick,
  isLogoModalOpen,
  setIsLogoModalOpen,
  logoUrl,
  shortName,
}: NavbarMobileProps) {
  return (
    <>
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ isolation: "isolate" }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <motion.nav
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="flex h-full flex-col items-center justify-center gap-2 px-6"
            >
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.05 + index * 0.04 }}
                >
                  <Link
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="block py-3 text-center font-display text-2xl font-medium text-slate-200 transition-colors hover:text-accent"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              <Link
                href={EXTERNAL_URLS.registration}
                onClick={() => setIsMobileMenuOpen(false)}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-[0_0_40px_-8px_rgba(168,85,247,0.45)]"
              >
                Join TSG
              </Link>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLogoModalOpen && logoUrl && (
          <LogoModal
            logoUrl={logoUrl}
            alt={shortName}
            onClose={() => setIsLogoModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}