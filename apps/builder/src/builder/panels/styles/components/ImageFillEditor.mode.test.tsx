// @vitest-environment jsdom
/**
 * 2026-11-09 — 이미지 채움 Mode seg 는 RAC ToggleButtonGroup (radiogroup · radio · 방향키). 옛 구현은 button 에
 * role · aria-checked 를 손으로 달았다.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImageFillItem } from "../../../../types/builder/fill.types";

vi.mock("../stylesHost", () => ({
  useStylesHost: () => ({ readSelectedId: () => "node-1" }),
  useStylesSelectedId: () => "node-1",
}));
vi.mock("../../../../lib/assets/useResolvedAssetUrl", () => ({
  useResolvedAssetUrl: (url: string) => url,
}));

import { ImageFillEditor } from "./ImageFillEditor";

afterEach(cleanup);

describe("ImageFillEditor — Mode radiogroup", () => {
  it("현재 mode 가 선택 radio · 고르면 onUpdateEnd({ mode }) · 방향키 이동", () => {
    const onUpdateEnd = vi.fn();
    const fill = {
      id: "f1",
      type: "image",
      url: "",
      mode: "fill",
      enabled: true,
      opacity: 1,
      blendMode: "normal",
    } as unknown as ImageFillItem;
    const { getByRole, getAllByRole } = render(
      <ImageFillEditor
        fill={fill}
        onUpdate={vi.fn()}
        onUpdateEnd={onUpdateEnd}
      />,
    );
    expect(getByRole("radiogroup").getAttribute("aria-label")).toBe(
      "Image sizing mode",
    );
    const radios = getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual([
      "Fill",
      "Fit",
      "Stretch",
    ]);
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    fireEvent.click(radios[1]);
    expect(onUpdateEnd).toHaveBeenCalledWith({ mode: "fit" });
    act(() => radios[0].focus());
    fireEvent.keyDown(radios[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(radios[1]);
  });
});
