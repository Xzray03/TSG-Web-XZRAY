let isModelLoaded = false;

export async function loadFaceRecognitionModel(): Promise<void> {
  if (typeof window === "undefined") return;

  const faceapi = await import("@vladmandic/face-api");

  if (
    isModelLoaded &&
    faceapi.nets.faceRecognitionNet.isLoaded &&
    faceapi.nets.tinyFaceDetector.isLoaded &&
    faceapi.nets.faceLandmark68Net.isLoaded
  ) {
    return;
  }

  const MODEL_URL = "/models";

  try {
    if (!faceapi.nets.tinyFaceDetector.isLoaded) {
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    }
    if (!faceapi.nets.faceLandmark68Net.isLoaded) {
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    }
    if (!faceapi.nets.faceRecognitionNet.isLoaded) {
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    }
    isModelLoaded = true;
  } catch (err) {
    console.error("Gagal memuat model face-api:", err);
    throw new Error("Gagal memuat model face recognition AI.");
  }
}