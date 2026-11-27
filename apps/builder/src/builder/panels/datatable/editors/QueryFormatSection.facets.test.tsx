import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryFormatSection } from "./QueryFormatSection";

/**
 * ADR-320 사용자 결정 9 — the 「Candidate values (facet)」 switch: a `body` format offers it and
 * writes `querySerialization.facets` (off = the key gone); a `suffix` · `none` format does not.
 */
const dt = ((key: string) => key) as never;

function open(querySerialization: Record<string, unknown> | undefined) {
  const save = vi.fn(async () => {});
  const view = render(
    <QueryFormatSection
      endpoint={{ id: "e", name: "e", querySerialization } as never}
      save={save}
      dt={dt}
    />,
  );
  // (PropertySwitch names its RAC Switch input by the label — the legend shows it once.)
  const facets = () =>
    view.container.querySelector<HTMLInputElement>(
      'input[aria-label="apiQueryFacets"]',
    ) ?? undefined;
  return { view, save, facets };
}

describe("ADR-320 사용자 결정 9 — the endpoint's candidate-values switch", () => {
  it("a body format: on writes `facets: true`, off takes the key away", () => {
    const off = open({ kind: "body", pageSize: 20 });
    act(() => void fireEvent.click(off.facets()!));
    expect(off.save).toHaveBeenLastCalledWith({
      querySerialization: { kind: "body", pageSize: 20, facets: true },
    });
    off.view.unmount();
    const on = open({ kind: "body", pageSize: 20, facets: true });
    act(() => void fireEvent.click(on.facets()!));
    expect(on.save).toHaveBeenLastCalledWith({
      querySerialization: { kind: "body", pageSize: 20 },
    });
    on.view.unmount();
  });

  it("a suffix · none format offers no switch", () => {
    for (const format of [{ kind: "suffix" }, undefined]) {
      const h = open(format);
      expect(h.facets()).toBeUndefined();
      h.view.unmount();
    }
  });
});
