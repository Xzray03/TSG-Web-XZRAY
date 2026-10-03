"use client";

import React, { useState } from "react";
import { Camera, X } from "lucide-react";
import FaceVerificationModal from "@/components/auth/FaceVerificationModal";

interface ChatE2EEFaceVerifyModalProps {
  isOpen: boolean;
  userId: string;
  onVerified: (faceVerifiedToken: string) => void;
  onClose: () => void;
}

/**
 * Reset chat key untuk akun face-only: verifikasi wajah via status token.
 * Hanya menerima STATUS token dari FaceVerificationModal (mode "reauth") — vectors tidak pernah keluar dari modal.
 */
export default function ChatE2EEFaceVerifyModal({
  isOpen,
  userId,
  onVerified,
  onClose,
}: ChatE2EEFaceVerifyModalProps) {
  if (!isOpen) return null;

  const handleFaceVerified = (result: any) => {
    const token = result?.faceVerifiedToken;
    if (!token) {
      // Re-auth gagal: jangan propagate, modal akan menampilkan error sendiri via onVerified yang tidak dipicu
      return;
    }
    onVerified(token);
  };

  return (
    <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <FaceVerificationModal
        isOpen={true}
        mode="reauth"
        initialName={userId}
        onClose={onClose}
        onVerified={handleFaceVerified}
      />
    </div>
  );
}
