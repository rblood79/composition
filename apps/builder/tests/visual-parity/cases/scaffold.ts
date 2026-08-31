/**
 * ADR-198 Phase 1 — 케이스 공용 뼈대 (test-only)
 *
 * 모든 파일럿 케이스는 같은 page/body 뼈대를 쓴다. 이 형태는 Phase 0 이 실험으로
 * 확정한 것이라 임의로 바꾸면 두 leg 중 하나가 조용히 빈 프레임을 낸다:
 *
 * - **page 노드 + `metadata.type: "legacy-page"`** — Skia 체인의 `pageIndex` /
 *   `sceneSnapshot.pageSnapshots` 가 페이지를 인식하는 표식.
 * - **body 노드는 소문자 `"body"`** — Preview 는 `el.type === "body"` 로 찾는다
 *   (`preview/App.tsx:1289,435`). 대문자 `"Body"` 면 body 를 못 찾아 자식 서브트리가
 *   **통째로** 렌더되지 않는다. shape probe 가 이 축을 단독 변수로 확정했다 (S4 vs S5).
 * - **body 는 page 아래 중첩** — 문서 루트로 올리면 오히려 실패한다 (S6).
 */

import type { CompositionDocument } from "@composition/shared";

export const CASE_PROJECT_ID = "adr198-pilot";

/** 케이스별 page/body id — 케이스 간 registry 충돌을 피하려 접두사를 나눈다. */
export function caseIds(prefix: string) {
  return {
    page: `${prefix}-page`,
    body: `${prefix}-body`,
  };
}

export interface ScaffoldOptions {
  prefix: string;
  width: number;
  height: number;
  /** body 배경 — hex6/hex8 표기는 케이스가 정한다 */
  background: string;
  padding: number;
  children: unknown[];
}

/** page > body > children 문서를 만든다. */
export function scaffoldDocument(opts: ScaffoldOptions): CompositionDocument {
  const ids = caseIds(opts.prefix);
  return {
    version: "composition-1.0",
    children: [
      {
        id: ids.page,
        type: "frame",
        metadata: { type: "legacy-page", pageId: ids.page },
        children: [
          {
            id: ids.body,
            type: "body",
            props: {
              style: {
                display: "block",
                width: `${opts.width}px`,
                height: `${opts.height}px`,
                paddingTop: `${opts.padding}px`,
                paddingRight: `${opts.padding}px`,
                paddingBottom: `${opts.padding}px`,
                paddingLeft: `${opts.padding}px`,
                backgroundColor: opts.background,
                boxSizing: "border-box",
              },
            },
            children: opts.children,
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

/**
 * 초기 region 예산. **Phase 4(G3)에서 파일럿으로 교정되기 전의 선언값**이며,
 * 여기 숫자가 곧 승인된 예산이라는 뜻이 아니다 (breakdown §3.6 — L3 의 0.001 은
 * 기존 상수에서 출발하되 파일럿으로 증명돼야 한다).
 *
 * 비율과 진폭을 **둘 다** 둔다 (HC6). Phase 0 §2.4 가 근거다 — blur 는 프레임의
 * 19.6% 가 다르지만 `maxByte 3` 이고, AA hairline 은 1.2% 가 다르지만 `maxByte 59`
 * 다. 비율 단독 판정은 이 둘의 심각도를 거꾸로 매긴다.
 */
export const INITIAL_BUDGETS = {
  /** 단색 채움 — 두 rasterizer 가 사실상 같아야 하는 자리 */
  nonText: { maxDiffRatio: 0.001, maxByte: 2 },
  /** AA / clip 경계 밴드 — Phase 0 실측 AA maxByte 59, clip 25 */
  edge: { maxDiffRatio: 0.02, maxByte: 64 },
  /** 텍스트 — hinting/subpixel 차이가 가장 큰 자리. Phase 6 에서 ratchet */
  text: { maxDiffRatio: 0.05, maxByte: 128 },
  /** 래스터 — 디코드/샘플링 차이 */
  raster: { maxDiffRatio: 0.01, maxByte: 8 },
} as const;
