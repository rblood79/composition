/**
 * ADR-198 파일럿 케이스 3 — `text-raster-resources`
 *
 * 비동기 리소스가 들어오는 첫 케이스다: 저장소 폰트로 조판된 텍스트 + 로컬 이미지.
 *
 * 이 케이스의 목적은 픽셀 일치가 아니라 **readiness 계약을 드러내는 것**이다.
 * 폰트 등록과 이미지 디코드는 프레임 수로 기다릴 수 없다 — 캡처가 그보다 먼저
 * 끝나면 두 leg 이 각각 "폰트 없는 텍스트" 와 "디코드 전 빈 박스" 를 내고,
 * 그 둘의 diff 는 아무 의미가 없다 (R6). Preview 드라이버의 수렴 settle 과
 * Skia 쪽 `fontMgr` 준비가 여기서 처음 실제로 시험된다.
 *
 * 이미지는 저장소에 실재하는 `/appIcon.svg` 를 쓴다. 외부 URL 은 금지다 (HC4 —
 * 외부 네트워크 리소스 0).
 */

import type { VisualParityCase } from "../harness/types";
import { caseIds, INITIAL_BUDGETS, scaffoldDocument } from "./scaffold";

const PREFIX = "textraster";
const ids = caseIds(PREFIX);
const HEADING = `${PREFIX}-heading`;
const PARAGRAPH = `${PREFIX}-paragraph`;
const IMAGE = `${PREFIX}-image`;

export const textRasterResources: VisualParityCase = {
  id: "text-raster-resources",
  pageId: ids.page,
  viewport: { width: 320, height: 240, dpr: 1 },
  theme: "light",
  document: scaffoldDocument({
    prefix: PREFIX,
    width: 320,
    height: 240,
    background: "#FFFFFF",
    padding: 16,
    children: [
      {
        id: HEADING,
        type: "Heading",
        props: {
          children: "Parity heading",
          style: {
            // 폰트 축을 고정한다 — 두 leg 이 같은 조판 입력을 봐야 한다
            fontFamily: "Pretendard",
            fontSize: "20px",
            lineHeight: "28px",
            fontWeight: 700,
            color: "#102A5C",
          },
        },
      },
      {
        id: PARAGRAPH,
        type: "Paragraph",
        props: {
          children:
            "Deterministic text rendering across the Skia and DOM consumers.",
          style: {
            fontFamily: "Pretendard",
            fontSize: "14px",
            lineHeight: "20px",
            fontWeight: 400,
            color: "#333333",
            width: "260px",
          },
        },
      },
      {
        id: IMAGE,
        type: "Image",
        props: {
          // 저장소 자산 — 외부 네트워크 0 (HC4)
          src: "/appIcon.svg",
          alt: "app icon",
          objectFit: "contain",
          style: {
            display: "block",
            width: "64px",
            height: "64px",
          },
        },
      },
    ],
  }),
  artboardNodeId: ids.page,
  expectedNodeIds: [ids.body, HEADING, PARAGRAPH, IMAGE],
  regions: [
    {
      id: "heading-text",
      nodeIds: [HEADING],
      kind: "text",
      reason: "Pretendard 700/20px — hinting·subpixel 축",
      ...INITIAL_BUDGETS.text,
    },
    {
      id: "paragraph-text",
      nodeIds: [PARAGRAPH],
      kind: "text",
      reason: "줄바꿈이 있는 본문 — line breaking 축",
      ...INITIAL_BUDGETS.text,
    },
    {
      id: "image-raster",
      nodeIds: [IMAGE],
      kind: "raster",
      reason: "로컬 SVG 디코드 + objectFit contain 샘플링",
      ...INITIAL_BUDGETS.raster,
    },
    {
      id: "resource-geometry",
      nodeIds: [HEADING, PARAGRAPH, IMAGE],
      kind: "geometry",
    },
  ],
};
