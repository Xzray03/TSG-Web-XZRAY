import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Helper to verify incoming API requests across multiple security tiers:
 * 1. Origin / Custom Header validation (Anti-Bot / Anti-Scraping)
 * 2. Optional Supabase Auth Token verification (Bearer token check)
 */
export async function verifyApiRequest(
  request: Request,
  options: { requireAuth?: boolean } = { requireAuth: false }
) {
  const headers = request.headers;
  
  // Tier 2: Origin / Custom Header Check
  // Allow local development and same-origin requests, reject unauthorized external tools without custom header
  const origin = headers.get("origin");
  const host = headers.get("host");
  const customVerifyHeader = headers.get("x-tsg-client-verify");

  // In production/strict mode, ensure request originates from the same site or carries our client verify header
  const isDevelopment = process.env.NODE_ENV === "development";
  const hasValidHeader = customVerifyHeader === "true" || customVerifyHeader === "1";

  if (!isDevelopment && !hasValidHeader) {
    // If no client verify header, check if origin matches host
    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          return {
            authorized: false,
            response: NextResponse.json(
              { error: "Access denied: Invalid origin or unauthorized client." },
              { status: 403 }
            ),
          };
        }
      } catch {
        return {
          authorized: false,
          response: NextResponse.json(
            { error: "Access denied: Malformed origin header." },
            { status: 403 }
          ),
        };
      }
    } else if (!isDevelopment) {
      // Strict block for requests missing both origin and verification header in production
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Access denied: Direct API access is prohibited." },
          { status: 403 }
        ),
      };
    }
  }

  // Tier 1: Supabase Auth Session Verification (if required)
  if (options.requireAuth) {
    const authHeader = headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Authentication required: Missing or invalid token." },
          { status: 401 }
        ),
      };
    }

    const token = authHeader.split(" ")[1];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = 
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    try {
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      });

      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return {
          authorized: false,
          response: NextResponse.json(
            { error: "Unauthorized: Invalid, expired, or cloned token." },
            { status: 401 }
          ),
        };
      }

      return { authorized: true, user };
    } catch (err: any) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: `Token verification failed: ${err.message}` },
          { status: 401 }
        ),
      };
    }
  }

  return { authorized: true };
}
