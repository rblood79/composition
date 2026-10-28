import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 변수 편집기의 클래스는 자기 CSS 또는 패널 공용 CSS 에 정의돼 있어야 한다.
 *
 * 2026-09-12 `f9838b34e` 가 API 편집기를 재작성하며 `ApiEndpointEditor.css` 의 `.basic-editor` ·
 * `.field-description` 을 지웠고, 이 편집기가 빌려 쓰던 두 클래스가 정의 0 이 되어 칸 간격 ·
 * 설명 글자 모양이 사라졌다. `Section` 밖이라 필드 모양도 없었다 (ADR-286 G4 live 에서 관찰, 2026-10-28 수리).
 */
const EDITORS = resolve(__dirname, "..");
const OWNERS = [
  resolve(EDITORS, "VariableEditor.css"),
  resolve(EDITORS, "../../../components/styles/panel-system.css"),
];

function classNames(tsx: string): string[] {
  const names = new Set<string>();
  for (const match of tsx.matchAll(/className="([^"]+)"/g))
    for (const name of match[1].split(/\s+/)) if (name) names.add(name);
  return [...names];
}

describe("VariableEditor classes", () => {
  it("every className has a rule in VariableEditor.css or panel-system.css", () => {
    const tsx = readFileSync(resolve(EDITORS, "VariableEditor.tsx"), "utf8");
    const css = OWNERS.map((path) =>
      readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""),
    ).join("\n");
    const names = classNames(tsx);
    expect(names.length).toBeGreaterThan(0);
    const undefinedNames = names.filter(
      (name) =>
        !new RegExp(`\\.${name.replace(/[-]/g, "\\-")}(?![\\w-])[^{]*\\{`).test(
          css,
        ),
    );
    expect(undefinedNames).toEqual([]);
  });

  it("renders its fields inside a Section (field styles apply under .section-content only)", () => {
    const tsx = readFileSync(resolve(EDITORS, "VariableEditor.tsx"), "utf8");
    expect(tsx).toMatch(/<Section\b/);
  });
});
