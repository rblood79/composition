/**
 * ADR-244 — 옛 배포 탭의 부팅 실패를 새로고침 한 번으로 복구한다.
 *
 * GitHub Pages 배포는 이전 파일을 지운다. 재배포 전에 열린 탭이 builder 에 들어가면 옛 해시의
 * 부팅 chunk · CanvasKit wasm 이 404 로 실패한다. 오류 종류는 해석하지 않는다 (브라우저마다
 * 문구가 다르다) — 서버의 `version.json` buildId 가 이 번들의 `__BUILD_ID__` 와 다르면 옛 배포다.
 * 새로고침하면 Pages 의 `404.html` (= `index.html`) 이 같은 builder 경로로 새 빌드를 부팅한다.
 *
 * 반복 차단: 복구를 시도한 서버 buildId 를 `sessionStorage` 에 남기고, 같은 buildId 로는 다시
 * 새로고침하지 않는다. 판정을 못 하면 (dev · probe 실패 · storage 불가) 새로고침하지 않는다.
 */

const RECOVERY_KEY = "composition:stale-deploy-reload";

export interface StaleDeployDeps {
  /** 이 번들의 buildId. */
  readonly current: string;
  /** 서버에 지금 배포된 buildId — 못 읽으면 null 또는 throw. */
  readonly readServerBuildId: () => Promise<string | null>;
  readonly storage: Pick<Storage, "getItem" | "setItem">;
  readonly reload: () => void;
}

/** 서버의 `version.json` 을 캐시 없이 읽는다. */
export async function readServerBuildId(): Promise<string | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}version.json`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  const buildId =
    body && typeof body === "object"
      ? (body as { buildId?: unknown }).buildId
      : undefined;
  return typeof buildId === "string" && buildId ? buildId : null;
}

function defaultDeps(): StaleDeployDeps {
  return {
    current: typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev",
    readServerBuildId,
    storage: window.sessionStorage,
    reload: () => window.location.reload(),
  };
}

/**
 * 옛 배포면 새로고침을 시작하고 true 를 돌려준다 — 호출자는 실패 화면을 내지 않는다.
 * 그 밖에는 false (기존 실패 처리로 간다).
 */
export async function reloadIfStaleDeploy(
  deps: StaleDeployDeps = defaultDeps(),
): Promise<boolean> {
  if (!deps.current || deps.current === "dev") return false;
  let server: string | null;
  try {
    server = await deps.readServerBuildId();
  } catch {
    return false;
  }
  if (!server || server === deps.current) return false;
  try {
    if (deps.storage.getItem(RECOVERY_KEY) === server) return false;
    deps.storage.setItem(RECOVERY_KEY, server);
  } catch {
    return false;
  }
  deps.reload();
  return true;
}
