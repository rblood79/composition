/**
 * ADR-321 HC2 · G2 — the StepList's D1 exception is none: the assembly writes no role, no ARIA
 * attribute of its own and no key handler, and reads no private steplist hook. The only ARIA names in
 * the code are the two RAC props the breakdown §4 names — `aria-label` on RAC `Group` and
 * `aria-current` on RAC `Link`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = (path: string) => readFileSync(resolve(__dirname, path), "utf8");
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** (The package names in import paths and RAC's class names — `react-aria-Text` — are not attributes.) */
const attributes = (code: string) =>
  code.replace(/from "[^"]+"/g, "").replace(/react-aria-[A-Za-z]+/g, "");

const components = strip(here("../stepList.components.tsx"));
const dom = here("../delegatedDom.runtime.ts");
const start = dom.indexOf("  steplist: {");
const renderers = strip(dom.slice(start, dom.indexOf("  cardview: {", start)));
const rest = [
  "../stepList.ts",
  "../stepListState.ts",
  "../../rule/stepList.ts",
  "../../../interactions/concepts/stepList.ts",
].map((path) => strip(here(path)));

describe("ADR-321 — StepList 조립의 D1 (예외 0)", () => {
  it("the renderer block was found (vacuity guard)", () => {
    expect(start).toBeGreaterThan(0);
    expect(renderers).toContain("CatalogStepListGroup");
    expect(renderers).toContain("CatalogStep,");
  });

  it("ARIA 이름은 RAC prop 둘뿐 — Group 의 `aria-label` · Link 의 `aria-current`", () => {
    expect(
      [...new Set(attributes(components).match(/aria-[a-z]+/g) ?? [])].sort(),
    ).toEqual(["aria-current", "aria-label"]);
    // Each is a prop of the RAC part, not of the `ol` · `li` · `span`.
    expect(components).toMatch(/<Group[^>]*\baria-label=/);
    expect(components).toMatch(/<Link[^>]*\baria-current=/);
    for (const tag of ["ol", "li", "span"])
      expect(components).not.toMatch(
        new RegExp(`<${tag}\\b[^>]*\\b(aria-|role=)`),
      );
    for (const code of [renderers, ...rest])
      expect(attributes(code)).not.toMatch(/aria-/);
  });

  it("role 을 직접 적지 않는다 · 키 handler 가 없다 · setAttribute 가 없다", () => {
    for (const code of [components, renderers, ...rest]) {
      expect(code).not.toMatch(/\brole\s*[=:]/);
      expect(code).not.toMatch(/["']role["']/);
      expect(code).not.toMatch(/onKey(Down|Up|Press)|useKeyboard/);
      expect(code).not.toMatch(/setAttribute|tabIndex/);
    }
  });

  it("RAC 부품은 공개 경로에서 — private steplist hook 을 읽지 않는다", () => {
    const imports = components.match(/from "[^"]+"/g) ?? [];
    expect(imports.filter((line) => /react-aria/.test(line)).sort()).toEqual([
      'from "react-aria-components/Group"',
      'from "react-aria-components/Link"',
      'from "react-aria/VisuallyHidden"',
    ]);
    for (const code of [components, renderers, ...rest]) {
      expect(code).not.toMatch(/\/private\//);
      expect(code).not.toMatch(/useStepList/);
    }
  });
});
