"use client";

import React, { useState, useRef, useEffect } from "react";
import { loadFaceLandmarker } from "@/lib/faceModelLoader";
import { loadFaceRecognitionModel } from "@/lib/faceRecognitionLoader";
import { FaceLandmarker } from "@mediapipe/tasks-vision";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

interface FaceVerificationModalProps {
  isOpen: boolean;
  mode: "register" | "login";
  storedFaceVectors?: Array<number[]>;
  initialName?: string;
  isTsgMember?: boolean;
  tsgInfo?: any;
  onClose: () => void;
  onVerified: (memberData: any) => void;
}

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Respon server tidak valid (${res.status}). Mohon coba beberapa saat lagi.`,
    );
  }
}

export default function FaceVerificationModal({
  isOpen,
  mode,
  storedFaceVectors = [],
  initialName = "",
  isTsgMember = false,
  tsgInfo,
  onClose,
  onVerified,
}: FaceVerificationModalProps) {
  const [step, setStep] = useState<
    "LOADING_MODEL" | "VERIFYING" | "SUCCESS" | "SYNCING"
  >("LOADING_MODEL");
  const [livenessTask, setLivenessTask] = useState<
    "BLINK_1" | "BLINK_2" | "TURN_RIGHT" | "TURN_LEFT" | "OPEN_MOUTH"
  >("BLINK_1");
  const [statusMessage, setStatusMessage] = useState(
    "Memuat model Face Landmarker & AI Recognition...",
  );
  const [errorMsg, setErrorMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const isRunningRef = useRef<boolean>(false);

  // Snapshot liveness
  const blinkSnapshotRef = useRef<string | null>(null);
  const lookRightSnapshotRef = useRef<string | null>(null);
  const lookLeftSnapshotRef = useRef<string | null>(null);
  const openMouthSnapshotRef = useRef<string | null>(null);

  const livenessState = useRef({
    blinkCount: 0,
    wasClosed: false,
    turnRightDetected: false,
    turnLeftDetected: false,
    mouthOpenDetected: false,
    completed: false,
  });

  const captureSnapshot = (videoEl: HTMLVideoElement): string | null => {
    try {
      const canvas = document.createElement("canvas");
      const vw = videoEl.videoWidth || videoEl.clientWidth || 640;
      const vh = videoEl.videoHeight || videoEl.clientHeight || 480;

      if (!vw || !vh || vw < 10 || vh < 10) return null;

      const size = Math.min(vw, vh);
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 400);

      const sx = (vw - size) / 2;
      const sy = (vh - size) / 2;

      ctx.drawImage(videoEl, sx, sy, size, size, 0, 0, 400, 400);
      return canvas.toDataURL("image/jpeg", 0.9);
    } catch (e) {
      return null;
    }
  };

  const computeEmbeddingFromDataUrl = async (
    dataUrl: string,
  ): Promise<Float32Array | null> => {
    return new Promise((resolve) => {
      if (!dataUrl) {
        resolve(null);
        return;
      }
      const img = new window.Image();
      img.onload = async () => {
        try {
          const faceapi = await import("@vladmandic/face-api");
          if (
            !faceapi.nets.tinyFaceDetector.isLoaded ||
            !faceapi.nets.faceLandmark68Net.isLoaded ||
            !faceapi.nets.faceRecognitionNet.isLoaded
          ) {
            await loadFaceRecognitionModel();
          }
          const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.2,
          });
          const detection = await faceapi
            .detectSingleFace(img, options)
            .withFaceLandmarks(true)
            .withFaceDescriptor();

          if (detection && detection.descriptor) {
            resolve(detection.descriptor);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  };

  useEffect(() => {
    let isMounted = true;
    if (!isOpen) return;

    setErrorMsg("");
    setStep("LOADING_MODEL");
    setLivenessTask("BLINK_1");
    livenessState.current = {
      blinkCount: 0,
      wasClosed: false,
      turnRightDetected: false,
      turnLeftDetected: false,
      mouthOpenDetected: false,
      completed: false,
    };
    blinkSnapshotRef.current = null;
    lookRightSnapshotRef.current = null;
    lookLeftSnapshotRef.current = null;
    openMouthSnapshotRef.current = null;

    let cameraStream: MediaStream | null = null;

    async function initVerification() {
      try {
        if (
          typeof window !== "undefined" &&
          navigator.mediaDevices &&
          navigator.mediaDevices.getUserMedia
        ) {
          try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user",
              },
              audio: false,
            });
          } catch (camErr) {}
        }

        setStatusMessage("Memuat model AI (MediaPipe & Face-API)...");

        if (!landmarkerRef.current) {
          landmarkerRef.current = await loadFaceLandmarker();
        }
        await loadFaceRecognitionModel();

        if (!isMounted) {
          if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
          return;
        }

        setStep("VERIFYING");
        isRunningRef.current = true;
        setTimeout(() => {
          if (isMounted) {
            startCamera(cameraStream);
          }
        }, 150);
      } catch (err: any) {
        if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
        if (isMounted)
          setErrorMsg(err.message || "Terjadi kesalahan saat inisialisasi.");
      }
    }

    initVerification();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async (prefetchedStream?: MediaStream | null) => {
    try {
      let stream = prefetchedStream;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {}
        if (isRunningRef.current) {
          requestRef.current = requestAnimationFrame(predictWebcam);
        }
      }
    } catch (err: any) {
      setErrorMsg(
        "Gagal mengakses kamera. Mohon berikan izin kamera pada browser Anda.",
      );
    }
  };

  const stopCamera = () => {
    isRunningRef.current = false;
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  };

  const predictWebcam = async () => {
    if (!isRunningRef.current || livenessState.current.completed) return;

    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (
      video &&
      landmarker &&
      video.readyState >= 2 &&
      !video.paused &&
      !video.ended
    ) {
      const currentTime = video.currentTime;
      if (
        currentTime > 0 &&
        !isNaN(currentTime) &&
        currentTime !== lastVideoTimeRef.current
      ) {
        lastVideoTimeRef.current = currentTime;
        let startTimeMs = performance.now();

        try {
          const faceapi = await import("@vladmandic/face-api");
          if (
            !faceapi.nets.tinyFaceDetector.isLoaded ||
            !faceapi.nets.faceLandmark68Net.isLoaded ||
            !faceapi.nets.faceRecognitionNet.isLoaded
          ) {
            await loadFaceRecognitionModel();
          }

          const originalInfo = console.info;
          console.info = (...args: any[]) => {
            if (
              args[0] &&
              typeof args[0] === "string" &&
              args[0].includes("XNNPACK")
            )
              return;
            originalInfo(...args);
          };
          const results = landmarker.detectForVideo(video, startTimeMs);
          console.info = originalInfo;

          if (
            results &&
            results.faceLandmarks &&
            results.faceLandmarks.length > 0
          ) {
            const state = livenessState.current;

            if (state.blinkCount < 2) {
              const leftEyeTop = results.faceLandmarks[0][159];
              const leftEyeBottom = results.faceLandmarks[0][145];
              const leftEyeHeight = Math.hypot(
                leftEyeTop.x - leftEyeBottom.x,
                leftEyeTop.y - leftEyeBottom.y,
              );

              if (leftEyeHeight < 0.015) {
                state.wasClosed = true;
              } else {
                if (state.wasClosed) {
                  state.wasClosed = false;
                  state.blinkCount += 1;

                  if (state.blinkCount === 1) {
                    blinkSnapshotRef.current = captureSnapshot(video);
                    setLivenessTask("BLINK_2");
                  } else if (state.blinkCount >= 2) {
                    setLivenessTask("TURN_RIGHT");
                  }
                }
              }
            } else if (!state.turnRightDetected) {
              const noseTip = results.faceLandmarks[0][1];
              const leftCheek = results.faceLandmarks[0][234];
              const rightCheek = results.faceLandmarks[0][454];
              const yawRatio =
                (noseTip.x - leftCheek.x) / (rightCheek.x - leftCheek.x);

              if (yawRatio < 0.4) {
                state.turnRightDetected = true;
                lookRightSnapshotRef.current = captureSnapshot(video);
                setLivenessTask("TURN_LEFT");
              }
            } else if (!state.turnLeftDetected) {
              const noseTip = results.faceLandmarks[0][1];
              const leftCheek = results.faceLandmarks[0][234];
              const rightCheek = results.faceLandmarks[0][454];
              const yawRatio =
                (noseTip.x - leftCheek.x) / (rightCheek.x - leftCheek.x);

              if (yawRatio > 0.6) {
                state.turnLeftDetected = true;
                lookLeftSnapshotRef.current = captureSnapshot(video);
                setLivenessTask("OPEN_MOUTH");
              }
            } else if (!state.mouthOpenDetected) {
              const upperLip = results.faceLandmarks[0][13];
              const lowerLip = results.faceLandmarks[0][14];
              const mouthOpenHeight = Math.hypot(
                upperLip.x - lowerLip.x,
                upperLip.y - lowerLip.y,
              );

              if (mouthOpenHeight > 0.04) {
                state.mouthOpenDetected = true;
                state.completed = true;

                openMouthSnapshotRef.current = captureSnapshot(video);
                stopCamera();
                setStep("SYNCING");

                (async () => {
                  try {
                    const blinkSnap = blinkSnapshotRef.current;
                    const rightSnap = lookRightSnapshotRef.current;
                    const leftSnap = lookLeftSnapshotRef.current;
                    const mouthSnap = openMouthSnapshotRef.current;

                    if (!blinkSnap && !mouthSnap) {
                      throw new Error("Gagal mengambil snapshot wajah.");
                    }

                    // Compute embedding for all 4 snapshots
                    const [vBlink, vRight, vLeft, vMouth] = await Promise.all([
                      computeEmbeddingFromDataUrl(blinkSnap || ""),
                      computeEmbeddingFromDataUrl(rightSnap || ""),
                      computeEmbeddingFromDataUrl(leftSnap || ""),
                      computeEmbeddingFromDataUrl(mouthSnap || ""),
                    ]);

                    const baseVec = vBlink || vMouth || vRight || vLeft;
                    if (!baseVec) {
                      throw new Error("Gagal mengekstrak fitur wajah dari pemindaian.");
                    }

                    const fourVectors = [
                      Array.from(vBlink || baseVec),
                      Array.from(vRight || baseVec),
                      Array.from(vLeft || baseVec),
                      Array.from(vMouth || baseVec),
                    ];

                    const snapDataToSave = mouthSnap || blinkSnap || "";

                    if (mode === "register") {
                      // PENDAFTARAN PERTAMA KALI: Simpan 4 vektor + foto buka mulut
                      const res = await fetch("/api/auth", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "x-tsg-client-verify": "true",
                        },
                        body: JSON.stringify({
                          action: "register_face",
                          name: initialName,
                          faceVector: fourVectors,
                          mouthOpenSnapshot: snapDataToSave,
                          isTsgMember: isTsgMember,
                          tsgInfo: tsgInfo,
                        }),
                      });

                      const data = await parseJsonResponse(res);
                      if (!res.ok || !data.success) {
                        throw new Error(data.error || "Gagal menyimpan pendaftaran wajah.");
                      }
                    } else {
                      // LOGIN / VERIFIKASI: Bandingkan dengan patokan utama (storedFaceVectors[0])
                      if (!storedFaceVectors || storedFaceVectors.length === 0) {
                        throw new Error("Histori wajah tidak ditemukan di database.");
                      }

                      const faceapi = await import("@vladmandic/face-api");
                      if (
                        !faceapi.nets.tinyFaceDetector.isLoaded ||
                        !faceapi.nets.faceLandmark68Net.isLoaded ||
                        !faceapi.nets.faceRecognitionNet.isLoaded
                      ) {
                        await loadFaceRecognitionModel();
                      }
                      let minDistance = 999;

                      // Check against storedFaceVectors[0] (patokan utama pendaftaran/penambahan wajah)
                      const histEntry = storedFaceVectors[0];
                      if (histEntry && Array.isArray(histEntry) && histEntry.length > 0) {
                        if (Array.isArray(histEntry[0])) {
                          const distances: number[] = [];
                          for (let i = 0; i < 4; i++) {
                            const newV = fourVectors[i];
                            const histV = (histEntry as unknown as Array<number[]>)[i] || (histEntry as unknown as Array<number[]>)[0];
                            if (newV && histV) {
                              const dist = faceapi.euclideanDistance(
                                new Float32Array(newV),
                                new Float32Array(histV)
                              );
                              distances.push(dist);
                            }
                          }
                          if (distances.length > 0) {
                            minDistance = Math.min(...distances);
                          }
                        } else {
                          for (const newV of fourVectors) {
                            const dist = faceapi.euclideanDistance(
                              new Float32Array(newV),
                              new Float32Array(histEntry as unknown as number[])
                            );
                            if (dist < minDistance) minDistance = dist;
                          }
                        }
                      }

                      const THRESHOLD = 0.52;
                      if (minDistance > THRESHOLD) {
                        throw new Error("Verifikasi Wajah Gagal: Wajah tidak cocok dengan patokan pendaftaran utama.");
                      }

                      // Update histori (menambah histori login terbaru & foto buka mulut, FIFO max 3, namun patokan utama tetap tidak berubah)
                      await fetch("/api/auth", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "x-tsg-client-verify": "true",
                        },
                        body: JSON.stringify({
                          action: "login_face_update",
                          name: initialName,
                          newFaceVector: fourVectors,
                          newMouthOpenSnapshot: snapDataToSave,
                        }),
                      });
                    }

                    const existingSavedProfile = localStorage.getItem("tsg_user_profile");
                    let existingCustomPhoto = "";
                    if (existingSavedProfile) {
                      try {
                        const parsed = JSON.parse(existingSavedProfile);
                        if (parsed.iconDataUrl && !isTsgMember) {
                          existingCustomPhoto = parsed.iconDataUrl;
                        }
                      } catch (e) {}
                    }

                    const profile = {
                      name: initialName,
                      isTsgMember: isTsgMember,
                      generation: tsgInfo?.categoryName || "",
                      email: tsgInfo?.email || "",
                      authMethod: "face",
                      iconDataUrl: isTsgMember ? (tsgInfo?.photo || "") : existingCustomPhoto,
                    };

                    localStorage.setItem("tsg_user_profile", JSON.stringify(profile));

                    setStep("SUCCESS");

                    setTimeout(() => {
                      onVerified(profile);
                      onClose();
                    }, 800);
                  } catch (verifyErr: any) {
                    setErrorMsg(
                      verifyErr.message ||
                        "Terjadi kesalahan saat memproses verifikasi wajah.",
                    );
                  }
                })();
              }
            }
          }
        } catch (e) {}
      }
    }

    if (isRunningRef.current && !livenessState.current.completed) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-white/20 p-6 sm:p-7 shadow-[0_0_100px_rgba(0,0,0,0.9)] text-white scrollbar-thin">
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          aria-label="Tutup"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Camera className="w-6 h-6 text-emerald-400" />
          Verifikasi Wajah & Liveness AI
        </h3>

        {errorMsg ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-950/40 p-4 rounded-xl border border-rose-900/50">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => {
                stopCamera();
                setErrorMsg("");
                setStep("LOADING_MODEL");
              }}
              className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold flex items-center justify-center gap-2 transition"
            >
              <RefreshCw className="w-4 h-4" /> Coba Lagi
            </button>
          </div>
        ) : step === "LOADING_MODEL" ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
            <p className="text-sm text-white/70 text-center">{statusMessage}</p>
          </div>
        ) : step === "SUCCESS" ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-bounce" />
            <h4 className="text-lg font-semibold text-center">
              Verifikasi Berhasil!
            </h4>
            <p className="text-sm text-white/60 text-center">
              {mode === "register"
                ? "Pendaftaran wajah berhasil disimpan. Memuat profil..."
                : "Wajah Anda cocok dengan histori. Memuat profil..."}
            </p>
          </div>
        ) : step === "SYNCING" ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            <h4 className="text-lg font-semibold text-center">
              Memproses Vektor Wajah...
            </h4>
            <p className="text-sm text-white/60 text-center">
              {mode === "register"
                ? "Menyimpan sampel awal data wajah ke database..."
                : "Mencocokkan pemindaian dengan histori pendaftaran..."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black border border-white/10">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-center">
                <span className="text-xs font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
                  {livenessTask === "BLINK_1" && "Kedipkan mata Anda (1/2)"}
                  {livenessTask === "BLINK_2" &&
                    "Kedipkan mata sekali lagi (2/2)"}
                  {livenessTask === "TURN_RIGHT" &&
                    "Tolehkan kepala ke kanan sedikit"}
                  {livenessTask === "TURN_LEFT" &&
                    "Tolehkan kepala ke kiri sedikit"}
                  {livenessState.current.blinkCount >= 2 &&
                    livenessTask === "OPEN_MOUTH" &&
                    "Buka mulut Anda sebentar"}
                </span>
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
              <div className="flex justify-between text-xs text-white/60">
                <span>Progress Verifikasi</span>
                <span>
                  {livenessTask === "BLINK_1" && "20%"}
                  {livenessTask === "BLINK_2" && "40%"}
                  {livenessTask === "TURN_RIGHT" && "60%`"}
                  {livenessTask === "TURN_LEFT" && "80%"}
                  {livenessTask === "OPEN_MOUTH" && "95%"}
                </span>
              </div>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                  style={{
                    width:
                      livenessTask === "BLINK_1"
                        ? "20%"
                        : livenessTask === "BLINK_2"
                          ? "40%"
                          : livenessTask === "TURN_RIGHT"
                            ? "60%"
                            : livenessTask === "TURN_LEFT"
                              ? "80%"
                              : "95%",
                  }}
                />
              </div>
              <p className="text-xs text-white/50 text-center pt-1">
                Verifikasi untuk: <span className="text-white font-medium">{initialName}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}