/**
 * 라이선스 토큰 검증 — 발급기 계약 v1 (`/Users/admin/work/jwt/docs/LICENSE_TOKEN_FORMAT.md`).
 *
 * 순서 고정: alg 확인 → ES256 서명 (번들 공개 JWK) → exp → 검증 코드
 * (PBKDF2-SHA256 → AES-GCM 으로 `vc.ct` 를 열어 `license_key` 와 대조).
 * 토큰에는 코드 평문이 없다 — 코드는 토큰과 다른 채널로 받는다.
 * 네트워크 0 · WebCrypto 만 사용 (폐쇄망 요건).
 */

export interface LicensePublicJwk {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
}

export interface SealedVerificationCode {
  v: 1;
  kdf: "PBKDF2-SHA256";
  iter: number;
  salt: string;
  iv: string;
  ct: string;
}

export interface LicensePayload {
  products: string;
  project: string;
  client_os: string;
  license: string;
  dev_count: string;
  period: string;
  license_key: string;
  seq?: string;
  iat: number;
  exp?: number;
  vc: SealedVerificationCode;
}

export type LicenseVerifyFailure =
  "malformed" | "algorithm" | "signature" | "expired" | "code";

export class LicenseVerifyError extends Error {
  constructor(public readonly reason: LicenseVerifyFailure) {
    super(`license verify failed: ${reason}`);
    this.name = "LicenseVerifyError";
  }
}

const VC_VERSION = 1;
const VC_KDF = "PBKDF2-SHA256";
const EC_ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_ALG = { name: "ECDSA", hash: "SHA-256" } as const;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64urlDecode(text: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (text.length % 4)) % 4);
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeJsonSegment<T>(segment: string): T {
  return JSON.parse(textDecoder.decode(base64urlDecode(segment))) as T;
}

/** 서명 검증 없이 payload 만 읽는다 — 표시·진단용. 신뢰 판단에 쓰지 않는다. */
export function decodeLicensePayloadUnsafe(token: string): LicensePayload {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new LicenseVerifyError("malformed");
  try {
    return decodeJsonSegment<LicensePayload>(parts[1]);
  } catch {
    throw new LicenseVerifyError("malformed");
  }
}

async function deriveVcKey(
  code: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(code),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
}

/** `vc` 를 코드로 열어 라이선스 키와 대조한다. 어떤 실패든 false. */
export async function openVerificationCode(
  vc: SealedVerificationCode | undefined,
  licenseKey: string,
  code: string,
): Promise<boolean> {
  if (!vc || vc.v !== VC_VERSION || vc.kdf !== VC_KDF) return false;
  const iterations = Number(vc.iter);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  try {
    const key = await deriveVcKey(code, base64urlDecode(vc.salt), iterations);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64urlDecode(vc.iv) },
      key,
      base64urlDecode(vc.ct),
    );
    return textDecoder.decode(plain) === licenseKey;
  } catch {
    return false;
  }
}

async function importPublicKey(jwk: LicensePublicJwk): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
    EC_ALG,
    false,
    ["verify"],
  );
}

export interface VerifyLicenseOptions {
  /** 테스트용 시각 주입. 기본 Date.now(). */
  now?: () => number;
}

/**
 * 토큰 + 코드 + 공개키로 라이선스를 검증하고 payload 를 돌려준다.
 * 실패는 `LicenseVerifyError` (reason 으로 UI 문구 분기).
 */
export async function verifyLicenseToken(
  token: string,
  code: string,
  publicJwk: LicensePublicJwk,
  options: VerifyLicenseOptions = {},
): Promise<LicensePayload> {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new LicenseVerifyError("malformed");

  let header: { alg?: string };
  let payload: LicensePayload;
  try {
    header = decodeJsonSegment<{ alg?: string }>(parts[0]);
    payload = decodeJsonSegment<LicensePayload>(parts[1]);
  } catch {
    throw new LicenseVerifyError("malformed");
  }
  if (header.alg !== "ES256") throw new LicenseVerifyError("algorithm");

  let valid = false;
  try {
    const key = await importPublicKey(publicJwk);
    valid = await crypto.subtle.verify(
      SIGN_ALG,
      key,
      base64urlDecode(parts[2]),
      textEncoder.encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    valid = false;
  }
  if (!valid) throw new LicenseVerifyError("signature");

  const now = (options.now ?? Date.now)();
  if (typeof payload.exp === "number" && payload.exp * 1000 < now) {
    throw new LicenseVerifyError("expired");
  }

  if (!(await openVerificationCode(payload.vc, payload.license_key, code))) {
    throw new LicenseVerifyError("code");
  }
  return payload;
}
