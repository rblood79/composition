import { describe, expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";

/**
 * ADR-248 4e-9: the Calendar origins' month grid draws the current month. The old seed computed
 * `dayOffset` / `totalDays` / `todayDate` from its creation date (the factory's `now`); a library
 * template holding them froze one month (live 2026-10: header "October", grid September · today 29).
 * Absent, the Canvas grid falls back to the current date — the header's month.
 */
describe("ADR-248 4e-9 Calendar month grid", () => {
  it("no origin template freezes month data on its CalendarGrid", async () => {
    const library = await buildCodeCatalogLibrary();
    const grids = [...library.templates.values()].filter(
      (template) => template.definitionId === "lib:definition:type-CalendarGrid",
    );
    expect(grids.length).toBeGreaterThanOrEqual(2);
    for (const grid of grids)
      for (const key of ["dayOffset", "totalDays", "todayDate"])
        expect(grid.props, `${grid.id}.${key}`).not.toHaveProperty(key);
  });
});
