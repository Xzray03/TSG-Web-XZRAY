// ==============================================================================
// TSG-Web-XZRAY: QR Code generator (CSP-safe inline SVG, zero dependencies)
// Byte-mode encoder, versions 1–10, EC level L, mask 0 — cukup untuk otpauth URI.
// ==============================================================================

/** GF(256) exp/log untuk Reed-Solomon (polinomial 0x11d). */
const GF_EXP = new Array(512);
const GF_LOG = new Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** Reed-Solomon: hasilkan `ecCount` codeword EC untuk data. */
function rsEncode(data: Uint8Array, ecCount: number): Uint8Array {
  // Generator polynomial
  let gen = new Uint8Array([1]);
  for (let i = 0; i < ecCount; i++) {
    const next = new Uint8Array(gen.length + 1);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen = next;
  }
  const result = new Uint8Array(data.length + ecCount);
  result.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = result[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        result[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return result.slice(data.length);
}

/**
 * Tabel EC level L per versi: totalCodeword, dan daftar blok [dataCount, ecCount].
 * Sumber: ISO/IEC 18004 tabel EC L.
 */
const VERSION_L: Record<number, { total: number; blocks: Array<[number, number]> }> = {
  1: { total: 26, blocks: [[19, 7]] },
  2: { total: 44, blocks: [[34, 10]] },
  3: { total: 70, blocks: [[55, 15]] },
  4: { total: 100, blocks: [[80, 20]] },
  5: { total: 134, blocks: [[108, 26]] },
  6: { total: 172, blocks: [[68, 18], [68, 18]] },
  7: { total: 196, blocks: [[78, 20], [78, 20]] },
  8: { total: 242, blocks: [[97, 24], [97, 24]] },
  9: { total: 292, blocks: [[116, 30], [116, 30]] },
  10: { total: 346, blocks: [[68, 18], [68, 18], [69, 18], [69, 18]] },
};

/** Posisi alignment pattern per versi. */
const ALIGN_POS: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

/** Version information (18 bit) untuk versi >= 7. */
const VERSION_INFO: Record<number, number> = {
  7: 0b000111110010010100,
  8: 0b001000010110111100,
  9: 0b001001101010011001,
  10: 0b001010010011010011,
};

/** Format info 15-bit untuk EC level L + mask 0. */
const FORMAT_INFO_L_MASK0 = 0b111011111000100;

const BYTE_COUNT_BITS: Record<number, number> = {
  1: 8, 2: 16, 3: 16, 4: 16, 5: 16, 6: 16, 7: 16, 8: 16, 9: 16, 10: 16,
};

/** Mask 0: (row+col) % 2 === 0 */
function maskFn(row: number, col: number): boolean {
  return (row + col) % 2 === 0;
}

/** Buat bitstream byte-mode (mode 0100 + count + data + terminator + pad). */
function buildDataCodewords(text: string, version: number): Uint8Array | null {
  const bytes = Buffer.from(text, "utf8");
  const dataCap = VERSION_L[version].blocks.reduce((s, [d]) => s + d, 0);
  const countBits = BYTE_COUNT_BITS[version];
  const totalBitsNeeded = 4 + countBits + bytes.length * 8;
  if (totalBitsNeeded > dataCap * 8) return null;

  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(0b0100, 4); // mode byte
  push(bytes.length, countBits);
  for (const b of bytes) push(b, 8);
  // terminator
  const term = Math.min(4, dataCap * 8 - bits.length);
  push(0, term);
  // pad ke byte boundary
  while (bits.length % 8 !== 0) bits.push(0);
  // pad byte 0xEC / 0x11
  let pad = 0xec;
  const out = new Uint8Array(dataCap);
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    out[i / 8] = b;
  }
  let idx = Math.ceil(bits.length / 8);
  while (idx < dataCap) {
    out[idx++] = pad;
    pad = pad === 0xec ? 0x11 : 0xec;
  }
  return out;
}

/** Interleave data & EC antar blok (standar QR). */
function interleave(data: Uint8Array, version: number): Uint8Array {
  const blocks = VERSION_L[version].blocks;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let off = 0;
  for (const [d, e] of blocks) {
    const chunk = data.slice(off, off + d);
    off += d;
    dataBlocks.push(chunk);
    ecBlocks.push(rsEncode(chunk, e));
  }
  const total = VERSION_L[version].total;
  const out = new Uint8Array(total);
  let o = 0;
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of dataBlocks) if (i < b.length) out[o++] = b[i];
  }
  const maxEc = Math.max(...ecBlocks.map((b) => b.length));
  for (let i = 0; i < maxEc; i++) {
    for (const b of ecBlocks) if (i < b.length) out[o++] = b[i];
  }
  return out;
}

