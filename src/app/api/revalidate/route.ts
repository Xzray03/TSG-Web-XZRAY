import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";

export async function POST(request: NextRequest) {
  try {
    const sanitySecret = process.env.SANITY_WEBHOOK_SECRET || process.env.REVALIDATE_SECRET;
    const supabaseSecret = process.env.SUPABASE_WEBHOOK_SECRET || process.env.REVALIDATE_SECRET;

    // 1. Validasi Sanity Webhook (menggunakan kriptografi HMAC SHA256 bawaan next-sanity/webhook)
    const sanitySignature = request.headers.get("x-sanity-signature");
    if (sanitySignature) {
      if (!sanitySecret) {
        return NextResponse.json(
          { revalidated: false, message: "Sanity webhook secret is not configured on server" },
          { status: 500 }
        );
      }

      const { isValidSignature } = await parseBody(request, sanitySecret, false);
      if (!isValidSignature) {
        return NextResponse.json(
          { revalidated: false, message: "Unauthorized: Invalid Sanity webhook signature" },
          { status: 401 }
        );
      }

      // Revalidasi cache khusus Sanity
      revalidatePath("/", "layout");
      revalidateTag("sanity-data", "max");

      return NextResponse.json({
        revalidated: true,
        source: "sanity",
        now: Date.now(),
        message: "Sanity cache revalidated successfully",
      });
    }

    // 2. Validasi Supabase Webhook / Database Trigger (menggunakan secret header kustom)
    const supabaseHeader =
      request.headers.get("x-supabase-webhook-secret") ||
      request.headers.get("x-webhook-secret");

    if (supabaseHeader) {
      if (!supabaseSecret || supabaseHeader !== supabaseSecret) {
        return NextResponse.json(
          { revalidated: false, message: "Unauthorized: Invalid Supabase webhook secret" },
          { status: 401 }
        );
      }

      // Revalidasi cache khusus Supabase
      revalidatePath("/", "layout");
      revalidateTag("supabase-data", "max");

      return NextResponse.json({
        revalidated: true,
        source: "supabase",
        now: Date.now(),
        message: "Supabase cache revalidated successfully",
      });
    }

    // 3. Tolak akses manual / dari luar yang tidak menyertakan tanda tangan Sanity atau secret Supabase yang sah
    return NextResponse.json(
      {
        revalidated: false,
        message: "Forbidden: Direct, manual, or unauthenticated requests are not allowed.",
      },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { revalidated: false, error: error?.message || "Revalidation failed" },
      { status: 500 }
    );
  }
}
