/**
 * ADR-266 — 두 노드 데이터가 같은 그림을 그리는가.
 *
 * 노드 picture 는 노드-로컬 좌표로 record 하고 이동은 replay 의 바깥 translate 가 한다
 * (`nodePictureCache.ts` 키 설계) — 그래서 최상위 `x` · `y` 만 비교에서 뺀다. 나머지 열거 가능한
 * 필드는 전부 그림에 들어가는 입력으로 보고 깊이 비교한다: 필드 목록을 따로 두지 않으므로 새
 * bake 필드가 생겨도 비교에서 빠지지 않는다. 평범한 객체 · 배열 · typed array 는 값으로, 그 밖의
 * 객체 (SkImage · CanvasKit 핸들 · 함수) 는 identity 로 비교한다. 심볼 슬롯 (retained paragraph ·
 * 소유자 링크 — non-enumerable) 은 `Object.keys` 에 잡히지 않는다.
 */
import type { SkiaNodeData } from "./nodeRendererTypes";

const TOP_LEVEL_POSITION = new Set(["x", "y"]);

export function sameDrawData(left: SkiaNodeData, right: SkiaNodeData): boolean {
  if (left === right) return true;
  return sameValue(left, right, TOP_LEVEL_POSITION);
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sameValue(
  left: unknown,
  right: unknown,
  skip?: ReadonlySet<string>,
): boolean {
  if (left === right) return true;
  if (typeof left !== typeof right) return false;
  if (typeof left === "number")
    return Number.isNaN(left) && Number.isNaN(right);
  if (typeof left !== "object" || left === null || right === null) return false;
  const a = left as object;
  const b = right as object;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1)
      if (!sameValue(a[i], b[i])) return false;
    return true;
  }
  if (ArrayBuffer.isView(a)) {
    if (
      !ArrayBuffer.isView(b) ||
      a.constructor !== b.constructor ||
      a.byteLength !== b.byteLength
    )
      return false;
    const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return false;
    return true;
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const aKeys = Object.keys(a).filter(
    (k) => !skip?.has(k) && (a as Record<string, unknown>)[k] !== undefined,
  );
  const bKeys = Object.keys(b).filter(
    (k) => !skip?.has(k) && (b as Record<string, unknown>)[k] !== undefined,
  );
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (
      !sameValue(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    )
      return false;
  }
  return true;
}
