"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SocialPageClient } from "@/components/social/SocialPageClient";

export default function SocialPage() {
  const router = useRouter();

  useEffect(() => {
    async function verifyAuthAndPublicAccount() {
      try {
        const saved = localStorage.getItem("tsg_user_profile");
        if (!saved) {
          router.replace("/");
          return;
        }
        const profile = JSON.parse(saved);
        if (!profile || !profile.name || !profile.id) {
          router.replace("/");
          return;
        }

        const { getPublicAccountAction } = await import("@/actions/publicAccountActions");
        const res: any = await getPublicAccountAction(profile.id);
        if (!res || !res.publicAccount || !res.publicAccount.nickname) {
          router.replace("/");
          return;
        }
      } catch (e) {
        router.replace("/");
      }
    }
    verifyAuthAndPublicAccount();
  }, [router]);

  return <SocialPageClient initialPosts={[]} />;
}
