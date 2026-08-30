"use client";

import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { RefreshCw } from "lucide-react";

export interface CanvasCaptchaRef {
  refresh: () => void;
  getCode: () => string;
}

interface CanvasCaptchaProps {
  onCodeChange?: (code: string) => void;
}

export const CanvasCaptcha = forwardRef<CanvasCaptchaRef, CanvasCaptchaProps>(
  ({ onCodeChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [captchaCode, setCaptchaCode] = useState("");

    const generateRandomCode = (length = 5) => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const drawCaptcha = (code: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#0f172a");
      gradient.addColorStop(1, "#1e293b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Noise lines
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = `rgba(${Math.floor(Math.random() * 200 + 55)}, ${Math.floor(
          Math.random() * 200 + 55
        )}, ${Math.floor(Math.random() * 200 + 55)}, 0.4)`;
        ctx.lineWidth = Math.random() * 2 + 1;
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.lineTo(Math.random() * width, Math.random() * height);
        ctx.stroke();
      }

      // Noise dots
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw characters with rotation & color variation
      const charWidth = (width - 20) / code.length;
      ctx.font = "bold 24px monospace";
      ctx.textBaseline = "middle";

      for (let i = 0; i < code.length; i++) {
        ctx.save();
        const x = 15 + i * charWidth;
        const y = height / 2 + (Math.random() * 6 - 3);

        ctx.translate(x, y);
        const angle = (Math.random() * 30 - 15) * (Math.PI / 180);
        ctx.rotate(angle);

        // Character color
        const colors = ["#38bdf8", "#34d399", "#f472b6", "#fbbf24", "#a78bfa"];
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillText(code[i], 0, 0);

        ctx.restore();
      }
    };

    const refresh = () => {
      const newCode = generateRandomCode();
      setCaptchaCode(newCode);
      drawCaptcha(newCode);
      if (onCodeChange) onCodeChange(newCode);
    };

    useImperativeHandle(ref, () => ({
      refresh,
      getCode: () => captchaCode,
    }));

    useEffect(() => {
      refresh();
    }, []);

    return (
      <div className="flex items-center gap-3">
        <div className="relative rounded-xl overflow-hidden border border-white/15 bg-slate-900 shadow-inner">
          <canvas ref={canvasRef} width={150} height={42} className="block cursor-pointer" onClick={refresh} title="Klik untuk ganti captcha" />
        </div>
        <button
          type="button"
          onClick={refresh}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition"
          title="Refresh Captcha"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    );
  }
);

CanvasCaptcha.displayName = "CanvasCaptcha";
