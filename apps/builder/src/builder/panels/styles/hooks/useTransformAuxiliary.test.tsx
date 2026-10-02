// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  fromElements,
  hookOf,
  openStylesFixture,
  type StylesFixture,
  cssOf,
} from "../__tests__/support/catalogStylesFixture";

let fixture: StylesFixture;
import { renderHook } from "@testing-library/react";
import {
  useHeightSizeMode,
  useWidthSizeMode,
  useParentDisplay,
  useParentFlexDirection,
} from "./useTransformAuxiliary";
import type { Element } from "../../../../types/core/store.types";

async function setTestElements(elements: Element[]): Promise<void> {
  fixture = await openStylesFixture(fromElements(elements));
}

/** Write a node's base style through the host (the panel's write path). */
function reseedWith(id: string, patch: { props: { style: Record<string, unknown> } }) {
  fixture.select(id);
  fixture.host.updateStyles(cssOf(patch.props.style));
}

/** Write a node's mobile layer and leave the session at mobile. */
function seedResponsiveOverride(
  styles: Record<string, Record<string, string>>,
  id = "el-1",
): void {
  fixture.select(id);
  fixture.setBreakpoint("mobile");
  fixture.host.updateStyles(
    Object.fromEntries(
      Object.entries(styles).map(([key, value]) => [key, value.mobile!]),
    ),
  );
}

describe("useTransformAuxiliary", () => {
  beforeEach(async () => {
    await setTestElements([
      {
        id: "el-1",
        type: "Button",
        parent_id: "p-1",
        props: {
          style: {
            width: "180px",
            height: "120px",
            alignSelf: "center",
            justifySelf: "center",
          },
        },
      } as Element,
      {
        id: "p-1",
        type: "Frame",
        props: { style: { display: "flex", flexDirection: "row" } },
      } as Element,
    ]);
  });

  it("useParentDisplay returns parent display", async () => {
    const { result } = hookOf(fixture, useParentDisplay, "el-1");
    expect(result.current).toBe("flex");
  });

  it("useParentFlexDirection returns parent flex-direction", async () => {
    const { result } = hookOf(fixture, useParentFlexDirection, "el-1");
    expect(result.current).toBe("row");
  });

  it("useParentDisplay returns 'block' when no parent", async () => {
    const { result } = hookOf(fixture, useParentDisplay, "p-1");
    expect(result.current).toBe("block");
  });

  it("useWidthSizeMode infers from style + parent context", async () => {
    const { result } = hookOf(fixture, useWidthSizeMode, "el-1");
    // 180px 명시 값 → "fixed"
    expect(result.current).toBe("fixed");
  });

  it("useWidthSizeMode reads the active breakpoint override", async () => {
    seedResponsiveOverride({ width: { mobile: "100%" } });

    const { result } = hookOf(fixture, useWidthSizeMode, "el-1");
    expect(result.current).toBe("fixed");
  });

  it("useHeightSizeMode reads the active breakpoint override", async () => {
    seedResponsiveOverride({ height: { mobile: "100%" } });

    const { result } = hookOf(fixture, useHeightSizeMode, "el-1");
    expect(result.current).toBe("fixed");
  });
});

