import { NextResponse } from "next/server";
import { client } from "@/sanity/client";
import { verifyApiRequest } from "@/lib/api-guard";

export async function GET(request: Request) {
  // Biarkan proxy gambar terbuka tanpa pengecekan ketat header verify jika diperlukan untuk bypass CORS eksternal
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (imageUrl) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error("Gagal mengambil gambar eksternal");
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get("content-type") || "image/jpeg";

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || "Gagal proxy gambar" },
        { status: 500 }
      );
    }
  }

  const guard = await verifyApiRequest(request, { requireAuth: false });
  if (!guard.authorized) {
    return guard.response;
  }

  try {
    const categories = await client.fetch(`*[_type == "teamCategory"] | order(order asc) { name, slug }`);
    const generations = categories
      .map((cat: any) => cat.slug?.current || cat.name)
      .filter(Boolean);
    return NextResponse.json(generations);
  } catch (error) {
    console.error("Error fetching generations:", error);
    return NextResponse.json([], { status: 200 });
  }
}
