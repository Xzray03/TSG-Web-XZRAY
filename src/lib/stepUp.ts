import { getStepUpNonceAction } from "@/actions/authActions";
import { proofMessage, signMessage } from "@/lib/deviceAuth";

export type StepUpPurpose =
  | "delete_account"
  | "change_password"
  | "add_password"
  | "set_email"
  | "add_face"
  | "approve_device"
  | "enable_totp"
  | "reset_password";

/** Minta nonce ke server lalu tanda tangani dengan kunci perangkat. */
export async function getStepUpProof(purpose: StepUpPurpose) {
  const res: any = await getStepUpNonceAction(purpose);
  if (!res || res.error || !res.nonceId) {
    throw new Error(res?.error || "Gagal memulai verifikasi perangkat.");
  }
  const signature = await signMessage(proofMessage(purpose, res.nonce, res.userId));
  return { nonceId: res.nonceId as string, nonce: res.nonce as string, signature };
}
