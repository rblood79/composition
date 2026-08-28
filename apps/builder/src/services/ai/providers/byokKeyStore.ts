/**
 * BYOK 키 보관 정책 (ADR-134 Phase 2, D10 / HC13).
 *
 * 기본은 **세션 메모리** 다 — 새로고침하면 사라진다. 브라우저 저장은 사용자가 한 번
 * 명시적으로 켠 경우에만 열리고 (`setPersistOptIn(true)`), 끄는 순간 저장돼 있던 값을
 * 함께 지운다.
 *
 * 환경변수는 읽지 않는다. `VITE_*` 는 번들에 문자열로 박히므로 (Groq 시절
 * `VITE_GROQ_API_KEY` 가 그랬다) 그 자체가 HC13 위반이다. 키는 사용자가 실행 중에
 * 넣는 값이지 빌드 산출물이 아니다.
 *
 * 프로파일은 키의 **이름**(`credentialRef`)만 들고 다니고, 값은 여기서만 산다.
 */

const PERSIST_OPT_IN_KEY = "composition.ai.byok.persist";
const KEY_PREFIX = "composition.ai.byok.";

/** 세션 메모리 — 기본 보관소. */
const memory = new Map<string, string>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // 사생활 보호 모드 등에서 접근 자체가 throw 한다
    return null;
  }
}

function storedKeys(store: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && key.startsWith(KEY_PREFIX) && key !== PERSIST_OPT_IN_KEY) {
      keys.push(key);
    }
  }
  return keys;
}

/** 사용자가 브라우저 저장을 켰는가. 기본 false. */
export function isPersistOptedIn(): boolean {
  return storage()?.getItem(PERSIST_OPT_IN_KEY) === "true";
}

/** 브라우저 저장 opt-in 토글. 끄면 저장돼 있던 키를 모두 지운다 (메모리는 유지). */
export function setPersistOptIn(enabled: boolean): void {
  const store = storage();
  if (!store) return;
  if (enabled) {
    store.setItem(PERSIST_OPT_IN_KEY, "true");
    return;
  }
  for (const key of storedKeys(store)) store.removeItem(key);
  store.removeItem(PERSIST_OPT_IN_KEY);
}

/**
 * 키 저장. `persist` 는 opt-in 이 켜져 있을 때만 실제로 브라우저에 남는다 —
 * opt-in 없이 persist 를 요청하면 메모리에만 둔다 (조용한 평문 저장 금지).
 */
export function setByokKey(
  ref: string,
  value: string,
  options: { persist?: boolean } = {},
): void {
  memory.set(ref, value);
  if (!options.persist || !isPersistOptedIn()) return;
  storage()?.setItem(KEY_PREFIX + ref, value);
}

/** 메모리 우선, opt-in 된 경우에만 브라우저 저장소를 본다. */
export function getByokKey(ref: string): string | undefined {
  const inMemory = memory.get(ref);
  if (inMemory) return inMemory;
  if (!isPersistOptedIn()) return undefined;
  return storage()?.getItem(KEY_PREFIX + ref) ?? undefined;
}

export function hasByokKey(ref: string): boolean {
  return getByokKey(ref) !== undefined;
}

export function clearByokKey(ref: string): void {
  memory.delete(ref);
  storage()?.removeItem(KEY_PREFIX + ref);
}

/** 테스트·로그아웃용 — 메모리와 저장소를 모두 비운다. */
export function clearAllByokKeys(): void {
  memory.clear();
  const store = storage();
  if (!store) return;
  for (const key of storedKeys(store)) store.removeItem(key);
}
