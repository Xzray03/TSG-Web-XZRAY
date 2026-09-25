import { loadFaceRecognitionModel } from "@/lib/faceRecognitionLoader";

export async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Respon server tidak valid (${res.status}). Mohon coba beberapa saat lagi.`,
    );
  }
}

export const captureSnapshot = (videoEl: HTMLVideoElement): string | null => {
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

export const computeEmbeddingFromDataUrl = async (
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
        await loadFaceRecognitionModel();
        const options = new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.2,
        });
        const detection = await faceapi
          .detectSingleFace(img, options)
          .withFaceLandmarks(false)
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