/** Bangun matrix QR (reserved map + place data + mask + format + version). */
function buildMatrix(version: number, codewords: Uint8Array): boolean[][] {
  const size = version * 4 + 17;
  // null = belum terisi (area data), boolean = module terisi
  const matrix: Array<Array<boolean | null>> = Array.from({ length: size }, () => Array<boolean | null>(size).fill(null));

  const setFn = (r: number, c: number, v: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) matrix[r][c] = v;
  };

  // Finder + separator
  const drawFinder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inPattern = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark = inPattern && (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        );
        setFn(r0 + r, c0 + c, dark);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing
  for (let i = 8; i < size - 8; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }

  // Alignment
  const centers = ALIGN_POS[version] || [];
  for (const r of centers) {
    for (const c of centers) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFn(r + dr, c + dc, dark);
        }
      }
    }
  }

  // Format info (L + mask 0) — dua salinan
  const fmt = FORMAT_INFO_L_MASK0;
  const fmtBit = (i: number) => ((fmt >>> (14 - i)) & 1) === 1;
  for (let i = 0; i < 15; i++) {
    if (i < 6) matrix[i][8] = fmtBit(i);
    else if (i < 8) matrix[i + 1][8] = fmtBit(i);
    else matrix[size - 15 + i][8] = fmtBit(i);

    if (i < 8) matrix[8][size - i - 1] = fmtBit(i);
    else if (i < 9) matrix[8][15 - i] = fmtBit(i);
    else matrix[8][14 - i] = fmtBit(i);
  }
  matrix[size - 8][8] = true; // dark module

  // Version info (v >= 7)
  if (version >= 7) {
    const vi = VERSION_INFO[version];
    for (let i = 0; i < 18; i++) {
      const bit = ((vi >>> i) & 1) === 1;
      matrix[Math.floor(i / 3)][size - 11 + (i % 3)] = bit;
      matrix[size - 11 + (i % 3)][Math.floor(i / 3)] = bit;
    }
  }

  // Penempatan data zigzag + mask
  let inc = -1;
  let row = size - 1;
  let bitIdx = 7;
  let byteIdx = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (matrix[row][cc] === null) {
          let dark = false;
          if (byteIdx < codewords.length) dark = ((codewords[byteIdx] >>> bitIdx) & 1) === 1;
          if (maskFn(row, cc)) dark = !dark;
          matrix[row][cc] = dark;
          bitIdx--;
          if (bitIdx < 0) { byteIdx++; bitIdx = 7; }
        }
      }
      row += inc;
      if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
    }
  }

  return matrix.map((r) => r.map((v) => v === true));
}

/** Generate SVG QR dari teks (otpauth URI). */
export function generateQRSvg(text: string, size = 200): string {
  try {
    let version = 0;
    let data: Uint8Array | null = null;
    for (let v = 1; v <= 10; v++) {
      data = buildDataCodewords(text, v);
      if (data) { version = v; break; }
    }
    if (!data || !version) throw new Error("Data terlalu panjang untuk QR v10");

    const codewords = interleave(data, version);
    const matrix = buildMatrix(version, codewords);
    const n = matrix.length;
    const cell = size / n;

    let paths = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c]) {
          paths += `M ${c * cell} ${r * cell} h ${cell} v ${cell} h ${-cell} Z `;
        }
      }
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="#ffffff" rx="12"/><path d="${paths}" fill="#0f172a"/></svg>`;
  } catch {
    return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#fff" rx="12"/><text x="50" y="55" font-size="10" text-anchor="middle" fill="#ef4444">QR Error</text></svg>`;
  }
}
