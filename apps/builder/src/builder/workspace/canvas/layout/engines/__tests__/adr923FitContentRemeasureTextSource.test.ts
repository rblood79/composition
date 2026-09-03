import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getComponentRulesTable } from "@composition/shared";

import type { CanvasLayoutNode } from "../../layoutNode";
import {
  getPropagationRules,
  getRegisteredPropagationTags,
} from "../../../../../utils/propagationRegistry";
import { applyImplicitStyles } from "../implicitStyles";
import {
  resolveFitContentRemeasureText,
  resolveRemeasureChildProps,
  resolveSubpartAwareImplicitStyles,
  shouldRemeasureFitContentWidth,
} from "../fitContentRemeasure";

/**
 * ADR-923 Phase 5 후속 (2026-09-04) — **3.6 fit-content 재측정의 텍스트 출처** 전수 대조.
 *
 * **가설**: `fullTreeLayout` 3.6 은 자식 `props.children` 으로 폭을 다시 잰다. 자식 텍스트를 parent 가
 * 정하는 컴포넌트에서 자식 store 값이 낡아 있으면 (Inspector 가 아닌 writer 가 parent prop 만 바꾼 뒤,
 * 읽기 시점 propagation 이 표시 텍스트를 갈아끼운 상태) Canvas 상자만 낡은 텍스트 폭이 된다. Meter Label
 * 이 실제로 그랬다 (raw "Storage" 54 vs 표시 "Name" 40 = DOM 39, 2026-09-03).
 *
 * **반증 케이스**: 텍스트가 parent 에서 오는 자식을 전부 세워 실제로 재측정이 걸리는지 본다. 두 축:
 *
 *  - **축 A (registry `children` 전파)** — `parentProp → 자식 children` 규칙을 가진 (parent, child) 쌍
 *    전부. 자식에 낡은 텍스트 + `width: fit-content` 를 얹고 implicit 을 돌린 뒤 판정을 부른다. 재측정이
 *    걸리면 그때 읽히는 텍스트가 **parent 가 정한 표시 텍스트** 여야 한다.
 *  - **축 B (파생 텍스트 leaf, 양성 대조)** — Meter/ProgressBar 의 값 leaf 와 SliderOutput 은 재측정이
 *    실제로 걸리는 자리다 (implicit 이 fontSize 를 주입하고 factory 가 `width: fit-content` 를 쓴다).
 *    여기서는 implicit 이 `children` 을 파생 텍스트로 덮으므로 재측정이 옳은 텍스트를 읽는다 — 그 덮기가
 *    사라지면 이 축이 RED 가 된다 (게이트가 공허하지 않다는 증거).
 *
 * 판정 3개는 production 함수 (`fitContentRemeasure.ts`) 를 그대로 부른다 — 복사본 대조 금지.
 */

const STALE_TEXT = "Storage";
const SHOWN_TEXT = "Name";

/** lowercase registry tag → catalog 표의 PascalCase type. */
function pascalTypeMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const type of Object.keys(getComponentRulesTable())) {
    map.set(type.toLowerCase(), type);
  }
  return map;
}

interface Pair {
  parentType: string;
  childType: string;
  parentProp: string;
}

function textPropagationPairs(): Pair[] {
  const pascal = pascalTypeMap();
  const pairs: Pair[] = [];
  for (const tag of getRegisteredPropagationTags()) {
    const parentType = pascal.get(tag);
    if (!parentType) continue;
    for (const rule of getPropagationRules(tag) ?? []) {
      if (rule.childProp !== "children") continue;
      // 읽기 시점 propagation (`resolvePropagatedProps`) 은 직계 자식 1단계만 매칭한다 —
      //   중첩 childPath 는 Inspector 쓰기 경로에서만 해석되므로 store 가 늘 최신이다.
      if (typeof rule.childPath !== "string") continue;
      if (!rule.parentProp) continue;
      const childType = pascal.get(rule.childPath.toLowerCase());
      if (!childType) continue;
      pairs.push({ parentType, childType, parentProp: rule.parentProp });
    }
  }
  return pairs;
}

