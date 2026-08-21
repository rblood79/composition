/**
 * ADR-108 P2 G2 — TextField implicitStyles helper 소비 회귀 테스트.
 *
 * `applyImplicitStyles(TextField)` 가 `resolveContainerVariants` + `matchNestedSelector`
 * 를 통해 `spec.containerVariants["label-position"].side` 를 감지하고, 기존
 * `labelPosition` prop 직접 체크와 동등한 Canvas flex 시뮬레이션 결과를 산출함을
 * 확증한다.
 *
 * 회귀 시나리오:
 *   (a) labelPosition="top"       → flexDirection: "column", gap: 4 (variant 미매칭)
 *   (b) labelPosition="side"      → flex-row wrap + Label width/shrink/alignSelf 주입
 *   (c) user style 명시 override  → variant 주입값을 덮어쓰지 않음 (SSOT user 최우선)
 *   (d) labelPosition 미지정      → spec `defaultProps?.labelPosition = "top"` 적용 없음,
 *                                    helper 가 variant 매칭 실패 → column 경로
 */

import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

function makeTextField(
  props: Record<string, unknown>,
  children: Element[] = [],
): Element {
  return {
    id: "tf-1",
    type: "TextField",
    props: {
      label: "Name",
      ...props,
    },
    childrenIds: children.map((c) => c.id),
  } as Element;
}

function makeChild(
  id: string,
  type: string,
  style?: Record<string, unknown>,
): Element {
  return {
    id,
    type,
    props: { style: style ?? {} },
    childrenIds: [],
  } as Element;
}

function applyTF(
  props: Record<string, unknown>,
  children: Element[],
): ReturnType<typeof applyImplicitStyles> {
  const container = makeTextField(props, children);
  const byId = new Map<string, Element>([
    [container.id, container],
    ...children.map((c) => [c.id, c] as const),
  ]);
  return applyImplicitStyles(
    container,
    children,
    (id) =>
      (
        byId.get(id) as { childrenIds?: string[] } | undefined
      )?.childrenIds?.map((cid: string) => byId.get(cid)!) ?? [],
    byId,
  );
}

