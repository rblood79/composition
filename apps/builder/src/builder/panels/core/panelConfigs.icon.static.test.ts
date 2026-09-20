import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("panelConfigs rail icon contract", () => {
  const source = readFileSync(resolve(__dirname, "panelConfigs.ts"), "utf8");

  it("uses the Component icon for the Components panel rail button", () => {
    const componentsConfig = source.slice(
      source.indexOf('id: "components"'),
      source.indexOf('id: "datatable"'),
    );

    // 정본 ACTION_ICONS.component (lucide Component) — 낱개 lucide import 금지 (actionIcons.static.test)
    expect(componentsConfig).toContain("icon: ACTION_ICONS.component");
    expect(componentsConfig).not.toContain("icon: Blocks");
  });
});
