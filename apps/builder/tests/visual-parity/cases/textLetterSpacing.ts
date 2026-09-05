/**
 * ADR-205 G3 — `text-letter-spacing`
 *
 * 이 케이스가 존재하는 이유는 하나다: **기존 fixture 로는 새 경로가 한 번도 실행되지
 * 않는다.** 인라인 `letterSpacing` 은 factory 기본값 0건 · import 어댑터 0건 · theme 0건
 * 이라(ADR-205 §영향 범위) 파일럿 3종 어디에도 `ls ≠ 0` 이 없다. 그 상태에서 "기존
 * fixture maxByte 0" 을 통과 조건으로 두면 **변경 미반영과 구별되지 않는다**
 * (`measurement-validity.md` §1 Q2 · §2 패턴 6).
 *
 * 판정축은 **줄바꿈**이다. 폭을 고정한 문단에 `letter-spacing: 2px` 를 주면 DOM 은 자간을
 * 반영해 한 줄 일찍 접는다. Skia 가 그 값을 못 읽으면 `ls 0` 결과로 조판되어 줄 수가
 * 달라지고, 픽셀 diff 는 텍스트 예산을 크게 벗어난다 — 즉 **결선 전에는 반드시 실패하고
 * 결선 후에만 통과하는** 케이스다.
 *
 * **자간을 20px 로 크게 잡은 이유**: 축이 잡음을 압도해야 한다. 같은 폭에서 `2px` 는
 * 이 문자열의 줄 수를 바꾸지 않아(양쪽 2줄) 실측 diff 가 텍스트 래스터 기본 격차
 * (대조군 0.073) 에 묻혔다 — 결선을 원복해도 수치가 소수점 5자리까지 같았다. `20px`
 * 에서는 spaced 문단이 **6줄(h 120)**, 대조군이 2줄(h 40) 로 갈리고, 결선이 끊기면 두 leg
 * 의 줄 수 자체가 달라져 L1 geometry 부터 무너진다. 즉 이 케이스는 **결선이 살아 있을
 * 때만 통과**한다 (실측: ls 20 결선 시 spaced diffRatio 0.0220 < 대조군 0.0862 — Arial 기준, ADR-205 Phase 4).
 */

import type { VisualParityCase } from "../harness/types";
import { caseIds, INITIAL_BUDGETS, scaffoldDocument } from "./scaffold";

const PREFIX = "letterspacing";
const ids = caseIds(PREFIX);
const SPACED = `${PREFIX}-spaced`;
const CONTROL = `${PREFIX}-control`;
const ANCHOR = `${PREFIX}-anchor`;

/** 두 문단이 같은 문자열·같은 폭을 쓴다 — 자간만이 유일한 변수다. */
const BODY = "Letter spacing changes where this line wraps.";
const WIDTH = "260px";

const SHARED_TEXT_STYLE = {
  // **Pretendard 를 쓰지 않는다.** Skia leg 의 Canvas 2D 측정은 tester 페이지에서
  // 일어나고 Preview leg 은 폰트를 실은 iframe 안에서 조판된다 — 두 문맥의 폰트 집합이
  // 달라 같은 문자열이 다른 폭으로 나온다 (실측: tester 에서 Pretendard 14px = 255px
  // = 폴백 폰트 metric, Preview iframe 은 실제 Pretendard 로 260px 을 넘겨 2줄).
  // 그 격차는 예전에 fontSize 결손(px 문자열 → 16 fallback)이 Skia 를 291px 로 부풀려
  // 우연히 가려져 있었다. 시스템 폰트를 쓰면 두 문맥이 같은 metric 을 본다.
  fontFamily: "Arial",
  fontSize: "14px",
  lineHeight: "20px",
  fontWeight: 400,
  color: "#333333",
  width: WIDTH,
} as const;

export const textLetterSpacing: VisualParityCase = {
  id: "text-letter-spacing",
  pageId: ids.page,
  viewport: { width: 300, height: 220, dpr: 1 },
  theme: "light",
  document: scaffoldDocument({
    prefix: PREFIX,
    width: 300,
    height: 220,
    background: "#FFFFFF",
    padding: 16,
    children: [
      {
        // liveness 앵커 — 텍스트만 있는 케이스는 폰트가 늦으면 두 leg 이 모두
        // 단색이 되고, 하니스는 그것을 "일치" 가 아니라 죽은 프레임으로 판정한다
        // (`PARITY-LIVE`: skia 프레임 분산 0). 단색 사각 하나가 그 축을 살린다.
        id: ANCHOR,
        type: "frame",
        props: {
          style: {
            display: "block",
            width: "40px",
            height: "16px",
            backgroundColor: "#2F6FEDFF",
          },
        },
      },
      {
        id: SPACED,
        type: "Text",
        props: {
          children: BODY,
          style: { ...SHARED_TEXT_STYLE, letterSpacing: "20px" },
        },
      },
      {
        // 대조군 — 같은 케이스 안에 두어 "케이스 전체가 깨졌다" 와
        // "자간 축만 깨졌다" 를 한 실행에서 구별한다.
        id: CONTROL,
        type: "Text",
        props: {
          children: BODY,
          style: { ...SHARED_TEXT_STYLE },
        },
      },
    ],
  }),
  artboardNodeId: ids.page,
  expectedNodeIds: [ids.body, ANCHOR, SPACED, CONTROL],
  regions: [
    {
      id: "letter-spacing-text",
      nodeIds: [SPACED],
      kind: "text",
      reason:
        "letter-spacing 2px — 자간이 조판과 줄바꿈에 반영되는 축 (ADR-205)",
      ...INITIAL_BUDGETS.text,
    },
    {
      id: "letter-spacing-control-text",
      nodeIds: [CONTROL],
      kind: "text",
      reason: "같은 문자열·폭의 ls 0 대조군 — 회귀와 자간 결손을 구별한다",
      ...INITIAL_BUDGETS.text,
    },
    {
      id: "letter-spacing-anchor",
      nodeIds: [ANCHOR],
      kind: "non-text",
      reason: "liveness 앵커 — 단색 사각",
      ...INITIAL_BUDGETS.nonText,
    },
    {
      id: "letter-spacing-geometry",
      nodeIds: [SPACED, CONTROL],
      kind: "geometry",
    },
  ],
};
