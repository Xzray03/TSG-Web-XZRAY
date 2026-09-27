// Web Crypto API AES-GCM 256 End-to-End Encryption
// Kunci simetris diturunkan di sisi client dari kombinasi ID kedua pengguna yang terurut.
// Server/database hanya menyimpan ciphertext terenkripsi (IV:CiphertextBase64).

function getConversationSalt(userA: string, userB: string): string {
  return [userA, userB].sort().join("::tsg-e2ee-salt::");
}

async function deriveConversationKey(userA: string, userB: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const saltStr = getConversationSalt(userA, userB);
  const rawKeyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(saltStr),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("TSG-WEB-XZRAY-E2EE-FIXED-SALT-V1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    rawKeyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptChatMessage(
  text: string,
  userA: string,
  userB: string
): Promise<string> {
  if (!text) return "";
  try {
    const key = await deriveConversationKey(userA, userB);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded
    );

    const ivBase64 = btoa(String.fromCharCode(...iv));
    const ctBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));

    return `e2ee:${ivBase64}:${ctBase64}`;
  } catch (err) {
    console.error("Encryption error:", err);
    return text;
  }
}

export async function decryptChatMessage(
  encryptedString: string,
  userA: string,
  userB: string
): Promise<string> {
  if (!encryptedString) return "";
  if (!encryptedString.startsWith("e2ee:")) {
    // Pesan lama atau unencrypted
    return encryptedString;
  }

  try {
    const parts = encryptedString.split(":");
    if (parts.length < 3) return encryptedString;

    const iv = Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(parts[2]), (c) => c.charCodeAt(0));

    const key = await deriveConversationKey(userA, userB);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.error("Decryption error:", err);
    return "🔒 [Pesan Terenkripsi Tidak Dapat Didekripsi]";
  }
}
