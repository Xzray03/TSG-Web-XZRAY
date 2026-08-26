import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  return (
    <>
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ isolation: "isolate", transform: "translateZ(0)" }}
            className="fixed inset-0 z-[99999] bg-background/98 backdrop-blur-2xl lg:hidden [backface-visibility:hidden]"
          >
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex h-full flex-col items-center justify-center gap-2 px-6"
            >
              {navLinks.map((link, index) => {
                const isActive = link.href === "/" 
                  ? pathname === "/" 
                  : pathname === link.href || pathname?.startsWith(`${link.href}/`);

                return (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.02 + index * 0.03 }}
                  >
                    <Link
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className={cn(
                        "block rounded-full px-6 py-3 text-center font-display text-2xl font-medium transition-colors",
                        isActive
                          ? "bg-white/15 text-white backdrop-blur-md"
                          : "text-slate-300 hover:text-accent"
                      )}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                );
              })}

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