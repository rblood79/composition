// @vitest-environment jsdom
/**
 * 2026-10-05 감사 — fill 이 없는 요소의 가상 fill 행에서 opacity 를 commit 하면 실제 fill 로
 * 승격된다 (미리보기만 하고 commit 분기가 없어 문서가 그대로 남던 결함). 행 opacity scrub 은
 * 2026-10-28 제거 — opacity 는 팝오버 (단색 = 피커 알파) 가 commit 한다.
 */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../components/FillDetailPopover", () => ({
  FillDetailPopover: ({
    onOpacityChangeEnd,
  }: {
    onOpacityChangeEnd: (opacity: number) => void;
  }) => <button onClick={() => onOpacityChangeEnd(0.5)}>commit 50%</button>,
}));

import { I18nProvider } from "@/i18n";
import { openStylesFixture } from "../../__tests__/support/catalogStylesFixture";
import { FillSection } from "../FillSection";

afterEach(cleanup);

describe("FillSection virtual fill opacity", () => {
  it("committing the opacity of the virtual row creates a fill with that opacity", async () => {
    const fixture = await openStylesFixture([{ id: "box" }], { select: "box" });
    expect(fixture.host.readFills()).toHaveLength(0);
    const Wrapper = fixture.wrapper;
    const view = render(
      <I18nProvider initialLocale="en-US">
        <Wrapper>
          <FillSection />
        </Wrapper>
      </I18nProvider>,
    );
    await act(async () => {
      fireEvent.click(view.getByLabelText("Edit fill"));
    });
    await act(async () => {
      fireEvent.click(await view.findByText("commit 50%"));
    });
    const fills = fixture.host.readFills();
    expect(fills).toHaveLength(1);
    expect(fills[0]).toMatchObject({ type: "color", opacity: 0.5 });
  });
});
