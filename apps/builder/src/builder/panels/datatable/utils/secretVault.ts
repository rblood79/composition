/**
 * 프로젝트 로컬 secret vault — ADR-212 Phase 4 P4 (HC6).
 *
 * Auth 값 (Bearer 토큰 · API Key · Basic) 의 **원문**은 문서에 저장하지 않는다. 문서·export·
 * postMessage·AI payload 에는 참조 `{{secret.NAME}}` 만 실리고 (공유 redactor 가 그 형태로
 * 마스킹), 원문은 이 vault 에만 있다. 문서 DB (`composition`) 와 **별도 IndexedDB**
 * (`composition-secrets`) 라 문서 export/백업 경로에 절대 섞이지 않는다 (HC6 구조적 보장).
 *
 * 치환 (`substituteSecrets`) 은 실행 시점에만, 실제 fetch 로 나가는 url·header·body 에만 적용
 * 한다 — 실행 스냅샷 (ADR-213 apiRuns, AI 가 읽는 경로) 에는 placeholder 를 남긴다.
 */
const DB_NAME = "composition-secrets";
const STORE = "secrets";
const REF = /\{\{secret\.([A-Za-z0-9_]+)\}\}/g;

export function substituteSecrets(
  text: string,
  secrets: ReadonlyMap<string, string>,
): string {
  if (!text.includes("{{secret.")) return text;
  return text.replace(REF, (whole, name: string) =>
    secrets.has(name) ? (secrets.get(name) as string) : whole,
  );
}

/** 여러 문자열에서 참조된 secret 이름 (등장 순서, 중복 제거). */
export function collectSecretNames(texts: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of texts) {
    if (typeof text !== "string") continue;
    REF.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = REF.exec(text)) !== null) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        out.push(m[1]);
      }
    }
  }
  return out;
}

interface SecretRow {
  key: string; // `${projectId}:${name}`
  projectId: string;
  name: string;
  value: string;
  /**
   * ADR-218 — 변경 세대. 같은 이름의 값을 덮어쓸 때마다 +1. 캐시 지문(`sourceRev`)이
   * secret **원문 대신** `이름 + revision` 만 담아, 같은 `{{secret.NAME}}` 의 값이 바뀌면
   * 지문이 갈리되 원문은 지문에 실리지 않는다 (HC6). 미설정 = 0 (BC — 구 vault row).
   */
  revision?: number;
}

function openVault(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") {
      rej(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("projectId", "projectId", { unique: false });
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

const rowKey = (projectId: string, name: string) => `${projectId}:${name}`;

export async function setSecret(
  projectId: string,
  name: string,
  value: string,
): Promise<void> {
  const db = await openVault();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const key = rowKey(projectId, name);
    // ADR-218 — 덮어쓸 때 revision +1 (신규는 1). 같은 tx 안에서 get→put 이라 원자적.
    const getReq = store.get(key);
    getReq.onsuccess = () => {
      const prev = getReq.result as SecretRow | undefined;
      const revision = (prev?.revision ?? 0) + 1;
      store.put({
        key,
        projectId,
        name,
        value,
        revision,
      } satisfies SecretRow);
    };
    getReq.onerror = () => rej(getReq.error);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function removeSecret(
  projectId: string,
  name: string,
): Promise<void> {
  const db = await openVault();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(rowKey(projectId, name));
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

/** projectId 의 모든 secret (name → value). 실행 치환에 쓴다. */
export async function getProjectSecrets(
  projectId: string,
): Promise<Map<string, string>> {
  let db: IDBDatabase;
  try {
    db = await openVault();
  } catch {
    return new Map();
  }
  const rows = await new Promise<SecretRow[]>((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("projectId");
    const req = index.getAll(projectId);
    req.onsuccess = () => res(req.result as SecretRow[]);
    req.onerror = () => rej(req.error);
  });
  db.close();
  return new Map(rows.map((r) => [r.name, r.value]));
}

/**
 * ADR-218 — projectId 의 secret 이름 → 변경 세대(revision). **값은 반환하지 않는다** (HC6).
 * `sourceRev` 지문이 secret 참조를 `이름 + revision` 으로 담을 때만 쓴다.
 */
export async function getSecretRevisions(
  projectId: string,
): Promise<Map<string, number>> {
  let db: IDBDatabase;
  try {
    db = await openVault();
  } catch {
    return new Map();
  }
  const rows = await new Promise<SecretRow[]>((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("projectId");
    const req = index.getAll(projectId);
    req.onsuccess = () => res(req.result as SecretRow[]);
    req.onerror = () => rej(req.error);
  });
  db.close();
  return new Map(rows.map((r) => [r.name, r.revision ?? 0]));
}

/** 등록된 secret 이름만 (값 없이 — UI 표시용). */
export async function listSecretNames(projectId: string): Promise<string[]> {
  return [...(await getProjectSecrets(projectId)).keys()];
}