// ADR-082 A1: 부모 Spec containerStyles fallback — inline display 미설정 시 Spec SSOT 조회.
// ListBoxSpec.containerStyles.display="flex" / flexDirection="column" 을 자식 Panel 이
// 소비해야 Fill/Hug 판정이 실제 container layout 과 일치함.
describe("useTransformAuxiliary — ADR-082 A1 부모 Spec fallback", () => {
  beforeEach(async () => {
    await setTestElements([
      {
        id: "item-1",
        type: "ListBoxItem",
        parent_id: "lb-1",
        props: { style: { alignSelf: "center", justifySelf: "center" } },
      } as Element,
      {
        id: "lb-1",
        type: "ListBox",
        // inline style 없음 — ListBoxSpec.containerStyles.display="flex" 가 유일 source
        props: {},
      } as Element,
    ]);
  });

  it("useParentDisplay reads ListBoxSpec.containerStyles.display='flex' when parent lacks inline", async () => {
    const { result } = hookOf(fixture, useParentDisplay, "item-1");
    expect(result.current).toBe("flex");
  });

  it("useParentFlexDirection reads ListBoxSpec.containerStyles.flexDirection='column' when parent lacks inline", async () => {
    const { result } = hookOf(fixture, useParentFlexDirection, "item-1");
    expect(result.current).toBe("column");
  });

  // ADR-248 4e-9 C 에서 발견 (it.fails 로 기록) → 4e-12 수리: 팔레트 ListBox 는 composite instance 라
  //   resolver 가 instance 의 authored layout 을 template 루트에 넘기지 않았다 (Frame 은 instance 아님).
  it("inline style.display overrides Spec containerStyles fallback (inline 우선)", async () => {
    reseedWith("lb-1", { props: { style: { display: "block" } } });
    const { result } = hookOf(fixture, useParentDisplay, "item-1");
    expect(result.current).toBe("block");
  });

  it("parent display and direction read the active breakpoint overrides", async () => {
    fixture.select("lb-1");
    fixture.host.updateStyles({ display: "block", flexDirection: "row" });
    seedResponsiveOverride(
      { display: { mobile: "flex" }, flexDirection: { mobile: "column" } },
      "lb-1",
    );

    const item = fixture.recordOf("item-1");
    const { result } = renderHook(
      () => ({
        display: useParentDisplay(item),
        direction: useParentFlexDirection(item),
      }),
      { wrapper: fixture.wrapper },
    );

    expect(result.current).toEqual({
      display: "flex",
      direction: "column",
    });
  });

  it("부모 tag 가 containerStyles 미보유 Spec 이면 기본값 'block'/'row' 반환", async () => {
    await setTestElements([
      {
        id: "child-x",
        type: "Button",
        parent_id: "modal-1",
        props: {},
      } as Element,
      {
        id: "modal-1",
        type: "Modal", // Modal 은 containerStyles 에 display · flexDirection 이 없다 (overlay)
        props: {},
      } as Element,
    ]);
    const { result: display } = hookOf(fixture, useParentDisplay, "child-x");
    expect(display.current).toBe("block");
    const { result: dir } = hookOf(fixture, useParentFlexDirection, "child-x");
    expect(dir.current).toBe("row");
  });

  it("Dialog 부모는 catalog 기본값 flex · column 을 읽는다 (2026-09-26 본문 스타일 catalog 이관)", async () => {
    await setTestElements([
      {
        id: "child-x",
        type: "Button",
        parent_id: "dlg-1",
        props: {},
      } as Element,
      {
        id: "dlg-1",
        type: "Dialog",
        props: {},
      } as Element,
    ]);
    const { result: display } = hookOf(fixture, useParentDisplay, "child-x");
    expect(display.current).toBe("flex");
    const { result: dir } = hookOf(fixture, useParentFlexDirection, "child-x");
    expect(dir.current).toBe("column");
  });
});

describe("useTransformAuxiliary — Transform Spec default inference", () => {
  it("keeps ListBox 100% as CSS percentage without inferring Fill", async () => {
    await setTestElements([
      {
        id: "listbox-1",
        type: "ListBox",
        props: {},
      } as Element,
    ]);

    const { result } = hookOf(fixture, useWidthSizeMode, "listbox-1");
    expect(result.current).toBe("fixed");
  });

  it("infers Avatar height Spec default as Fixed without an inline height", async () => {
    await setTestElements([
      {
        id: "avatar-1",
        type: "Avatar",
        props: { size: "md" },
      } as Element,
    ]);

    const { result } = hookOf(fixture, useHeightSizeMode, "avatar-1");
    expect(result.current).toBe("fixed");
  });
});
