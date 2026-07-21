import { describe, expect, it } from "vitest";

import {
  SLOT_ROLES,
  getSlotRole,
  isSlotEnabled,
  resolveSlotComposition,
} from "../slotRoles";

describe("getSlotRole", () => {
  it("metadata.slotRole 을 정본으로 읽는다", () => {
    expect(getSlotRole({ metadata: { slotRole: "label" } })).toBe("label");
  });

  it("metadata 미보유 파생 뷰(PreviewElement)는 props.slot fallback 으로 읽는다", () => {
    expect(getSlotRole({ props: { slot: "description" } })).toBe("description");
  });

  it("metadata.slotRole 이 props.slot 보다 우선한다", () => {
    expect(
      getSlotRole({ metadata: { slotRole: "icon" }, props: { slot: "label" } }),
    ).toBe("icon");
  });

  it("vocabulary 밖 값은 null (layout slot 'main' 등 직교 시스템 혼입 차단)", () => {
    expect(getSlotRole({ metadata: { slotRole: "main" } })).toBeNull();
    expect(getSlotRole({ props: { slot: "main" } })).toBeNull();
    expect(getSlotRole({ props: {} })).toBeNull();
    expect(getSlotRole(null)).toBeNull();
    expect(getSlotRole("label")).toBeNull();
  });

  it("vocabulary 는 ADR-147 가동 3종(icon/label/description)을 포함한다", () => {
    expect(SLOT_ROLES).toEqual(
      expect.arrayContaining(["icon", "label", "description"]),
    );
  });
});

describe("resolveSlotComposition", () => {
  const iconChild = {
    type: "Icon",
    props: { slot: "icon", iconName: "{icon}" },
    metadata: { slotRole: "icon", optional: true },
  };
  const labelChild = {
    type: "Text",
    props: { slot: "label", children: "{label}", style: { fontWeight: 700 } },
    metadata: { slotRole: "label" },
  };
  const descriptionChild = {
    type: "Text",
    props: { slot: "description", children: "{description}" },
    metadata: { slotRole: "description", optional: true },
  };

  it("slot 자식의 존재·순서·optional·style 을 추출한다", () => {
    const composition = resolveSlotComposition([
      iconChild,
      labelChild,
      descriptionChild,
    ]);

    expect(composition).not.toBeNull();
    expect(composition?.order).toEqual(["icon", "label", "description"]);
    expect(composition?.slots.icon).toMatchObject({
      role: "icon",
      optional: true,
    });
    expect(composition?.slots.label?.style).toEqual({ fontWeight: 700 });
    expect(composition?.slots.description?.optional).toBe(true);
  });

  it("slot 자식이 일부만 있으면 나머지 role 은 구성에서 빠진다 (존재 gating 원천)", () => {
    const composition = resolveSlotComposition([labelChild]);

    expect(composition?.order).toEqual(["label"]);
    expect(composition?.slots.description).toBeUndefined();
    expect(composition?.slots.icon).toBeUndefined();
  });

  it("slot 자식 순서가 스택 순서를 결정한다 (description 선행 케이스)", () => {
    const composition = resolveSlotComposition([descriptionChild, labelChild]);

    expect(composition?.order).toEqual(["description", "label"]);
  });

  it("비-slot 자식만 있으면 null (legacy 문서 BC 신호)", () => {
    expect(
      resolveSlotComposition([{ type: "Field", props: { key: "name" } }]),
    ).toBeNull();
    expect(resolveSlotComposition([])).toBeNull();
    expect(resolveSlotComposition(undefined)).toBeNull();
  });

  it("같은 role 중복 시 첫 자식이 이긴다", () => {
    const composition = resolveSlotComposition([
      labelChild,
      {
        type: "Text",
        props: { slot: "label", style: { color: "red" } },
        metadata: { slotRole: "label" },
      },
    ]);

    expect(composition?.order).toEqual(["label"]);
    expect(composition?.slots.label?.style).toEqual({ fontWeight: 700 });
  });

  // 2026-07-21 — Label/Text slot 자식은 텍스트 크기를 `props.size` 토큰으로 authoring 한다
  //   (raw style.fontSize 아님). resolveSlotComposition 이 catalog {type}.sizes[size].fontSize
  //   를 px 로 해소해 config.style.fontSize 로 접어넣지 않으면 consumer(Skia escape / DOM emit)
  //   가 `slots[role].style.fontSize` 만 읽어 origin label size 편집이 instance 행에 전파되지
  //   않는다 (사용자 보고: origin ListBoxItem/Default label size 변경 → home 인스턴스 미반영).
  it("Label/Text slot 자식의 props.size 를 catalog fontSize(px)로 해소해 style.fontSize 로 접어넣는다", () => {
    const composition = resolveSlotComposition([
      {
        type: "Text",
        props: { slot: "label", children: "{label}", size: "3xl" },
        metadata: { slotRole: "label" },
      },
    ]);

    // Text.sizes["3xl"].fontSize = {typography.text-3xl} = 30
    expect(composition?.slots.label?.style?.fontSize).toBe(30);
  });

  it("explicit style.fontSize 가 있으면 size 해소값이 덮어쓰지 않는다", () => {
    const composition = resolveSlotComposition([
      {
        type: "Text",
        props: { slot: "label", size: "3xl", style: { fontSize: 12 } },
        metadata: { slotRole: "label" },
      },
    ]);

    expect(composition?.slots.label?.style?.fontSize).toBe(12);
  });

  it("size 없는 slot 자식은 fontSize 를 주입하지 않는다 (BC)", () => {
    const composition = resolveSlotComposition([descriptionChild]);

    expect(composition?.slots.description?.style?.fontSize).toBeUndefined();
  });

  it("size 해소는 description slot 에도 동일 적용된다 (typography slot 일반)", () => {
    const composition = resolveSlotComposition([
      {
        type: "Text",
        props: { slot: "description", children: "{d}", size: "sm" },
        metadata: { slotRole: "description" },
      },
    ]);

    // Text.sizes["sm"].fontSize = {typography.text-sm} = 14
    expect(composition?.slots.description?.style?.fontSize).toBe(14);
  });
});

describe("isSlotEnabled", () => {
  it("구성이 null(legacy)이면 모든 slot 이 enabled (BC fallback)", () => {
    expect(isSlotEnabled(null, "description")).toBe(true);
    expect(isSlotEnabled(undefined, "icon")).toBe(true);
  });

  it("구성이 있으면 slot 자식 존재 여부가 gating 한다", () => {
    const composition = resolveSlotComposition([
      { props: { slot: "label" }, metadata: { slotRole: "label" } },
    ]);

    expect(isSlotEnabled(composition, "label")).toBe(true);
    expect(isSlotEnabled(composition, "description")).toBe(false);
    expect(isSlotEnabled(composition, "icon")).toBe(false);
  });
});
