import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { resolveContainerStylesFallback } from "./implicitStyles";

const TARGETS = [
  "Card",
  "CardPreview",
  "CardHeader",
  "CardContent",
  "CardFooter",
  "Form",
  "FormField",
  "Heading",
  "Description",
];

describe("ADR-171 Phase 6 probe", () => {
  it("dumps catalog resolver output for Phase 6 targets", () => {
    const lines: string[] = [];
    for (const type of TARGETS) {
      const lower = resolveContainerStylesFallback(type.toLowerCase(), {});
      const pascal = resolveContainerStylesFallback(type, {});
      lines.push(
        `=== ${type} ===`,
        `  lower : ${JSON.stringify(lower)}`,
        `  pascal: ${JSON.stringify(pascal)}`,
      );
    }
    writeFileSync(
      "/private/tmp/claude-501/-Users-admin-work-composition/99ff8f13-75e8-46df-ac10-65ba4f4719c8/scratchpad/adr171-phase6-probe.txt",
      lines.join("\n"),
      "utf8",
    );
  });
});
