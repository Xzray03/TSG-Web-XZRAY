"use client";

import { motion } from "framer-motion";

interface WhatsAppBubbleProps {
  showBubble: boolean;
  isPanicking: boolean;
}

export function WhatsAppBubble({ showBubble, isPanicking }: WhatsAppBubbleProps) {
  if (!showBubble) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.9 }}
      transition={{ duration: 0.25 }}
      className="glass-strong absolute bottom-[168px] right-0 w-48 rounded-2xl rounded-br-sm px-4 py-3 text-xs text-slate-200 shadow-lg pointer-events-none"
    >
      {isPanicking ? "Waduh ketahuan! 🙈" : "Butuh bantuan? Klik tombol WA ini ya 👋"}
    </motion.div>
  );
}
