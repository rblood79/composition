/**
 * DOM 컨테이너 클래스 ↔ catalog rule key 정합 계약 (2026-08-21).
 *
 * **Why**: canonical `TextArea` 는 DOM 에서 `.react-aria-TextArea` 가 아니라
 * **`.react-aria-TextField`** 로 렌더된다 — binding 의 `source.component` 가 `TextField` 이고
 * (RAC 에 TextArea **컨테이너** primitive 가 없다) `CanonicalNodeRenderer` 의 catalog cutover
 * 경로가 `RAC[source.component]` 를 그대로 렌더하기 때문이다. RAC 는 자기 이름으로 기본
 * className 을 붙이므로, 생성 CSS 가 노리는 `.react-aria-{ruleKey}` 는 **구조적으로 영원히
 * 미매칭**이었다(라이브 실측: 생성 `TextArea.css` 전량 dead, 실제 시각은 TextField.css 가 담당).
 *
 * 더 나쁜 점은 `.react-aria-TextArea` 라는 이름이 RAC 에서 **안쪽 `<textarea>`** 의 클래스라는
 * 것이다 — 그 이름으로 컨테이너 규칙(display:flex/gap)을 emit 하면 나중에 진짜 textarea 가
 * 들어오는 순간 엉뚱한 요소에 걸린다. 그래서 "안 걸리는 CSS 를 고치는" 방향이 아니라
 * **만들지 않는** 방향으로 닫았다 (`generate-css.ts` 의 binding 파생 게이트).
 *
 * 본 테스트는 그 게이트가 커버해야 할 집합을 **컴포넌트 이름 목록이 아니라 데이터에서** 고정한다.
 */

import { describe, it, expect } from "vitest";
import { getComponentRulesTable } from "../resolvers/resolveComponentRule";
import { getPrimitiveBinding } from "../bindings";

/** rule key 와 DOM 컨테이너 클래스가 어긋나는 rule 목록 (structure 보유 = CSS emit 후보). */
function collectDomClassMismatches(): { key: string; domComponent: string }[] {
  const out: { key: string; domComponent: string }[] = [];
  for (const [key, rule] of Object.entries(getComponentRulesTable())) {
    if (!rule.structure) continue;
    const source = getPrimitiveBinding(key)?.source;
    if (source?.kind !== "rac") continue;
    if (source.component === key) continue;
    if (source.component.toLowerCase() === key.toLowerCase()) continue;
    out.push({ key, domComponent: source.component });
  }
  return out;
}

describe("DOM 컨테이너 클래스 ↔ rule key 정합", () => {
  it("어긋나는 rule 은 TextArea 하나뿐이다 — 새로 생기면 CSS 게이트 검토가 필요하다", () => {
    expect(collectDomClassMismatches()).toEqual([
      { key: "TextArea", domComponent: "TextField" },
    ]);
  });

  it("TextArea binding 은 RAC TextField 를 렌더한다 (게이트의 전제)", () => {
    const source = getPrimitiveBinding("TextArea")?.source;
    expect(source?.kind).toBe("rac");
    expect(source?.kind === "rac" && source.component).toBe("TextField");
  });
});

describe("TextArea sizes — field 패밀리 스케일 정렬", () => {
  const table = getComponentRulesTable();

  it("fontSize / paddingX / borderRadius 가 TextField 와 같다", () => {
    const ta = table.TextArea.sizes;
    const tf = table.TextField.sizes;
    for (const size of ["sm", "md", "lg", "xl"] as const) {
      expect(
        {
          size,
          fontSize: ta[size].fontSize,
          paddingX: ta[size].paddingX,
          borderRadius: ta[size].borderRadius,
        },
        `size=${size}`,
      ).toEqual({
        size,
        fontSize: tf[size].fontSize,
        paddingX: tf[size].paddingX,
        borderRadius: tf[size].borderRadius,
      });
    }
  });

  it("height 는 TextArea 고유값으로 유지된다 — 여러 줄 입력 박스", () => {
    const ta = table.TextArea.sizes;
    expect([ta.sm.height, ta.md.height, ta.lg.height, ta.xl.height]).toEqual([
      64, 80, 120, 160,
    ]);
    // TextField 한 줄 높이와 달라야 한다 (동일해지면 스케일 정렬이 과했다는 신호).
    expect(ta.md.height).not.toBe(table.TextField.sizes.md.height);
  });

  it("xs 는 없다 — Spectrum text-area 는 s/m/l/xl 4종", () => {
    expect(Object.keys(table.TextArea.sizes).sort()).toEqual([
      "lg",
      "md",
      "sm",
      "xl",
    ]);
  });
});
