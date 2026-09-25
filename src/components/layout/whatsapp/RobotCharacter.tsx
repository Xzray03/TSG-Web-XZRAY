"use client";

import { motion } from "framer-motion";

interface RobotCharacterProps {
  mousePos: { x: number; y: number };
  isShy: boolean;
  onClick: () => void;
  getAnimateTarget: () => any;
  getTransitionTarget: () => any;
  onAnimationComplete: () => void;
  currentPos: { x: number; y: number };
  nextTarget: { x: number; y: number };
}

export function RobotCharacter({
  mousePos,
  isShy,
  onClick,
  getAnimateTarget,
  getTransitionTarget,
  onAnimationComplete,
  currentPos,
  nextTarget,
}: RobotCharacterProps) {
  return (
    <motion.div
      key={`${currentPos.x}-${currentPos.y}-${nextTarget.x}`}
      onClick={onClick}
      initial={{ x: currentPos.x, y: currentPos.y }}
      animate={getAnimateTarget()}
      transition={getTransitionTarget()}
      onAnimationComplete={onAnimationComplete}
      className={`pointer-events-auto -mb-3 drop-shadow-[0_10px_20px_rgba(6,182,212,0.35)] ${
        isShy ? "cursor-default opacity-90" : "cursor-pointer"
      } gpu-accelerated`}
      style={{ willChange: "transform, opacity" }}
    >
      <svg
        width="80"
        height="80"
        viewBox="0 0 100 100"
        fill="none"
        className="gpu-accelerated"
        style={{ willChange: "transform" }}
      >
        <defs>
          <linearGradient
            id="botBody"
            x1="15"
            y1="15"
            x2="85"
            y2="85"
            gradientUnits="userSpaceOnUse"
          >
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

        <line
          x1="50"
          y1="10"
          x2="50"
          y2="20"
          stroke="#22D3EE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <motion.circle
          cx="50"
          cy="8"
          r="4.5"
          fill="#22D3EE"
          animate={
            isShy
              ? { opacity: 0.5 }
              : { opacity: [1, 0.35, 1], scale: [1, 1.25, 1] }
          }
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

        <rect
          x="80"
          y="46"
          width="10"
          height="18"
          rx="5"
          fill="url(#botBody)"
        />

        <rect
          x="18"
          y="18"
          width="64"
          height="64"
          rx="26"
          fill="url(#botBody)"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1.5"
        />

        <rect
          x="29"
          y="32"
          width="42"
          height="30"
          rx="14"
          fill="#050B18"
        />

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
  );
}
