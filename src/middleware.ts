import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Site key Turnstile bersifat publik (aman ada di kode/HTML).
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAFJqWLE4hNPkdagy';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};

async function verifyShieldToken(token: string, ua: string): Promise<boolean> {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return false;
    const [nonce, ts, sig] = parts;
    const tsNum = parseInt(ts, 10);
    if (isNaN(tsNum) || Math.abs(Date.now() - tsNum) > 6 * 60 * 60 * 1000) return false;

    const secret = process.env.SHIELD_SECRET;
    if (!secret) return false;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const data = enc.encode(`${nonce}:${ts}:${ua}`);
    const mac = await crypto.subtle.sign('HMAC', key, data);
    const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === sig;
  } catch {
    return false;
  }
}

function isServerAction(req: NextRequest): boolean {
  return req.headers.has('next-action');
}

export async function middleware(req: NextRequest) {
  // Fail-closed: tanpa SHIELD_SECRET, tolak semua request (tidak ada kunci cadangan di kode)
  if (!process.env.SHIELD_SECRET) {
    return new NextResponse('Service Unavailable', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }

  const url = req.nextUrl;
  const ua = req.headers.get('user-agent') || '';
  const secFetchDest = req.headers.get('sec-fetch-dest');
  const accept = req.headers.get('accept') || '';
  const chUa = req.headers.get('sec-ch-ua') || '';
  const acceptLang = req.headers.get('accept-language');

  // Always allow shield verify endpoint itself
  if (url.pathname.startsWith('/api/shield/verify')) {
    return NextResponse.next();
  }

  const rawToken = req.cookies.get('__shield_v2')?.value;
  const tokenValid = rawToken ? await verifyShieldToken(rawToken, ua) : false;

  // === A. Server Action gate: must have valid shield token, 403 otherwise ===
  if (isServerAction(req)) {
    if (!tokenValid) {
      return new NextResponse('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } });
    }
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    const host = req.headers.get('host') || '';
    if (origin) {
      try {
        if (new URL(origin).host !== host) {
          return new NextResponse('Forbidden', { status: 403 });
        }
      } catch {
        return new NextResponse('Forbidden', { status: 403 });
      }
    } else if (referer) {
      try {
        if (new URL(referer).host !== host) {
          return new NextResponse('Forbidden', { status: 403 });
        }
      } catch {
        return new NextResponse('Forbidden', { status: 403 });
      }
    } else {
      return new NextResponse('Forbidden', { status: 403 });
    }
    const sfs = req.headers.get('sec-fetch-site');
    if (sfs && sfs !== 'same-origin' && sfs !== 'same-site') {
      return new NextResponse('Forbidden', { status: 403 });
    }
    return NextResponse.next();
  }

  // === B. /api/* gate (matcher now includes api): webhook secrets bypass, else require token ===
  if (url.pathname.startsWith('/api/')) {
    // Sanity/Supabase webhook exemption — let route.ts validate HMAC itself
    const hasWebhookHeader =
      req.headers.has('x-sanity-signature') ||
      req.headers.has('x-supabase-webhook-secret') ||
      req.headers.has('x-webhook-secret');
    if (url.pathname.startsWith('/api/revalidate') && hasWebhookHeader) {
      return NextResponse.next();
    }
    if (!tokenValid) {
      return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return NextResponse.next();
  }

  // Valid token -> pass pages
  if (tokenValid) {
    return NextResponse.next();
  }

  // 1. CLI / Automated Tool Hard 403 Scoring (pages without token)
  let cliScore = 0;
  if (/curl|wget|python|httpie|postman|insomnia|axios|node-fetch|java|libwww-perl|ruby|php/i.test(ua)) {
    cliScore += 5;
  }
  if (secFetchDest === 'document') {
    if (!req.headers.get('sec-fetch-site')) cliScore += 3;
    if (!req.headers.get('sec-fetch-mode')) cliScore += 2;
    if (!chUa && !ua.includes('Safari') && !ua.includes('Firefox')) cliScore += 3;
  }
  if (accept === '*/*' || (!accept.includes('text/html') && secFetchDest === 'document')) {
    cliScore += 3;
  }
  if (!acceptLang) {
    cliScore += 2;
  }
  if (cliScore >= 4) {
    return new NextResponse('Forbidden: CLI tool or automated scraper blocked', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // 2. Challenge for all pages (GET without token) — api already returned above
  if (req.method === 'GET') {
    const nonce = crypto.randomUUID();
    const timestamp = Date.now().toString();

    // HMAC-sign nonce:ts to prevent direct attacker-generated PoW submissions to /api/shield/verify
    const secret = process.env.SHIELD_SECRET as string;
    const enc = new TextEncoder();
    const macKey = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', macKey, enc.encode(`${nonce}:${timestamp}`));
    const challengeSig = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
    const challengeHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Memverifikasi Keamanan Browser...</title>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); text-align: center; max-width: 400px; width: 100%; border: 1px solid #334155; }
    .spinner { width: 40px; height: 40px; border: 4px solid #3b82f6; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #94a3b8; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Verifikasi Keamanan</h2>
    <p>Mohon tunggu sebentar, browser Anda sedang diverifikasi untuk mencegah bot otomatis...</p>
    <div id="ts-box" style="margin-top:1rem;display:flex;justify-content:center;"></div>
  </div>
  <script>
    (async function() {
      try {
        const nonce = "${nonce}";
        const ts = "${timestamp}";
        const sig = "${challengeSig}";
        let violations = 0;
        if (navigator.webdriver === true) violations++;
        const wdDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
        if (wdDesc && !wdDesc.get.toString().includes('native code')) violations++;
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (!isAndroid) {
          // Jalur desktop (asli, tidak diubah)
          if (!window.chrome || !window.chrome.runtime) {
            if (navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Edg')) {
              violations++;
            }
          }
          if (navigator.plugins.length === 0 && navigator.userAgent.includes('Chrome')) {
            violations++;
          }
        } else {
          // Jalur khusus Android: chrome.runtime & plugins memang kosong di browser mobile,
          // jadi diganti cek yang relevan untuk perangkat mobile asli.
          if (navigator.webdriver === true) violations++; // bobot ganda: webdriver di Android = otomatis
          if (!(navigator.maxTouchPoints > 0)) violations++; // Android asli selalu punya layar sentuh
          if (/HeadlessChrome/i.test(navigator.userAgent)) violations++;
        }
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
            if (/SwiftShader|llvmpipe|Mesa|Software|VirtualGL/i.test(renderer)) {
              violations++;
            }
          }
        }
        if (violations >= 2) {
          document.body.innerHTML = '<div style="background:#1e293b;color:#f8fafc;padding:2rem;text-align:center;border-radius:1rem;margin:auto;max-width:400px;"><h2>Akses Ditolak</h2><p>Browser otomatis atau headless terdeteksi.</p></div>';
          return;
        }
        const siteKey = "${TURNSTILE_SITE_KEY}";
        const getTurnstileToken = function() {
          return new Promise(function(resolve, reject) {
            let waited = 0;
            const timer = setInterval(function() {
              waited += 100;
              if (window.turnstile) {
                clearInterval(timer);
                try {
                  window.turnstile.render('#ts-box', {
                    sitekey: siteKey,
                    action: 'shield',
                    theme: 'dark',
                    appearance: 'interaction-only',
                    callback: function(t) { resolve(t); },
                    'error-callback': function() { reject(new Error('turnstile-error')); },
                    'expired-callback': function() { reject(new Error('turnstile-expired')); },
                    'timeout-callback': function() { reject(new Error('turnstile-timeout')); }
                  });
                } catch (e) { reject(e); }
              } else if (waited > 15000) {
                clearInterval(timer);
                reject(new Error('turnstile-load'));
              }
            }, 100);
          });
        };
        // Jalankan Turnstile paralel dengan proof-of-work agar tidak melewati jendela 60 detik
        const turnstilePromise = getTurnstileToken();
        turnstilePromise.catch(function() {});
        const difficulty = 4;
        const targetPrefix = '0'.repeat(difficulty);
        let nonceVal = 0;
        let hashHex = '';
        const encoder = new TextEncoder();
        while (nonceVal < 500000) {
          const data = encoder.encode(nonce + ts + nonceVal);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          if (hashHex.startsWith(targetPrefix)) {
            break;
          }
          nonceVal++;
          if (nonceVal % 10000 === 0) {
            await new Promise(r => setTimeout(r, 0));
          }
        }
        const turnstileToken = await turnstilePromise;
        const res = await fetch('/api/shield/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nonce, ts, sig, powNonce: nonceVal, hash: hashHex, turnstileToken })
        });
        if (res.ok) {
          window.location.reload();
        } else {
          document.body.innerHTML = '<div style="background:#1e293b;color:#f8fafc;padding:2rem;text-align:center;border-radius:1rem;margin:auto;max-width:400px;"><h2>Verifikasi Gagal</h2><p>Silakan muat ulang halaman.</p></div>';
        }
      } catch (err) {
        console.error(err);
        document.body.innerHTML = '<div style="background:#1e293b;color:#f8fafc;padding:2rem;text-align:center;border-radius:1rem;margin:auto;max-width:400px;"><h2>Kesalahan Sistem</h2><p>Gagal memverifikasi browser.</p></div>';
      }
    })();
  </script>
</body>
</html>`;

    return new NextResponse(challengeHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  }

  return NextResponse.next();
}
