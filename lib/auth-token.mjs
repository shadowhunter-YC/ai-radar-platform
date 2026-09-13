const enc = new TextEncoder();
const dec = new TextDecoder();

const SECRET = process.env.AUTH_SECRET || 'radar_platform_default_hmac_secret_2026';

function base64UrlEncode(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let clean = str.replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4) {
    clean += '=';
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey() {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSession(payload) {
  const key = await getHmacKey();
  const dataStr = JSON.stringify(payload);
  const dataB64 = base64UrlEncode(enc.encode(dataStr));
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(dataB64));
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuf));
  return `${dataB64}.${sigB64}`;
}

export async function verifySession(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string' || !tokenStr.includes('.')) {
    return null;
  }
  const [dataB64, sigB64] = tokenStr.split('.');
  if (!dataB64 || !sigB64) return null;

  try {
    const key = await getHmacKey();
    const sigBytes = base64UrlDecode(sigB64);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(dataB64));
    if (!isValid) return null;

    const payloadJson = dec.decode(base64UrlDecode(dataB64));
    const payload = JSON.parse(payloadJson);
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
