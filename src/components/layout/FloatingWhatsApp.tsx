"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useRobot } from "./RobotContext";

interface FloatingWhatsAppProps {
  whatsappNumber: string;
}

export function FloatingWhatsApp({ whatsappNumber }: FloatingWhatsAppProps) {
  const [showBubble, setShowBubble] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  
  const [isIdle, setIsIdle] = useState(false);
  const [isPanicking, setIsPanicking] = useState(false);
  const [isShy, setIsShy] = useState(false);

  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const shyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { isExcited } = useRobot();

  // Eye tracking state
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const isIdleRef = useRef(false);
  isIdleRef.current = isIdle;

  const isPanickingRef = useRef(false);
  isPanickingRef.current = isPanicking;

  const isShyRef = useRef(false);
  isShyRef.current = isShy;

  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  const getRandomTarget = (fromX: number, fromY: number) => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const maxX = Math.max(200, window.innerWidth - 180);
    const maxY = Math.max(200, window.innerHeight - 180);

    const rx = -Math.floor(Math.random() * maxX + 80);
    const ry = -Math.floor(Math.random() * maxY + 80);

    const dx = rx - fromX;
    const dy = ry - fromY;
    if (Math.sqrt(dx * dx + dy * dy) < 100) {
      return { x: Math.max(-maxX, rx - 150), y: Math.max(-maxY, ry - 150) };
    }

    return { x: rx, y: ry };
  };

  const [nextTarget, setNextTarget] = useState({ x: 0, y: 0 });

  // Fungsi untuk mereset timer idle dengan aman (35 detik)
  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    // Jangan set idle timer baru jika sedang panik atau malu
    if (isShyRef.current || isPanickingRef.current) return;

    idleTimerRef.current = setTimeout(() => {
      if (!isIdleRef.current && !isShyRef.current && !isPanickingRef.current) {
        const firstTarget = getRandomTarget(0, 0);
        setCurrentPos({ x: 0, y: 0 });
        setNextTarget(firstTarget);
        setIsIdle(true);
      }
    }, 35000); // 35 detik
  };

  useEffect(() => {
    const handleGlobalActivity = () => {
      if (isIdleRef.current && !isPanickingRef.current) {
        setIsPanicking(true);
        setIsIdle(false);
        if (shyTimerRef.current) clearTimeout(shyTimerRef.current);

        setTimeout(() => {
          setIsPanicking(false);
          setIsShy(true);
          setCurrentPos({ x: 0, y: 0 });
          
          if (shyTimerRef.current) clearTimeout(shyTimerRef.current);
          shyTimerRef.current = setTimeout(() => {
            setIsShy(false);
            resetIdleTimer(); // Pastikan timer idle dihidupkan kembali setelah mode malu selesai!
          }, 5000);
        }, 1200);

        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        return;
      }

      resetIdleTimer();
    };

    window.addEventListener("mousemove", handleGlobalActivity);
    window.addEventListener("mousedown", handleGlobalActivity);
    window.addEventListener("keydown", handleGlobalActivity);
    window.addEventListener("scroll", handleGlobalActivity);

    // Initial timer setup
    resetIdleTimer();

    return () => {
      window.removeEventListener("mousemove", handleGlobalActivity);
      window.removeEventListener("mousedown", handleGlobalActivity);
      window.removeEventListener("keydown", handleGlobalActivity);
      window.removeEventListener("scroll", handleGlobalActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (shyTimerRef.current) clearTimeout(shyTimerRef.current);
    };
  }, []);

  // Eye tracking
  useEffect(() => {
    const handleMouseMoveEye = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      
      const maxOffset = 3.5;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance === 0) {
        setMousePos({ x: 0, y: 0 });
        return;
      }
      const scale = Math.min(distance, 150) / 150;
      const angle = Math.atan2(dy, dx);
      
      setMousePos({
        x: Math.cos(angle) * maxOffset * scale,
        y: Math.sin(angle) * maxOffset * scale,
      });
    };

    window.addEventListener("mousemove", handleMouseMoveEye);
    return () => window.removeEventListener("mousemove", handleMouseMoveEye);
  }, []);

  const waNumber = whatsappNumber.replace(/[^0-9]/g, "");
  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    "Halo TSG, saya ingin bertanya."
  )}`;

  useEffect(() => {
    const showTimer = setTimeout(() => setShowBubble(true), 2000);
    const initialHideTimer = setTimeout(() => setShowBubble(false), 8000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(initialHideTimer);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setShowBubble(true);
  };

  const handleMouseLeave = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowBubble(false);
    }, 5000);
  };

  const handleRobotClick = () => {
    if (isJumping || isShy) return;
    setIsJumping(true);
    setTimeout(() => {
      setIsJumping(false);
    }, 600);
  };

  const activeJumping = isJumping || isExcited;

  const handleAnimationComplete = () => {
    if (isIdleRef.current && !isPanickingRef.current) {
      setCurrentPos(nextTarget);
      const newTarget = getRandomTarget(nextTarget.x, nextTarget.y);
      setNextTarget(newTarget);
    } else if (isPanicking) {
      setIsPanicking(false);
      setIsShy(true);
      setCurrentPos({ x: 0, y: 0 });
      if (shyTimerRef.current) clearTimeout(shyTimerRef.current);
      shyTimerRef.current = setTimeout(() => {
        setIsShy(false);
        resetIdleTimer();
      }, 5000);
    }
  };

  const getAnimateTarget = () => {
    if (isPanicking) {
      return {
        x: 0,
        y: 0,
        rotate: [0, -30, 20, 0],
        scale: [1, 1.1, 0.95, 1],
      };
    }
    if (isIdle) {
      return {
        x: nextTarget.x,
        y: nextTarget.y,
        rotate: [0, Math.random() * 25 - 12, 0],
        scale: [1, 1.02, 1],
      };
    }
    if (isShy) {
      return {
        x: 0,
        y: 12,
        rotate: 0,
        scale: 0.95,
      };
    }
    return {
      x: 0,
      y: activeJumping ? [0, -40, 0] : [0, -10, 0],
      rotate: activeJumping ? [0, 5, -5, 0] : 0,
      scale: 1,
    };
  };

  const getTransitionTarget = (): any => {
    if (isPanicking) {
      return { duration: 1.2, ease: "easeInOut" };
    }
    if (isIdle) {
      return {
        duration: Math.random() * 1.5 + 3.0,
        ease: "easeInOut",
      };
    }
    if (isShy) {
      return { duration: 0.3, ease: "easeOut" };
    }
    return activeJumping
      ? { duration: isExcited ? 0.45 : 0.6, repeat: isExcited ? Infinity : 0, ease: "easeInOut" }
      : { duration: 2.8, repeat: Infinity, ease: "easeInOut" };
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-center gpu-accelerated pointer-events-auto"
    >
      <AnimatePresence>
        {showBubble && !isShy && !isIdle && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            className="glass-strong absolute bottom-[168px] right-0 w-48 rounded-2xl rounded-br-sm px-4 py-3 text-xs text-slate-200 shadow-lg pointer-events-none"
          >
            {isPanicking ? "Waduh ketahuan! 🙈" : "Butuh bantuan? Klik tombol WA ini ya 👋"}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        key={`${currentPos.x}-${currentPos.y}-${nextTarget.x}`}
        onClick={handleRobotClick}
        initial={{ x: currentPos.x, y: currentPos.y }}
        animate={getAnimateTarget()}
        transition={getTransitionTarget()}
        onAnimationComplete={handleAnimationComplete}
        className={`pointer-events-auto -mb-3 drop-shadow-[0_10px_20px_rgba(6,182,212,0.35)] ${isShy ? 'cursor-default opacity-90' : 'cursor-pointer'} gpu-accelerated`}
        style={{ willChange: "transform, opacity" }}
      >
        <svg width="80" height="80" viewBox="0 0 100 100" fill="none" className="gpu-accelerated" style={{ willChange: "transform" }}>
          <defs>
            <linearGradient id="botBody" x1="15" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
            <radialGradient id="botGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
            </radialGradient>
          </defs>

          {!isShy && (
            <motion.ellipse
              cx="50"
              cy="86"
              rx="20"
              ry="5"
              fill="url(#botGlow)"
              animate={{ opacity: [0.9, 0.4, 0.9], scaleX: [1, 0.85, 1] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          <line x1="50" y1="10" x2="50" y2="20" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" />
          <motion.circle
            cx="50"
            cy="8"
            r="4.5"
            fill="#22D3EE"
            animate={isShy ? { opacity: 0.5 } : { opacity: [1, 0.35, 1], scale: [1, 1.25, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />

          <motion.rect
            x="10"
            y="42"
            width="10"
            height="20"
            rx="5"
            fill="url(#botBody)"
            animate={isShy ? { rotate: 0 } : { rotate: [0, -28, 0] }}
            transition={{ duration: 1.3, repeat: Infinity, repeatDelay: 0.8 }}
            style={{ transformOrigin: "18px 44px" }}
          />

          <rect x="80" y="46" width="10" height="18" rx="5" fill="url(#botBody)" />

          <rect x="18" y="18" width="64" height="64" rx="26" fill="url(#botBody)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />

          <rect x="29" y="32" width="42" height="30" rx="14" fill="#050B18" />

          {isShy ? (
            <g stroke="#22D3EE" strokeWidth="2" strokeLinecap="round">
              <path d="M38 45 L42 49 L46 45" />
              <path d="M54 45 L58 49 L62 45" />
            </g>
          ) : (
            <g transform={`translate(${mousePos.x}, ${mousePos.y})`}>
              <motion.rect
                x="37"
                y="43"
                width="8"
                height="8"
                rx="4"
                fill="#22D3EE"
                animate={{ scaleY: [1, 0.15, 1] }}
                transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 1.6 }}
                style={{ transformOrigin: "41px 47px" }}
              />
              <motion.rect
                x="55"
                y="43"
                width="8"
                height="8"
                rx="4"
                fill="#22D3EE"
                animate={{ scaleY: [1, 0.15, 1] }}
                transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 1.6 }}
                style={{ transformOrigin: "59px 47px" }}
              />
            </g>
          )}

          {isShy ? (
            <circle cx="50" cy="53" r="2" fill="#22D3EE" />
          ) : (
            <path
              d="M40 54 Q50 60 60 54"
              stroke="#22D3EE"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          )}

          <motion.circle
            cx="50"
            cy="72"
            r="4"
            fill="#22D3EE"
            animate={isShy ? { opacity: 0.3 } : { opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {!isShy && (
            <>
              <motion.circle
                cx="14"
                cy="24"
                r="1.6"
                fill="#22D3EE"
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: 0.4 }}
              />
              <motion.circle
                cx="88"
                cy="30"
                r="2"
                fill="#22D3EE"
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: 1.1 }}
              />
            </>
          )}
        </svg>
      </motion.div>

      <motion.a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hubungi TSG lewat WhatsApp"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_0_30px_-6px_rgba(37,211,102,0.7)] origin-bottom"
      >
        <MessageCircle className="h-6 w-6" fill="white" strokeWidth={0} />
      </motion.a>
    </div>
  );
}
