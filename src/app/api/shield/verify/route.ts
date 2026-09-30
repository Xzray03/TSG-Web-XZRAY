import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nonce, ts, sig, powNonce, hash, turnstileToken } = body;

    if (!nonce || !ts || !sig || powNonce === undefined || !hash || !turnstileToken || typeof turnstileToken !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // 0. Verify challenge signature issued by middleware
    const secret = process.env.SHIELD_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const enc = new TextEncoder();
    const macKey = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', macKey, enc.encode(`${nonce}:${ts}`));
    const expectedSig = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');

    if (expectedSig !== sig) {
      return NextResponse.json({ error: 'Unauthorized challenge' }, { status: 403 });
    }

    // 0. Anti-Automation / Anti-Headless header heuristics on verify route
    const ua = req.headers.get('user-agent') || '';
    const secFetchSite = req.headers.get('sec-fetch-site');
    const secFetchMode = req.headers.get('sec-fetch-mode');
    const secFetchDest = req.headers.get('sec-fetch-dest');
    const accept = req.headers.get('accept') || '';
    const acceptLang = req.headers.get('accept-language');

    let botScore = 0;
    if (!secFetchSite || !secFetchMode) botScore += 2;
    if (!acceptLang) botScore += 2;
    if (accept === '*/*' || !accept.includes('application/json')) botScore += 2;
    if (/curl|python|wget|postman|axios|node-fetch|playwright|puppeteer|selenium|java/i.test(ua)) {
      botScore += 5;
    }

    if (botScore >= 3) {
      return NextResponse.json({ error: 'Automated verification denied' }, { status: 403 });
    }

    // 1. Verify timestamp window (within 60 seconds)
    const now = Date.now();
    const clientTs = parseInt(ts, 10);
    if (isNaN(clientTs) || Math.abs(now - clientTs) > 60000) {
      return NextResponse.json({ error: 'Expired challenge' }, { status: 400 });
    }

    // 2. Verify Proof-of-Work (PoW) hash on server side
    const dataString = nonce + ts + powNonce;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(dataString);

    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const difficulty = 4;
    const targetPrefix = '0'.repeat(difficulty);

    if (!computedHash.startsWith(targetPrefix) || computedHash !== hash) {
      return NextResponse.json({ error: 'Invalid Proof-of-Work' }, { status: 403 });
    }

    // 2b. Verifikasi Cloudflare Turnstile di server (fail-closed bila secret tidak ada)
    const turnstileSecret = process.env.TURNSTILE_SECRET;
    if (!turnstileSecret) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const remoteIp = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const tsForm = new URLSearchParams();
    tsForm.set('secret', turnstileSecret);
    tsForm.set('response', turnstileToken);
    if (remoteIp) tsForm.set('remoteip', remoteIp);

    const tsCtrl = new AbortController();
    const tsTimer = setTimeout(() => tsCtrl.abort(), 5000);
    let tsResult: { success?: boolean; action?: string; hostname?: string } = {};
    try {
      const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: tsForm,
        signal: tsCtrl.signal,
      });
      tsResult = await tsRes.json();
    } catch {
      return NextResponse.json({ error: 'Turnstile verification unavailable' }, { status: 503 });
    } finally {
      clearTimeout(tsTimer);
    }
    const reqHost = (req.headers.get('host') || '').split(':')[0];
    if (!tsResult.success || tsResult.action !== 'shield' || (tsResult.hostname && reqHost && tsResult.hostname !== reqHost)) {
      return NextResponse.json({ error: 'Turnstile failed' }, { status: 403 });
    }

    // 3. Generate signed shield token (HMAC-SHA256 using WebCrypto)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const tokenData = encoder.encode(`${nonce}:${ts}:${ua}`);
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, tokenData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const shieldToken = `${nonce}:${ts}:${signatureHex}`;

    // 4. Set secure httpOnly cookie and return success
    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: '__shield_v2',
      value: shieldToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 6, // 6 hours
    });

    return response;
  } catch (err) {
    console.error('Shield verification error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
