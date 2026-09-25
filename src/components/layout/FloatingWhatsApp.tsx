"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useRobot } from "./RobotContext";
import { WhatsAppBubble } from "./whatsapp/WhatsAppBubble";
import { RobotCharacter } from "./whatsapp/RobotCharacter";

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

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isShyRef.current || isPanickingRef.current) return;

    idleTimerRef.current = setTimeout(() => {
      if (!isIdleRef.current && !isShyRef.current && !isPanickingRef.current) {
        const firstTarget = getRandomTarget(0, 0);
        setCurrentPos({ x: 0, y: 0 });
        setNextTarget(firstTarget);
        setIsIdle(true);
      }
    }, 35000);
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
            resetIdleTimer();
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
      <WhatsAppBubble showBubble={showBubble && !isShy && !isIdle} isPanicking={isPanicking} />

      <RobotCharacter
        mousePos={mousePos}
        isShy={isShy}
        onClick={handleRobotClick}
        getAnimateTarget={getAnimateTarget}
        getTransitionTarget={getTransitionTarget}
        onAnimationComplete={handleAnimationComplete}
        currentPos={currentPos}
        nextTarget={nextTarget}
      />

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
