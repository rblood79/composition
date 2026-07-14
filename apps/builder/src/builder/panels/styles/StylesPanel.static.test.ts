import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("StylesPanel canonical selected data contract", () => {
  it("uses selected element data instead of direct element-map reads for panel type/style", async () => {
    const source = await readFile(
      resolve(__dirname, "StylesPanel.tsx"),
      "utf-8",
    );

    expect(source).toContain(
      "const selectedElement = useDebouncedSelectedElementData();",
    );
    expect(source).toContain("selectedElement?.style");
    // 계약의 핵심은 "panel 이 element map 을 직접 읽지 않는다" 다. 과거엔
    // `const type = selectedElement?.type ?? null;` 도 함께 검사했으나, 현재 패널은
    // element type 을 아예 쓰지 않는다 (store 접근은 selectedElementId 존재 여부뿐) —
    // 사라진 구현 세부에 앵커하지 않고 element-map 직접 조회 금지만 가드한다.
    expect(source).not.toContain("s.elementsMap.get(id)");
    expect(source).not.toContain("s.elementsMap");
  });
});
