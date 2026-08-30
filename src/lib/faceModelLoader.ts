import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

const MODEL_PATH = "/models/face_landmarker.task";
const CACHE_NAME = "tsg-face-model-cache-v1";

export async function loadFaceLandmarker(): Promise<FaceLandmarker> {
  const isMobile =
    typeof window !== "undefined" &&
    (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      typeof window.orientation !== "undefined" ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 2));

  let modelBuffer: ArrayBuffer | null = null;

  if (isMobile && typeof window !== "undefined" && "localStorage" in window) {
    try {
      const storedBase64 = localStorage.getItem("tsg_face_model_b64");
      if (storedBase64) {
        const binaryString = atob(storedBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        modelBuffer = bytes.buffer;
      }
    } catch {
      // Jika localStorage gagal/error, abaikan dan lanjut fetch
      modelBuffer = null;
    }
  }

  if (!modelBuffer) {
    if (!isMobile && typeof window !== "undefined" && "caches" in window) {
      try {
        const cache = await caches.open(CACHE_NAME);
        let cachedResponse = await cache.match(MODEL_PATH);

        if (!cachedResponse) {
          const response = await fetch(MODEL_PATH);
          if (!response.ok)
            throw new Error("Gagal mengunduh file model face_landmarker.task");
          await cache.put(MODEL_PATH, response.clone());
          cachedResponse = await cache.match(MODEL_PATH);
        }
        if (cachedResponse) {
          modelBuffer = await cachedResponse.arrayBuffer();
        }
      } catch {
        modelBuffer = null;
      }
    }

    if (!modelBuffer) {
      const response = await fetch(MODEL_PATH);
      if (!response.ok)
        throw new Error("Gagal mengunduh file model face_landmarker.task");
      modelBuffer = await response.arrayBuffer();

      // Coba simpan ke localStorage khusus mobile jika berhasil dan aman
      if (isMobile && typeof window !== "undefined" && "localStorage" in window) {
        try {
          const bytes = new Uint8Array(modelBuffer);
          let binary = "";
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64 = btoa(binary);
          localStorage.setItem("tsg_face_model_b64", base64);
        } catch {
          // Abaikan jika quota localStorage penuh atau gagal
        }
      }
    }
  }

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetBuffer: new Uint8Array(modelBuffer),
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });

  return faceLandmarker;
}
