import { writeFileSync } from "node:fs";
import { describe, it, vi } from "vitest";
import { generateCodeView } from "../../../../../../packages/shared/src/codeView/generate";
import { catalogCodeViewData } from "../../../builder/catalogRuntime/codeView";
import { HOME, openAdr296 } from "./support/adr296Harness";

/**
 * ADR-301 G4 (R4) — the generation time of a page dense with expanded instances (run with
 * `ADR301_BENCH=1`; `ADR301_OUT` writes the JSON): the unfavourable arm — 10 Menu (the deepest
 * family, 28 elements with its insides) + 10 Popover + 10 Dialog instances on one page. The number
 * is `generateCodeView`'s median of 9 after 3 warm runs (measurement-validity Q1 — a synthetic
 * size fixture; the same file runs in the base worktree for the before).
 */
const RUN = !!process.env.ADR301_BENCH;
const median = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

describe.runIf(RUN)("ADR-301 generation time (bench)", () => {
  it("10 Menu + 10 Popover + 10 Dialog on one page", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    for (const type of ["Menu", "Popover", "Dialog"])
      for (let index = 0; index < 10; index += 1) h.add(type);
    const input = {
      reader: h.graph() as never,
      pageId: HOME,
      ...catalogCodeViewData(h.graph()),
    };
    for (let index = 0; index < 3; index += 1) generateCodeView(input);
    const times: number[] = [];
    let lines = 0;
    for (let index = 0; index < 9; index += 1) {
      const start = performance.now();
      const result = generateCodeView(input);
      times.push(performance.now() - start);
      lines = result.code.split("\n").length;
    }
    const out = { medianMs: median(times), times, lines };
    if (process.env.ADR301_OUT)
      writeFileSync(process.env.ADR301_OUT, JSON.stringify(out, null, 2));
  }, 120_000);
});
