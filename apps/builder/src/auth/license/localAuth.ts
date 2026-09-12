/**
 * 로컬 인증 상태 — 라이선스 검증 통과 후 브라우저에 남기는 기록.
 *
 * 서버가 없다 (폐쇄망). `ProtectedRoute` 는 이 기록이 있고 만료 전이면 바로 통과,
 * 없거나 만료면 `/signin` 으로 보낸다. 만료는 라이선스 `exp` 그대로 (Unlimited = null).
 * 삭제 = 로그아웃.
 */

import type { LicensePayload } from "./licenseToken";

/** 저장하는 라이선스 — `vc` (봉인) 는 뺀다. 한 번 검증했으면 다시 열 이유가 없다. */
export type StoredLicense = Omit<LicensePayload, "vc">;

export interface LocalAuth {
  license: StoredLicense;
  /** 검증 통과 시각 (ms) */
  issuedAt: number;
  /** 라이선스 만료 (ms) · null = 무기한 */
  expiresAt: number | null;
}

export const LOCAL_AUTH_STORAGE_KEY = "composition-license-auth";

const ATTEMPT_STORAGE_KEY = "composition-license-attempts";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isLocalAuth(value: unknown): value is LocalAuth {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<LocalAuth>;
  return (
    typeof v.issuedAt === "number" &&
    (v.expiresAt === null || typeof v.expiresAt === "number") &&
    !!v.license &&
    typeof v.license === "object" &&
    typeof (v.license as StoredLicense).license_key === "string"
  );
}

/** 유효한 인증 기록. 없음·손상·만료면 null (만료·손상은 지운다). */
export function readValidAuth(now: number = Date.now()): LocalAuth | null {
  const storage = safeStorage();
  if (!storage) return null;
  const raw = storage.getItem(LOCAL_AUTH_STORAGE_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    storage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    return null;
  }
  if (!isLocalAuth(parsed)) {
    storage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    return null;
  }
  if (parsed.expiresAt !== null && parsed.expiresAt < now) {
    storage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    return null;
  }
  return parsed;
}

/** 검증 통과한 payload 를 기록한다. */
export function saveAuth(
  payload: LicensePayload,
  now: number = Date.now(),
): LocalAuth {
  const { vc: _vc, ...license } = payload;
  const auth: LocalAuth = {
    license,
    issuedAt: now,
    expiresAt: typeof payload.exp === "number" ? payload.exp * 1000 : null,
  };
  safeStorage()?.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(auth));
  return auth;
}

/** 로그아웃. */
export function clearAuth(): void {
  const storage = safeStorage();
  storage?.removeItem(LOCAL_AUTH_STORAGE_KEY);
  storage?.removeItem(ATTEMPT_STORAGE_KEY);
}

/**
 * 프로젝트 `created_by` 에 쓰는 식별자 — 서버 계정이 없으므로
 * 라이선스 키가 곧 이 설치의 정체성이다.
 */
export function getCurrentUserId(): string {
  const auth = readValidAuth();
  if (!auth) throw new Error("No valid license auth found");
  return auth.license.license_key;
}

// ---- 시도 제한 (UI 경유 전수 시도 지연) ----

interface AttemptState {
  failures: number;
  lockedUntil: number | null;
}

function readAttempts(): AttemptState {
  const raw = safeStorage()?.getItem(ATTEMPT_STORAGE_KEY);
  if (!raw) return { failures: 0, lockedUntil: null };
  try {
    const parsed = JSON.parse(raw) as Partial<AttemptState>;
    return {
      failures: typeof parsed.failures === "number" ? parsed.failures : 0,
      lockedUntil:
        typeof parsed.lockedUntil === "number" ? parsed.lockedUntil : null,
    };
  } catch {
    return { failures: 0, lockedUntil: null };
  }
}

function writeAttempts(state: AttemptState): void {
  safeStorage()?.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(state));
}

/** 잠금 해제까지 남은 ms. 0 이면 시도 가능. */
export function lockoutRemainingMs(now: number = Date.now()): number {
  const { lockedUntil } = readAttempts();
  if (lockedUntil === null) return 0;
  if (lockedUntil <= now) {
    writeAttempts({ failures: 0, lockedUntil: null });
    return 0;
  }
  return lockedUntil - now;
}

/** 실패 1회 기록. 상한 도달 시 잠근다. 반환 = 잠금 남은 ms (0 이면 아직 시도 가능). */
export function recordFailedAttempt(now: number = Date.now()): number {
  const state = readAttempts();
  const failures = state.failures + 1;
  if (failures >= MAX_FAILED_ATTEMPTS) {
    writeAttempts({ failures: 0, lockedUntil: now + LOCKOUT_MS });
    return LOCKOUT_MS;
  }
  writeAttempts({ failures, lockedUntil: null });
  return 0;
}

export function resetAttempts(): void {
  safeStorage()?.removeItem(ATTEMPT_STORAGE_KEY);
}

export const LICENSE_ATTEMPT_POLICY = {
  maxFailedAttempts: MAX_FAILED_ATTEMPTS,
  lockoutMs: LOCKOUT_MS,
} as const;
