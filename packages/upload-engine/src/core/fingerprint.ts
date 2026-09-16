/**
 * 재개 fingerprint = `sha256(name|size|lastModified|endpoint)` hex (`crypto.subtle`).
 * 비보안 컨텍스트 (http:// JSP 개발 서버) 처럼 `subtle` 이 없으면 FNV-1a 64 폴백.
 * 파일명은 해시 입력일 뿐 저장되지 않는다 (§3-6 — localStorage 에 파일명 0).
 * 폴더 선택은 같은 이름·크기·시각의 파일이 다른 경로에 있을 수 있어 relativePath 가 있으면 그것을 name 대신 쓴다.
 */
export interface FingerprintSource {
  name: string;
  size: number;
  lastModified: number;
  relativePath?: string;
}

const hex = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i++)
    s += bytes[i].toString(16).padStart(2, "0");
  return s;
};

/** FNV-1a 32bit — 두 seed 로 64bit 상당 */
const fnv = (input: string, seed: number): string => {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

export async function fingerprint(
  file: FingerprintSource,
  endpoint: string,
): Promise<string> {
  const input = `${file.relativePath || file.name}|${file.size}|${file.lastModified}|${endpoint}`;
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest(
        "SHA-256",
        new TextEncoder().encode(input),
      );
      return hex(new Uint8Array(digest));
    } catch {
      /* 폴백 */
    }
  }
  return fnv(input, 0x811c9dc5) + fnv(input, 0x9747b28c);
}
