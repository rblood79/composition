/**
 * 라이선스 입력 원천 — 공개키 (번들) 와 토큰 파일 (서버 루트 또는 사용자 선택).
 */

import {
  base64urlDecode,
  type LicensePublicJwk,
  type LicensePublicKey,
} from "./licenseToken";

/** 서버 루트에 배포된 라이선스 토큰 파일 — `apps/builder/public/license` (확장자 없음). 유일한 입력 경로. */
export const LICENSE_FILE_NAME = "license";

/**
 * 번들에 실린 발급기 공개키. `.env` 의 `VITE_LICENSE_PUBLIC_KEY` — 발급기 `public_key`
 * 파일 (PEM SPKI) 내용. 헤더 없는 base64 본문 한 줄 · JWK JSON 도 받는다.
 * 없거나 손상이면 null — 로그인 화면이 설정 오류로 안내한다.
 */
export function readBundledPublicKey(): LicensePublicKey | null {
  const raw = import.meta.env.VITE_LICENSE_PUBLIC_KEY as string | undefined;
  if (!raw) return null;
  return parsePublicKey(raw);
}

export function parsePublicKey(raw: string): LicensePublicKey | null {
  const text = raw.trim();
  if (text.startsWith("{")) return parsePublicJwk(text);
  // PEM: 헤더/푸터·개행 (.env 에서는 리터럴 "\n" 일 수 있다) 을 벗기고 DER 로
  const body = text
    .replace(/\\n/g, "")
    .replace(/-----(BEGIN|END) PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=_-]+$/.test(body) || body.length < 40) return null;
  try {
    const der = base64urlDecode(body.replace(/=+$/, ""));
    // SPKI DER 는 SEQUENCE(0x30) 로 시작한다
    return der[0] === 0x30 ? { kind: "spki", der } : null;
  } catch {
    return null;
  }
}

export function parsePublicJwk(raw: string): LicensePublicJwk | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LicensePublicJwk>;
    if (
      parsed.kty === "EC" &&
      parsed.crv === "P-256" &&
      typeof parsed.x === "string" &&
      typeof parsed.y === "string"
    ) {
      return { kty: "EC", crv: "P-256", x: parsed.x, y: parsed.y };
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

/**
 * 서버 루트의 `license` 를 읽는다. 없으면 (404·네트워크 오류) null.
 * 폐쇄망 서버가 앱과 같이 토큰을 배포한다 — 로그인 화면에 파일 선택은 없다.
 */
export async function fetchDeployedLicenseToken(
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const base = import.meta.env.BASE_URL ?? "/";
    const res = await fetchImpl(`${base}${LICENSE_FILE_NAME}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    // Vite dev 서버는 없는 파일에 index.html 을 돌려준다 — JWT 3분절 형태만 받는다.
    return looksLikeJwt(text) ? text : null;
  } catch {
    return null;
  }
}

export function looksLikeJwt(text: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(text.trim());
}
