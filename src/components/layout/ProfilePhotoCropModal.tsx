"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Move } from "lucide-react";

interface ProfilePhotoCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}

export function ProfilePhotoCropModal({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
}: ProfilePhotoCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  // Mouse / Touch handlers for Panning
  const handleMouseDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + deltaX,
      y: panStartRef.current.y + deltaY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Crop & Export to 1:1 Canvas (WYSIWYG: Exactly what is visible inside the 1:1 viewport)
  const handleApplyCrop = () => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;

    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const outputSize = 400; // 1:1 Canvas size (400x400)
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale factor from viewport screen pixels to 400x400 canvas
    const scale = outputSize / containerRect.width;

    // Calculate exact image position relative to top-left of the 1:1 viewport
    const drawX = (imgRect.left - containerRect.left) * scale;
    const drawY = (imgRect.top - containerRect.top) * scale;
    const drawWidth = imgRect.width * scale;
    const drawHeight = imgRect.height * scale;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, outputSize, outputSize);

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    onCropComplete(croppedDataUrl);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100000001] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-white/20 p-6 shadow-2xl text-white select-none"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">Atur Foto Profil (1:1)</h3>
            <p className="text-xs text-white/60">
              Area di dalam bingkai kotak 1:1 akan menjadi foto profil Anda
            </p>
          </div>

          {/* Interactive Crop Viewport Frame (1:1 Square Box) */}
          <div className="flex justify-center my-2">
            <div
              ref={containerRef}
              onMouseDown={(e) => handleMouseDown(e.clientX, e.clientY)}
              onMouseMove={(e) => handleMouseMove(e.clientX, e.clientY)}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={(e) => {
                if (e.touches[0]) handleMouseDown(e.touches[0].clientX, e.touches[0].clientY);
              }}
              onTouchMove={(e) => {
                if (e.touches[0]) handleMouseMove(e.touches[0].clientX, e.touches[0].clientY);
              }}
              onTouchEnd={handleMouseUp}
              className="relative w-[280px] h-[280px] overflow-hidden rounded-2xl border-2 border-emerald-500/80 bg-slate-950 cursor-grab active:cursor-grabbing flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)]"
            >
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop preview"
                draggable={false}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  transition: isDragging ? "none" : "transform 0.05s ease-out",
                }}
                className="pointer-events-none select-none"
              />

              {/* Grid Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
                <div className="border-r border-b border-white/10"></div>
                <div className="border-r border-b border-white/10"></div>
                <div className="border-b border-white/10"></div>
                <div className="border-r border-b border-white/10"></div>
                <div className="border-r border-b border-white/10"></div>
                <div className="border-b border-white/10"></div>
                <div className="border-r border-white/10"></div>
                <div className="border-r border-white/10"></div>
                <div></div>
              </div>

              {/* Center Hint Badge */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-white/70 pointer-events-none flex items-center gap-1 border border-white/10">
                <Move className="w-3 h-3 text-emerald-400" />
                <span>Geser foto</span>
              </div>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="space-y-2 mt-4 px-2">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span className="font-medium">Perbesar / Perkecil</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.15))}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition cursor-pointer"
                title="Perkecil"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
              />

              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(3, prev + 0.15))}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition cursor-pointer"
                title="Perbesar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition cursor-pointer"
                title="Reset Posisi"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Terapkan Foto</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}