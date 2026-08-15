/**
 * Lowercase Tag → Spec Lookup — 공유 모듈
 *
 * `TAG_SPEC_MAP` (PascalCase 키) 을 lowercase Map 으로 build-time 1회 변환.
 * `implicitStyles` / `utils` 등 여러 layout engine 소비처가 공유.
 *
 * ADR-096 Phase 4 — 기존 `implicitStyles.ts:96` local `LOWERCASE_TAG_SPEC_MAP`
 * 을 본 파일로 hoist 하여 `utils.ts` 에서도 재사용 (ADR-091 Phase 3 패턴 확장).
 *
 * `engines/utils.ts` 와 `engines/implicitStyles.ts` 가 양방향 의존 관계를
 * 형성하므로 중간 모듈로 분리. utils ← (본 모듈) → implicitStyles.
 *
 * 기원: ADR-083 Phase 0 — `containerTag.toLowerCase()` casing 정규화.
 */

import type { ComponentSpec } from "@composition/specs";
import { TAG_SPEC_MAP } from "../../styleConversion/tagSpecMap";

/**
 * lowercase type → ComponentSpec 즉시 lookup.
 *
 * 소비처: `implicitStyles.specSizeField` / `utils.getIntrinsicWidth|Height`
 * (ADR-096 defaultWidth/defaultHeight 조회) / `resolveContainerStylesFallback` 등.
 */

export const LOWERCASE_TAG_SPEC_MAP: ReadonlyMap<
  string,
  ComponentSpec<unknown>
> = new Map(
  Object.entries(TAG_SPEC_MAP).map(([k, v]) => [
    k.toLowerCase(),
    v as ComponentSpec<unknown>,
  ]),
);
