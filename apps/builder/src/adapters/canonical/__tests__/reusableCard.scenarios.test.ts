/**
 * ADR-138 A-1 — reusable Card (baseline, region) 검증 시나리오.
 *
 * 검증 대상: canonical reusable schema 의 `RefNode.descendants[<자식 stable id>]`
 * 자식 영역(region) override. Card factory 의 CardHeader/CardContent/CardFooter
 * 자식은 `slot` 필드가 아니라 자식 노드의 stable `id` path 로 addressable
 * (breakdown §4 reusableCard note 참조).
 *
 * descendants mode A (속성 patch — id/type/children 없음) 만 검증한다.
 * mode B/C 는 본 ADR scope 외.
 *
 * @see docs/adr/design/138-component-palette-reusable-breakdown.md §4
 */

import { describe, it, expect } from "vitest";
import type {
  CanonicalNode,
  DescendantOverride,
  RefNode,
} from "@composition/shared";
import {
  resolveCanonicalDescendantOverride,
  resolveCanonicalRefProps,
} from "../instanceResolver";

// ─────────────────────────────────────────────
// fixture helpers
// ─────────────────────────────────────────────

function cardChild(
  id: string,
  type: CanonicalNode["type"],
  props: Record<string, unknown>,
): CanonicalNode {
  return { id, type, props };
}

/** reusable Card origin — named region 자식 3개 (stable customId). */
function cardOrigin(id: string): CanonicalNode {
  return {
    id,
    type: "Card",
    reusable: true,
    props: {},
    children: [
      cardChild("cardheader_1", "CardHeader", { title: "Origin Header" }),
      cardChild("cardcontent_1", "CardContent", { text: "Origin Content" }),
      cardChild("cardfooter_1", "CardFooter", { text: "Origin Footer" }),
    ],
  };
}

function regionOf(card: CanonicalNode, childId: string): CanonicalNode {
  const found = card.children?.find((c) => c.id === childId);
  if (!found) throw new Error(`region not found: ${childId}`);
  return found;
}

// ─────────────────────────────────────────────
// 시나리오 — region(descendants[childId]) baseline 3
// ─────────────────────────────────────────────

describe("ADR-138 A-1 reusable Card — region(descendants) 시나리오", () => {
  it("region 인식 — Card origin 등록 + instance ref → 자식 subtree 의 stable id 가 addressable", () => {
    const card = cardOrigin("card-o");
    const ref: RefNode = {
      id: "card-inst",
      type: "ref",
      ref: "card-o",
      props: {},
    };

    // instance root props (override 없음) = origin
    expect(resolveCanonicalRefProps(card, ref)).toEqual({});
    expect(card.reusable).toBe(true);
    // 각 region 자식이 stable id 로 addressable
    expect(regionOf(card, "cardheader_1").type).toBe("CardHeader");
    expect(regionOf(card, "cardcontent_1").type).toBe("CardContent");
    expect(regionOf(card, "cardfooter_1").type).toBe("CardFooter");
  });

  it("region override — descendants[cardheader_1] patch 시 CardHeader 만 변경, Content/Footer 는 origin 그대로 resolve", () => {
    const card = cardOrigin("card-o");
    const descendants: Record<string, DescendantOverride> = {
      cardheader_1: { title: "Patched Header" },
    };

    const header = resolveCanonicalDescendantOverride(
      regionOf(card, "cardheader_1"),
      descendants,
      "cardheader_1",
    );
    const content = resolveCanonicalDescendantOverride(
      regionOf(card, "cardcontent_1"),
      descendants,
      "cardcontent_1",
    );
    const footer = resolveCanonicalDescendantOverride(
      regionOf(card, "cardfooter_1"),
      descendants,
      "cardfooter_1",
    );

    // CardHeader 만 patch 반영
    expect(header.props?.title).toBe("Patched Header");
    // override 없는 영역은 origin 그대로
    expect(content.props?.text).toBe("Origin Content");
    expect(footer.props?.text).toBe("Origin Footer");
  });

  it("region override 격리 — instance A 의 descendants 변경이 instance B 의 동일 영역에 무영향", () => {
    const card = cardOrigin("card-o");
    const descA: Record<string, DescendantOverride> = {
      cardheader_1: { title: "A Header" },
    };
    const descB: Record<string, DescendantOverride> = {};

    const headerA = resolveCanonicalDescendantOverride(
      regionOf(card, "cardheader_1"),
      descA,
      "cardheader_1",
    );
    const headerB = resolveCanonicalDescendantOverride(
      regionOf(card, "cardheader_1"),
      descB,
      "cardheader_1",
    );

    expect(headerA.props?.title).toBe("A Header");
    // B 는 override 없음 → origin
    expect(headerB.props?.title).toBe("Origin Header");
    // origin 원본 불변
    expect(regionOf(card, "cardheader_1").props?.title).toBe("Origin Header");
  });
});
