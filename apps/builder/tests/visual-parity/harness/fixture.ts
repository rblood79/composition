/**
 * ADR-198 — 파일럿 canonical fixture (test-only)
 *
 * **HC2 (one fixture authority)**: Skia leg 과 Preview leg 은 이 모듈이 내보내는
 * *같은 객체* 를 소비한다. leg 별로 손으로 만든 scene / DOM 트리는 금지다 —
 * 두 leg 이 서로 다른 입력을 보면 그 뒤의 픽셀 비교는 아무것도 증명하지 못한다.
 *
 * Phase 0 파일럿이라 텍스트가 없다 (frame + 중첩 box + border/radius + 단색 fill).
 * 폰트 로딩은 Phase 3 의 readiness 계약으로 넘긴다.
 */

import type { CompositionDocument } from "@composition/shared";

export const FIXTURE_PROJECT_ID = "adr198-pilot";
export const FIXTURE_PAGE_ID = "adr198-page";
export const FIXTURE_ARTBOARD = { width: 320, height: 240 } as const;

/** 파일럿이 확인하는 색 — Skia leg 과 Preview leg 이 같은 값을 그려야 한다. */
export const FIXTURE_COLORS = {
  /** page body 배경 */
  body: "#FFFFFF",
  /** 바깥 frame fill */
  outer: "#2F6FEDFF",
  /** 안쪽 box fill */
  inner: "#E8443FFF",
} as const;

/**
 * `frame > frame` 2단. 바깥은 padding 을 갖고, 안쪽은 radius + border 를 갖는다.
 * 좌표를 고정해 두 leg 의 geometry 비교(L1)가 의미를 갖게 한다.
 */
export function createPilotDocument(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: FIXTURE_PAGE_ID,
        type: "frame",
        name: "adr198-pilot-page",
        props: {
          style: {
            width: `${FIXTURE_ARTBOARD.width}px`,
            height: `${FIXTURE_ARTBOARD.height}px`,
            backgroundColor: FIXTURE_COLORS.body,
            display: "flex",
            padding: "24px",
            boxSizing: "border-box",
          },
        },
        children: [
          {
            id: "adr198-outer",
            type: "frame",
            name: "outer",
            props: {
              style: {
                width: "272px",
                height: "192px",
                backgroundColor: FIXTURE_COLORS.outer,
                display: "flex",
                padding: "32px",
                boxSizing: "border-box",
              },
            },
            children: [
              {
                id: "adr198-inner",
                type: "frame",
                name: "inner",
                props: {
                  style: {
                    width: "208px",
                    height: "128px",
                    backgroundColor: FIXTURE_COLORS.inner,
                    borderRadius: "16px",
                    borderWidth: "4px",
                    borderStyle: "solid",
                    borderColor: "#102A5CFF",
                    boxSizing: "border-box",
                  },
                },
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
