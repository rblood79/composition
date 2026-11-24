import { render } from "@testing-library/react";
import { I18nProvider } from "react-aria-components";
import { expect, it } from "vitest";
import { CatalogLoadMoreSpinner } from "../../../../../../packages/shared/src/catalog/runtime/loadMoreSpinner.components";

/**
 * S2 체크리스트 부록 D.1 대조 (2026-11-24) — a load-more spinner as S2 draws it: a picker's · menu's S
 * with no wrapper, a list's · tree's · table's M in a centered wrapper; its name is S2 intl
 * `*.loadingMore` in the locale.
 */
it("menu: S, no wrapper, named in the locale (ko 「추가 로드 중…」)", () => {
  const view = render(
    <I18nProvider locale="ko-KR">
      <CatalogLoadMoreSpinner look="menu" />
    </I18nProvider>,
  );
  const circle = view.container.querySelector<HTMLElement>(
    '[role="progressbar"]',
  )!;
  expect(circle.getAttribute("aria-label")).toBe("추가 로드 중…");
  expect(circle.style.width).toMatch(/\b16\b/);
  expect(view.container.querySelector("[data-load-more]")).toBeNull();
  view.unmount();
});

it.each(["tree", "list", "table"] as const)(
  "%s: M in a centered wrapper",
  (look) => {
    const view = render(
      <I18nProvider locale="en-US">
        <CatalogLoadMoreSpinner look={look} />
      </I18nProvider>,
    );
    const wrapper = view.container.querySelector<HTMLElement>(
      `[data-load-more="${look}"]`,
    )!;
    expect(wrapper.style.justifyContent).toBe("center");
    const circle = wrapper.querySelector<HTMLElement>('[role="progressbar"]')!;
    expect(circle.getAttribute("aria-label")).toBe("Loading more…");
    expect(circle.style.width).toMatch(/\b32\b/);
    view.unmount();
  },
);
