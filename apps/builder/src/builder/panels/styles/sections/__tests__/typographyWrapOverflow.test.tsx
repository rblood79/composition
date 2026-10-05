// @vitest-environment jsdom
/**
 * 2026-10-05 감사 — Text 탭 Wrap 프리셋은 Size 절의 overflow 를 지우지 않는다. Truncate 를 풀 때만
 * Truncate 가 넣은 overflow: hidden 을 같이 푼다.
 */
import "fake-indexeddb/auto";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { openStylesFixture } from "../../__tests__/support/catalogStylesFixture";
import { useSectionCollapse } from "../../hooks/useSectionCollapse";
import { TypographySection } from "../TypographySection";

beforeEach(() => {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  useSectionCollapse.setState({
    collapsedSections: new Set(),
    focusMode: false,
    activeFocusSection: null,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderSection(Wrapper: (props: { children: ReactNode }) => ReactNode) {
  render(
    <I18nProvider initialLocale="en-US">
      <Wrapper>
        <TypographySection />
      </Wrapper>
    </I18nProvider>,
  );
}

async function pickWrap(label: string) {
  within(screen.getByRole("group", { name: "Wrap" }))
    .getAllByRole("button")[0]!
    .click();
  const listbox = await screen.findByRole("listbox");
  const option = within(listbox).getByRole("option", { name: label });
  await act(async () => {
    option.click();
  });
}

describe("Typography Wrap preset and overflow", () => {
  it("Break Words keeps the overflow set in the Size section", async () => {
    const fixture = await openStylesFixture(
      [{ id: "t", type: "Text", style: { overflow: "hidden" } }],
      { select: "t" },
    );
    renderSection(fixture.wrapper);
    await pickWrap("Break Words");
    const style = fixture.styleOf("t");
    expect(style.overflowWrap).toBe("break-word");
    expect(style.overflow).toBe("hidden");
  });

  it("leaving Truncate clears the overflow Truncate set", async () => {
    const fixture = await openStylesFixture(
      [
        {
          id: "t",
          type: "Text",
          style: { whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" },
        },
      ],
      { select: "t" },
    );
    renderSection(fixture.wrapper);
    await pickWrap("Normal");
    const style = fixture.styleOf("t");
    expect(style.overflow).toBeUndefined();
    expect(style.textOverflow).toBeUndefined();
  });
});