/** parent + 자식 1개로 implicit 을 돌리고 3.6 판정 입력을 만든다. */
function judge(
  parentType: string,
  parentProps: Record<string, unknown>,
  child: CanvasLayoutNode,
): { fires: boolean; measuredText: string } {
  const parentId = `${parentType}-fcr`;
  const childNode = { ...child, parent_id: parentId } as CanvasLayoutNode;
  const parent = {
    id: parentId,
    type: parentType,
    props: parentProps,
    childrenIds: [childNode.id],
  } as unknown as CanvasLayoutNode;
  const byId = new Map<string, CanvasLayoutNode>([
    [parent.id, parent],
    [childNode.id, childNode],
  ]);
  const { filteredChildren } = applyImplicitStyles(
    parent as never,
    [childNode] as never,
    ((id: string) =>
      id === parent.id ? [childNode] : []) as never,
    byId as never,
  );
  const modified = filteredChildren.find((c) => c.id === childNode.id) as
    | CanvasLayoutNode
    | undefined;
  if (!modified) return { fires: false, measuredText: "" };
  const { origStyle, modStyle } = resolveSubpartAwareImplicitStyles(
    childNode,
    modified,
    byId,
  );
  return {
    fires: shouldRemeasureFitContentWidth(origStyle, modStyle),
    measuredText: resolveFitContentRemeasureText(
      resolveRemeasureChildProps(parent, modified),
    ),
  };
}

describe("ADR-923 — 3.6 fit-content 재측정의 텍스트 출처", () => {
  it("축 A: parent 가 텍스트를 정하는 자식에서 재측정이 낡은 store 텍스트를 읽지 않는다", () => {
    const pairs = textPropagationPairs();
    expect(pairs.length).toBeGreaterThan(10);

    const stale: string[] = [];
    for (const { parentType, childType, parentProp } of pairs) {
      const child = {
        id: `${childType}-fcr-child`,
        type: childType,
        props: { children: STALE_TEXT, style: { width: "fit-content" } },
      } as unknown as CanvasLayoutNode;
      const { fires, measuredText } = judge(
        parentType,
        { [parentProp]: SHOWN_TEXT, label: SHOWN_TEXT },
        child,
      );
      if (fires && measuredText !== SHOWN_TEXT) {
        stale.push(`${parentType} > ${childType} (재측정 텍스트 "${measuredText}")`);
      }
    }
    expect(stale, "재측정이 표시 텍스트가 아닌 값을 읽는 쌍").toEqual([]);
  });

  it("축 B: 파생 값 leaf 는 재측정이 실제로 걸리고 파생 텍스트를 읽는다 (양성 대조)", () => {
    const cases: Array<{ parent: string; child: string; shown: string }> = [
      { parent: "Meter", child: "MeterValue", shown: "3%" },
      { parent: "ProgressBar", child: "ProgressBarValue", shown: "3%" },
      { parent: "Slider", child: "SliderOutput", shown: "3" },
    ];
    for (const { parent, child, shown } of cases) {
      const node = {
        id: `${child}-fcr-child`,
        type: child,
        props: { children: "75%", style: { width: "fit-content" } },
      } as unknown as CanvasLayoutNode;
      const { fires, measuredText } = judge(
        parent,
        { value: 3, minValue: 0, maxValue: 100, label: SHOWN_TEXT },
        node,
      );
      expect(fires, `${parent} > ${child} 재측정 발생`).toBe(true);
      expect(measuredText, `${parent} > ${child} 재측정 텍스트`).toBe(shown);
    }
  });

  it("3.6 이 재측정 입력으로 propagation 을 얹은 props 를 쓴다 (배선)", () => {
    // 판정 함수 단위 PASS 는 그 사이 매핑의 증거가 아니다 — 3.6 이 **부모 rawElement 로** 술어를 부르고
    //   그 결과를 폭 계산 입력 (`childForWidth`) 에 싣는지 원문으로 확인한다 (`fullTreeLayout.static`
    //   선례 동형).
    const source = readFileSync(
      resolve(__dirname, "../fullTreeLayout.ts"),
      "utf-8",
    );
    expect(source).toContain(
      "const propagatedChildProps = resolveRemeasureChildProps(",
    );
    expect(source).toContain("...propagatedChildProps,");
    expect(source).not.toContain(
      "const childForWidth: CanvasLayoutNode = {\n            ...filteredChild,\n            props: {\n              ...filteredChild.props,",
    );
  });
});
