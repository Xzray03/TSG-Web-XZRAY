let loadingPromise: Promise<void> | null = null;

export async function loadFaceRecognitionModel(): Promise<void> {
  if (typeof window === "undefined") return;

  const faceapi = await import("@vladmandic/face-api");

  if (
    faceapi.nets.faceRecognitionNet.isLoaded &&
    faceapi.nets.tinyFaceDetector.isLoaded &&
    faceapi.nets.faceLandmark68Net.isLoaded
  ) {
    return;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  const MODEL_URL = "/models";

  loadingPromise = (async () => {
    try {
      await Promise.all([
        !faceapi.nets.tinyFaceDetector.isLoaded
          ? faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
          : Promise.resolve(),
        !faceapi.nets.faceLandmark68Net.isLoaded
          ? faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
          : Promise.resolve(),
        !faceapi.nets.faceRecognitionNet.isLoaded
          ? faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
          : Promise.resolve(),
      ]);
    } catch (err) {
      console.error("Gagal memuat model face-api:", err);
      loadingPromise = null;
      throw new Error("Gagal memuat model face recognition AI.");
    }
  })();

  return loadingPromise;
}