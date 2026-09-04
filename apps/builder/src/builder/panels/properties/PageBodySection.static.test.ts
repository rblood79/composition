/**
 * PageBodySection 배선 정적 가드.
 *
 * **왜 정적 검사인가**: 이 결함의 원래 실패 모드가 "컴포넌트는 남아 있는데 소비 지점만
 * 사라짐" 이었다. 2026-06-03 `5b89e707e` 가 per-type dispatch(`getEditor`)를 제거하면서
 * body 분기를 대체 없이 떨어뜨렸고, PageBodyEditor / LayoutBodyEditor 파일과 그 테스트가
 * 그대로 통과해 type-check·vitest 어디에서도 잡히지 않았다. 도달 가능성은 파일 존재가
 * 아니라 **소비 지점**이 보증하므로 소스로 단언한다.
 *
 * 두 단언은 짝이다 — 섹션이 렌더되는데 EmptyState 억제가 빠지면 "편집 계약이 비어
 * 있습니다" 가 실제 컨트롤과 함께 떠서 모순된 안내가 되고, 억제만 남고 섹션이 빠지면
 * body 선택 시 Properties 패널이 통째로 빈다.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEDICATED_SECTION_TYPES } from "./pageBodySectionConstants";

const HERE = dirname(fileURLToPath(import.meta.url));
const panelSource = readFileSync(resolve(HERE, "PropertiesPanel.tsx"), "utf8");

describe("PropertiesPanel body wiring", () => {
  it("mounts PageBodySection", () => {
    expect(panelSource).toMatch(/<PageBodySection\s+elementId=/);
  });

  it("suppresses the empty edit-contract state for dedicated section types", () => {
    expect(panelSource).toContain(
      "DEDICATED_SECTION_TYPES.has(selectedElement.type)",
    );
  });

  it("keeps body in the dedicated section type set", () => {
    expect(DEDICATED_SECTION_TYPES.has("body")).toBe(true);
  });
});

describe("page/frame authoring reachability", () => {
  const sectionSource = readFileSync(
    resolve(HERE, "PageBodySection.tsx"),
    "utf8",
  );

  it("keeps both edit-mode branches wired", () => {
    // page 모드 → Layout 연결 / 부모 페이지 / customId / className,
    // layout 모드 → 프레임 프리셋(Slot 자동 생성). 한쪽만 남으면 그 축이 다시 미도달.
    expect(sectionSource).toContain("<PageBodyEditor");
    expect(sectionSource).toContain("<LayoutBodyEditor");
  });
});
