// @vitest-environment jsdom
/**
 * 2026-10-05 감사 — object/array 변수의 기본값은 입력하는 동안 쓰지 않는다. blur 에서 JSON 이 맞을
 * 때만 저장하고, 틀리면 표시만 한다 (키마다 파싱 실패를 [] 로 저장해 입력이 지워지던 결함).
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { updateVariable } = vi.hoisted(() => ({
  updateVariable: vi.fn(async () => {}),
}));
vi.mock("../../../../stores/data", () => ({
  useDataStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ updateVariable }),
}));

import { DataVariablesHostContext } from "../../usage/dataVariablesHost";
import { VariableEditor } from "../VariableEditor";
import type { Variable } from "../../../../../types/builder/data.types";

const variable = {
  id: "v1",
  project_id: "p",
  name: "items",
  type: "array",
  scope: "global",
  defaultValue: [1],
} as unknown as Variable;

const host = {
  usePageContext: () => ({ currentPageId: null, ownerTitle: undefined }),
} as never;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("VariableEditor JSON default value", () => {
  it("typing an incomplete value writes nothing; a valid value commits on blur", () => {
    const { getByRole } = render(
      <DataVariablesHostContext.Provider value={host}>
        <VariableEditor variable={variable} onClose={() => {}} />
      </DataVariablesHostContext.Provider>,
    );
    const textarea = getByRole("textbox", { name: /Default Value/ }) as HTMLTextAreaElement;
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "[1," } });
    expect(updateVariable).not.toHaveBeenCalled();
    expect(textarea.value).toBe("[1,");
    fireEvent.blur(textarea);
    expect(updateVariable).not.toHaveBeenCalled();
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(textarea, { target: { value: "[1, 2]" } });
    fireEvent.blur(textarea);
    expect(updateVariable).toHaveBeenCalledTimes(1);
    expect(updateVariable).toHaveBeenCalledWith("v1", { defaultValue: [1, 2] });
  });
});
