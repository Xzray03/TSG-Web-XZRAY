"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, ShieldCheck, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { loadFaceLandmarker } from "@/lib/faceModelLoader";
import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { getOrCreateDeviceKey, getDeviceInfo } from "@/lib/deviceKeyManager";
import { uploadToCatboxAction, submitRegistrationVerificationAction, checkVerificationStatusAction } from "@/actions/tsgVerifActions";

interface TSGRegistrationVerifModalProps {
  isOpen: boolean;
  name: string;
  generation: string;
  onClose: () => void;
  onApproved: () => void;
}

export function TSGRegistrationVerifModal({
  isOpen,
  name,
  generation,
  onClose,
  onApproved,
}: TSGRegistrationVerifModalProps) {
  const [verifStatus, setVerifStatus] = useState<"checking" | "none" | "pending" | "approved" | "rejected" | "expired">("checking");
  const [step, setStep] = useState<"status" | "camera" | "submitting">("status");
  const [errorMsg, setErrorMsg] = useState("");
  const [instruction, setInstruction] = useState("Memuat model Face Landmarker...");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const requestRef = useRef<number>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const isRunningRef = useRef<boolean>(false);

  const deviceId = getOrCreateDeviceKey();
  const deviceInfo = getDeviceInfo();
  const browserName = `${deviceInfo.platform || "Device"} (${deviceInfo.userAgent ? deviceInfo.userAgent.split(" ")[0] : "Browser"})`;

  useEffect(() => {
    if (!isOpen || !name) return;

    async function checkStatus() {
      setVerifStatus("checking");
      try {
        const res = await checkVerificationStatusAction(name, deviceId);
        if (res.status === "approved") {
          setVerifStatus("approved");
          onApproved();
        } else if (res.status === "pending") {
          setVerifStatus("pending");
          setStep("status");
        } else if (res.status === "rejected") {
          setVerifStatus("rejected");
          setStep("status");
        } else if (res.status === "expired") {
          setVerifStatus("expired");
          setStep("status");
        } else {
          setVerifStatus("none");
          setStep("camera");
          startCamera();
        }
      } catch (e) {
        setVerifStatus("none");
        setStep("camera");
        startCamera();
      }
    }

    checkStatus();

    checkIntervalRef.current = setInterval(async () => {
      const res = await checkVerificationStatusAction(name, deviceId);
      if (res.status === "approved") {
        setVerifStatus("approved");
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        onApproved();
      } else if (res.status === "rejected") {
        setVerifStatus("rejected");
      } else if (res.status === "expired") {
        setVerifStatus("expired");
      }
    }, 8000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      stopCamera();
    };
  }, [isOpen, name, deviceId]);

  const startCamera = async () => {
    setErrorMsg("");
    try {
      if (!landmarkerRef.current) {
        landmarkerRef.current = await loadFaceLandmarker();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        isRunningRef.current = true;
        setInstruction("Posisikan wajah Anda dan Buka Mulut.");
        predictWebcam();
      }
    } catch (err: any) {
      setErrorMsg("Gagal mengakses kamera: " + (err.message || "Izin ditolak"));
    }
  };

  const stopCamera = () => {
    isRunningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    setIsCameraActive(false);
  };

  const captureSnapshot = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  const predictWebcam = async () => {
    if (!isRunningRef.current) return;

    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (video && landmarker && video.readyState >= 2 && !video.paused && !video.ended) {
      const currentTime = video.currentTime;
      if (currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = currentTime;
        try {
          const results = landmarker.detectForVideo(video, performance.now());
          if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            setInstruction("Wajah terdeteksi! Silakan Buka Mulut.");
            const landmarks = results.faceLandmarks[0];
            const upperLip = landmarks[13];
            const lowerLip = landmarks[14];
            const mouthOpenHeight = Math.hypot(upperLip.x - lowerLip.x, upperLip.y - lowerLip.y);

            if (mouthOpenHeight > 0.04) {
              isRunningRef.current = false;
              setInstruction("Pose Buka Mulut terdeteksi!");
              handleCaptureAndSubmit();
              return;
            }
          } else {
            setInstruction("Posisikan wajah di dalam kamera.");
          }
        } catch (e) {}
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const handleCaptureAndSubmit = async () => {
    setIsSubmitting(true);
    setStep("submitting");

    try {
      const snapshotBase64 = captureSnapshot();
      stopCamera();

      if (!snapshotBase64) {
        throw new Error("Gagal mengambil foto snapshot.");
      }

      const uploadRes = await uploadToCatboxAction(snapshotBase64, `verif_${Date.now()}.jpg`);
      const snapshotUrl = uploadRes.url || snapshotBase64;

      const submitRes = await submitRegistrationVerificationAction({
        deviceId,
        browser: browserName,
        name,
        generation,
        snapshotUrl,
      });

      if (submitRes.error) {
        throw new Error(submitRes.error);
      }

      localStorage.setItem("tsg_registration_verification", JSON.stringify({
        name,
        generation,
        deviceId,
        submittedAt: new Date().toISOString(),
      }));

      setVerifStatus("pending");
      setStep("status");
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengirim verifikasi pendaftaran.");
      setStep("camera");
      startCamera();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative my-auto w-full max-w-md rounded-3xl bg-slate-900 border border-white/20 p-6 shadow-2xl text-white"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Verifikasi Pendaftaran TSG</h3>
              <p className="text-xs text-white/60">Pemeriksaan akun Anggota TSG Baru</p>
            </div>
          </div>

          {verifStatus === "checking" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
              <p className="text-xs text-white/70">Memeriksa status pengajuan...</p>
            </div>
          )}

          {verifStatus === "pending" && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
              <div className="p-3 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>
              <h4 className="text-sm font-bold text-amber-300">Pendaftaran akun sedang diajukan</h4>
              <p className="text-xs text-white/70 max-w-xs leading-relaxed">
                Pengajuan verifikasi untuk <span className="font-semibold text-white">{name}</span> ({generation}) sedang ditinjau oleh akun Creator melalui Chat Resmi TSG.
              </p>
              <div className="w-full rounded-2xl bg-white/5 border border-white/10 p-3 text-left text-[11px] text-white/60 space-y-1">
                <p>• Device: <span className="text-white/80">{browserName}</span></p>
                <p>• Status: <span className="text-amber-400 font-semibold">Menunggu Persetujuan</span></p>
              </div>
              <button
                type="button"
                onClick={() => checkVerificationStatusAction(name, deviceId).then((res) => {
                  if (res.status === "approved") {
                    setVerifStatus("approved");
                    onApproved();
                  }
                })}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer mt-2"
              >
                Cek Ulang Status
              </button>
            </div>
          )}

          {(verifStatus === "rejected" || verifStatus === "expired") && step === "status" && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
              <div className="p-3 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-rose-300">
                {verifStatus === "expired" ? "Pengajuan Kedaluwarsa (30 Hari)" : "Pengajuan Ditolak"}
              </h4>
              <p className="text-xs text-white/70 max-w-xs leading-relaxed">
                {verifStatus === "expired"
                  ? "Batas waktu pengajuan 30 hari telah habis. Silakan lakukan verifikasi ulang."
                  : "Pengajuan Anda ditolak oleh Creator. Silakan lakukan verifikasi ulang."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setVerifStatus("none");
                  setStep("camera");
                  startCamera();
                }}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                Ajukan Verifikasi Ulang
              </button>
            </div>
          )}

          {step === "camera" && verifStatus === "none" && (
            <div className="space-y-4">
              <p className="text-xs text-white/70 leading-relaxed">
                Verifikasi awal wajah diperlukan sebelum mendaftar. Posisikan wajah dan <span className="font-semibold text-amber-300">Buka Mulut</span> saat terdeteksi.
              </p>

              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/20 bg-slate-950 flex items-center justify-center">
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover -scale-x-100" />
                <canvas ref={canvasRef} className="hidden" />

                {!isCameraActive && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4" /> Buka Kamera
                  </button>
                )}
              </div>

              {isCameraActive && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-center text-xs text-amber-300 font-medium">
                  {instruction}
                </div>
              )}

              {errorMsg && (
                <p className="text-xs text-rose-400 text-center font-medium">{errorMsg}</p>
              )}
            </div>
          )}

          {step === "submitting" && (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs text-white/80 font-medium">Mengunggah foto snapshot ke Catbox & mengirim pengajuan...</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
