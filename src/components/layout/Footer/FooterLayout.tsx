import { motion as motionDom } from "framer-motion";

interface FooterLayoutProps {
  children: React.ReactNode;
}

export function FooterLayout({ children }: FooterLayoutProps) {
  return (
    <footer className="relative border-t border-white/[0.08] px-6 pb-8 pt-16 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-t from-primary/5 to-transparent" />

      <motionDom.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-7xl"
      >
        {children}
      </motionDom.div>
    </footer>
  );
}
