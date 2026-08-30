/**
 * ADR-198 — 파일럿 canonical fixture (test-only)
 *
 * **HC2 (one fixture authority)**: Skia leg 과 Preview leg 은 이 모듈이 내보내는
 * *같은 문서* 를 소비한다. leg 별로 손으로 만든 scene / DOM 트리는 금지다 —
 * 두 leg 이 서로 다른 입력을 보면 그 뒤의 픽셀 비교는 아무것도 증명하지 못한다.
 *
 * ## 구조가 이 모양인 이유 (Phase 0 실측)
 *
 * - **page frame + `metadata.type: "legacy-page"`** — Skia 체인의 `pageIndex` /
 *   `sceneSnapshot.pageSnapshots` 가 페이지를 인식하는 표식.
 * - **`Body` 노드** — `buildPageLayoutPublisherInput` 이
 *   `pageSnapshot.bodyElement` 를 못 찾으면 null 을 반환한다.
 * - **컨테이너는 `frame`** — ADR-130 의 canonical layout container. `Card` 로
 *   바꾸면 Skia 배경이 칠해지지만, 그건 게이트를 통과시키려고 입력을 고른 것이라
 *   측정으로서 무효다 (measurement-validity §1 Q2).
 * - **색은 hex8** — 사용자가 실제로 오소링하는 형태. Skia catalog 채널이 hex6
 *   전용이라는 사실은 이 fixture 가 드러내야 할 대상이지 회피할 대상이 아니다.
 *
 * 텍스트 0 (폰트 의존 배제), transition/animation 0 (wall-clock 미독출 — HC5).
 */

import type { CompositionDocument } from "@composition/shared";

export const FIXTURE_PROJECT_ID = "adr198-pilot";
export const FIXTURE_PAGE_ID = "adr198-page";
export const FIXTURE_BODY_ID = "adr198-body";
export const FIXTURE_OUTER_ID = "adr198-outer";
export const FIXTURE_INNER_ID = "adr198-inner";

export const FIXTURE_ARTBOARD = { width: 240, height: 180 } as const;

/** 파일럿이 확인하는 색 — 두 leg 이 같은 값을 그려야 한다. */
export const FIXTURE_COLORS = {
  body: "#FFFFFFFF",
  outer: "#2F6FEDFF",
  inner: "#E8443FFF",
  border: "#102A5CFF",
} as const;

/** 기대 geometry (아티보드 상대) — L1 대조의 기준값. */
export const FIXTURE_GEOMETRY = {
  body: { x: 0, y: 0, width: 240, height: 180 },
  outer: { x: 20, y: 20, width: 160, height: 110 },
  inner: { x: 46, y: 46, width: 60, height: 40 },
} as const;

export function createPilotDocument(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: FIXTURE_PAGE_ID,
        type: "frame",
        metadata: { type: "legacy-page", pageId: FIXTURE_PAGE_ID },
        children: [
          {
            id: FIXTURE_BODY_ID,
            // **소문자** — Preview 는 `el.type === "body"` 로 찾는다
            // (`preview/App.tsx:1289,435`). 대문자 `"Body"` 로 두면 Preview 가
            // body 를 못 찾아 자식 서브트리가 통째로 렌더되지 않는다.
            // Phase 0 shape probe 가 이 축을 단독 변수로 확정했다 (S4 vs S5).
            type: "body",
            props: {
              style: {
                display: "block",
                width: `${FIXTURE_ARTBOARD.width}px`,
                height: `${FIXTURE_ARTBOARD.height}px`,
                paddingTop: "20px",
                paddingRight: "20px",
                paddingBottom: "20px",
                paddingLeft: "20px",
                backgroundColor: FIXTURE_COLORS.body,
                boxSizing: "border-box",
              },
            },
            children: [
              {
                id: FIXTURE_OUTER_ID,
                type: "frame",
                props: {
                  style: {
                    display: "block",
                    width: "160px",
                    height: "110px",
                    paddingTop: "24px",
                    paddingRight: "24px",
                    paddingBottom: "24px",
                    paddingLeft: "24px",
                    backgroundColor: FIXTURE_COLORS.outer,
                    borderRadius: "12px",
                    borderTopWidth: "2px",
                    borderRightWidth: "2px",
                    borderBottomWidth: "2px",
                    borderLeftWidth: "2px",
                    borderTopStyle: "solid",
                    borderRightStyle: "solid",
                    borderBottomStyle: "solid",
                    borderLeftStyle: "solid",
                    borderTopColor: FIXTURE_COLORS.border,
                    borderRightColor: FIXTURE_COLORS.border,
                    borderBottomColor: FIXTURE_COLORS.border,
                    borderLeftColor: FIXTURE_COLORS.border,
                    boxSizing: "border-box",
                  },
                },
                children: [
                  {
                    id: FIXTURE_INNER_ID,
                    type: "frame",
                    props: {
                      style: {
                        display: "block",
                        width: "60px",
                        height: "40px",
                        backgroundColor: FIXTURE_COLORS.inner,
                        boxSizing: "border-box",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

/**
 * fixture checksum — 두 leg 이 같은 입력을 봤음을 증명하는 L0 의 근거 (HC2).
 * 키 순서를 정규화해 직렬화 순서 차이가 가짜 불일치를 만들지 않게 한다.
 */
export function fixtureChecksum(doc: unknown): string {
  const canonicalize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonicalize);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(o).sort()) out[k] = canonicalize(o[k]);
      return out;
    }
    return v;
  };
  const json = JSON.stringify(canonicalize(doc));
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
