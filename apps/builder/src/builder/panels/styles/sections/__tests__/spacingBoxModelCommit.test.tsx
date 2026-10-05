// @vitest-environment jsdom
/**
 * 2026-10-05 감사 — 박스 모델 입력은 값이 바뀐 때만 쓴다 (focus 후 blur 만으로 catalog 기본값이
 * 사용자 값으로 저장되던 결함). link 상태의 4변 commit 은 한 step 이다 (4 step 이던 결함).
 */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n";
import { openStylesFixture } from "../../__tests__/support/catalogStylesFixture";
import { setPaddingLinked } from "../../components/boxModelLink";
import { SpacingSection } from "../SpacingSection";

afterEach(() => {
  cleanup();
  setPaddingLinked(false);
});

async function open() {
  const fixture = await openStylesFixture(
    [{ id: "box", style: { paddingTop: "4px" } }],
    { select: "box" },
  );
  const Wrapper = fixture.wrapper;
  const view = render(
    <I18nProvider initialLocale="en-US">
      <Wrapper>
        <SpacingSection />
      </Wrapper>
    </I18nProvider>,
  );
  await act(() => Promise.resolve());
  return { fixture, view };
}

describe("Spacing box model commit", () => {
  it("focus then blur without a change writes nothing", async () => {
    const { fixture, view } = await open();
    const revision = fixture.graph.revision;
    for (const label of ["Padding Right", "Margin Top"]) {
      const input = view.getByLabelText(label);
      fireEvent.focus(input);
      fireEvent.blur(input);
    }
    expect(fixture.graph.revision).toBe(revision);
    expect(fixture.nodeOf("box").visual.paddingRight).toBeUndefined();
  });

  it("a linked padding commit writes the four sides in one step", async () => {
    const { fixture, view } = await open();
    act(() => setPaddingLinked(true));
    const revision = fixture.graph.revision;
    const input = view.getByLabelText("Padding Top");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "16" } });
    fireEvent.blur(input);
    expect(fixture.graph.revision).toBe(revision + 1);
    const visual = fixture.nodeOf("box").visual;
    for (const key of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const)
      expect(visual[key]).toEqual({ kind: "set", value: 16 });
  });
});