describe("TextField applyImplicitStyles — ADR-108 P2 helper 소비", () => {
  const label = makeChild("lbl", "Label");
  const input = makeChild("inp", "Input");
  const fieldError = makeChild("err", "FieldError");

  it("labelPosition='top' → column 기본 경로 (variant 미매칭)", () => {
    const { effectiveParent, filteredChildren } = applyTF(
      { labelPosition: "top" },
      [label, input, fieldError],
    );
    const ps = (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
    expect(ps.flexDirection).toBe("column");
    // catalog sizes.md.gap = 6 (generated CSS 동일 source — 2026-07-14 field gap 정렬)
    expect(ps.gap).toBe(6);
    // Label 에 side-label 전용 width (FORM_SIDE_LABEL_WIDTH) / alignSelf 주입 없음.
    //   flexShrink 는 다른 Canvas 공통 규칙이 주입할 수 있어 본 테스트 scope 외.
    const lblStyle = (filteredChildren.find((c) => c.type === "Label")?.props
      ?.style ?? {}) as Record<string, unknown>;
    expect(lblStyle.width).toBeUndefined();
    expect(lblStyle.alignSelf).toBeUndefined();
  });

  it("labelPosition='side' → flex-row + Label side-label 스타일 주입", () => {
    const { effectiveParent, filteredChildren } = applyTF(
      { labelPosition: "side" },
      [label, input, fieldError],
    );
    const ps = (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
    expect(ps.display).toBe("flex");
    expect(ps.flexDirection).toBe("row");
    expect(ps.flexWrap).toBe("wrap");
    expect(ps.alignItems).toBe("flex-start");

    const lblStyle = (filteredChildren.find((c) => c.type === "Label")?.props
      ?.style ?? {}) as Record<string, unknown>;
    expect(typeof lblStyle.width).toBe("number");
    expect(lblStyle.flexShrink).toBe(0);
    expect(lblStyle.alignSelf).toBe("flex-start");

    // FieldError 는 `:not(.react-aria-Label)` 매칭 → marginLeft + width 주입
    const errStyle = (filteredChildren.find((c) => c.type === "FieldError")
      ?.props?.style ?? {}) as Record<string, unknown>;
    expect(errStyle.width).toBe("100%");
    expect(typeof errStyle.marginLeft).toBe("number");
  });

  it("user style 명시 override 는 variant 주입값을 덮지 않는다", () => {
    const labelWithUserWidth = makeChild("lbl", "Label", { width: 200 });
    const { filteredChildren } = applyTF({ labelPosition: "side" }, [
      labelWithUserWidth,
      input,
      fieldError,
    ]);
    const lblStyle = (filteredChildren.find((c) => c.type === "Label")?.props
      ?.style ?? {}) as Record<string, unknown>;
    // user 가 명시한 width=200 은 side-label default 값보다 우선
    expect(lblStyle.width).toBe(200);
  });

  it("labelPosition 미지정 → variant 미매칭 → column 경로 (회귀 — helper 결과 empty)", () => {
    const { effectiveParent } = applyTF({}, [label, input]);
    const ps = (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
    expect(ps.flexDirection).toBe("column");
  });

  it("hasLabel=false (label prop 미설정) → Label child filter 제외", () => {
    const container: Element = {
      id: "tf-nolabel",
      type: "TextField",
      props: { labelPosition: "side" }, // label prop 부재
      childrenIds: [label.id, input.id],
    } as Element;
    const byId = new Map<string, Element>([
      [container.id, container],
      [label.id, label],
      [input.id, input],
    ]);
    const { filteredChildren } = applyImplicitStyles(
      container,
      [label, input],
      (id) =>
        (
          byId.get(id) as { childrenIds?: string[] } | undefined
        )?.childrenIds?.map((cid: string) => byId.get(cid)!) ?? [],
      byId,
    );
    expect(filteredChildren.find((c) => c.type === "Label")).toBeUndefined();
    expect(filteredChildren.find((c) => c.type === "Input")).toBeDefined();
  });
});

describe("TextField minWidth — Spectrum 1.5×height 식별성 하한 (2026-08-21)", () => {
  const label = makeChild("lbl2", "Label");
  const input = makeChild("inp2", "Input");

  it("md (기본) → catalog sizes.md.minWidth=45 주입", () => {
    const { effectiveParent } = applyTF({}, [label, input]);
    const ps = (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
    expect(ps.minWidth).toBe(45);
  });

  it("size 축 스케일 — xs=27 / xl=81", () => {
    const xs = applyTF({ size: "xs" }, [label, input]);
    const xl = applyTF({ size: "xl" }, [label, input]);
    expect(
      ((xs.effectiveParent.props?.style ?? {}) as Record<string, unknown>)
        .minWidth,
    ).toBe(27);
    expect(
      ((xl.effectiveParent.props?.style ?? {}) as Record<string, unknown>)
        .minWidth,
    ).toBe(81);
  });

  it("side-label variant 에서도 주입", () => {
    const { effectiveParent } = applyTF({ labelPosition: "side" }, [
      label,
      input,
    ]);
    const ps = (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
    expect(ps.minWidth).toBe(45);
  });

  it("사용자 명시 minWidth(0 포함) 우선 — 주입이 덮지 않음", () => {
    const container = makeTextField({ style: { minWidth: 0 } }, [label, input]);
    const byId = new Map<string, Element>([
      [container.id, container],
      [label.id, label],
      [input.id, input],
    ]);
    const { effectiveParent } = applyImplicitStyles(
      container,
      [label, input],
      () => [],
      byId,
    );
    const ps = (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
    expect(ps.minWidth).toBe(0);
  });

  it("TextArea 는 catalog minWidth 미정의 → 미주입", () => {
    const container: Element = {
      id: "ta-1",
      type: "TextArea",
      props: { label: "Memo" },
      childrenIds: [label.id, input.id],
    } as Element;
    const byId = new Map<string, Element>([
      [container.id, container],
      [label.id, label],
      [input.id, input],
    ]);
    const { effectiveParent } = applyImplicitStyles(
      container,
      [label, input],
      () => [],
      byId,
    );
    const ps = (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
    expect(ps.minWidth).toBeUndefined();
  });
});
