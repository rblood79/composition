/**
 * 라이선스 입력 원천 — 공개키 (번들) 와 토큰 파일 (서버 루트 또는 사용자 선택).
 */

import type { LicensePublicJwk } from "./licenseToken";

/** 서버 루트에 배포된 토큰 파일 경로 (`public/license.jwt`). 없으면 파일 선택으로 폴백. */
export const LICENSE_FILE_NAME = "license.jwt";

/**
 * 번들에 실린 발급기 공개 JWK. `.env` 의 `VITE_LICENSE_PUBLIC_JWK` (JSON 한 줄).
 * 없거나 손상이면 null — 로그인 화면이 설정 오류로 안내한다.
 */
export function readBundledPublicJwk(): LicensePublicJwk | null {
  const raw = import.meta.env.VITE_LICENSE_PUBLIC_JWK as string | undefined;
  if (!raw) return null;
  return parsePublicJwk(raw);
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
 * 서버 루트의 `license.jwt` 를 읽는다. 없으면 (404·네트워크 오류) null.
 * 폐쇄망 서버가 앱과 같이 토큰을 배포하는 경우의 자동 경로.
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
