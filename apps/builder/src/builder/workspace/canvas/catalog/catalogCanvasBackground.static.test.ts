// @vitest-environment node
/**
 * ADR-248 4e (user 2026-10-02: 「canvas 빈 영역 선택 시 해당 사항 없는 패널들 모두 닫기 — 기존에 있다」):
 * the old Canvas closed the selection-context panels on a press off every page
 * (`useCentralCanvasPointerHandlers` → `dismissCanvasSelectionPanels`; Data · Theme · Settings
 * stay). The catalog Canvas does the same when its pick finds nothing (no ⇧).
 * live: Navigator · Properties · Styles · Interactions closed, Data · Theme stayed.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "CatalogCanvas.tsx"),
  "utf-8",
);

describe("catalog Canvas background press", () => {
  it("closes the selection-context panels when the press picks nothing", () => {
    expect(source).toMatch(
      /const picked = picking\.click\([^)]*\);[\s\S]{0,300}if \(!picked && !additive\) dismissCanvasSelectionPanels\(\);/,
    );
  });
});
