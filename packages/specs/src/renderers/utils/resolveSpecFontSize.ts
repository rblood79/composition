/**
 * Spec render.shapes에서 반복되는 fontSize 해석을 통합.
 * 53개 spec 파일의 공통 패턴: rawFs → resolveToken → number fallback
 */
import type { TokenRef } from "../../types";
import { parsePxOnlyValue } from "../../primitives/cssValueParser";
import { resolveToken } from "./tokenResolver";

/**
 * size.fontSize 또는 props.style?.fontSize를 숫자 px 값으로 해석한다.
 *
 * **px 문자열을 받아야 한다** (ADR-205 Phase 4). 인라인 style 이 저장되는 정본 형태가
 * px 문자열이기 때문이다 — Styles 패널의 `normalizeStyleValue` 가 숫자를 `${n}px` 로
 * 만들고 기본값도 `"16px"` 다. 예전에는 숫자와 TokenRef 만 받아 px 문자열이 조용히
 * fallback 으로 떨어졌고, 그래서 폰트 크기를 바꾸면 Preview 만 따라가고 캔버스는
 * 16 에 머물렀다 (live 실측: 저장 `"23px"` → Skia 16 / DOM 23).
 *
 * 상대 단위(em/rem/%)는 여전히 fallback 이다 — 이 지점이 폰트 컨텍스트를 모르며,
 * 레이아웃 경로(`parseNumericValue`)도 같은 이유로 거부한다. 두 leg 이 같은 문자열을
 * 같게 읽는 것이 D3 대칭의 조건이다.
 *
 * @param raw - size.fontSize 또는 props.style?.fontSize
 * @param fallback - 해석 실패 시 기본값 (spec별로 12, 14, 16 중 하나)
 */
export function resolveSpecFontSize(
  raw: string | number | TokenRef | undefined,
  fallback = 14,
): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : fallback;
  if (typeof raw === "string" && raw.startsWith("{")) {
    const resolved = resolveToken(raw as TokenRef);
    return typeof resolved === "number" ? resolved : fallback;
  }
  return parsePxOnlyValue(raw, fallback);
}
