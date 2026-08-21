import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Menu 선택 표시 회귀 테스트 (design-data 감사 §2-E "Menu selectionStyle", 2026-08-22).
 *
 * **막으려는 상태**: selection 배선(renderMenu → MenuButton → RAC Menu)은 멀쩡한데 시각
 * 채널이 없어 선택한 항목이 안 고른 항목과 **DOM 상 구별되지 않던** 상태. 이 저장소에서
 * 반복된 결함 축 그대로 — 정의는 있는데 그리는 곳이 없음.
 *
 * 확인하는 계약 3가지:
 *  1. 수동 Menu.css 가 존재하고, 표시가 `[data-selection-mode]` 로 **데이터 게이팅**된다
 *     (컴포넌트 이름 분기 금지 — ADR-142 §3).
 *  2. 선택 여부와 무관하게 열을 잡는 규칙이 따로 있다 (선택 시 라벨이 밀리지 않도록).
 *  3. 그 파일이 실제로 로드된다 — styles/index.css 와 Menu.tsx 양쪽 import.
 *     (2026-08-22 GridListItem.css 가 생성만 되고 어디서도 import 안 돼 통째로 죽어 있던
 *      선례가 있어, "파일을 썼다" 와 "적용된다" 를 따로 고정한다.)
 *
 * cascade computed 값은 jsdom 으로 못 재므로 규칙 존재만 계약으로 고정하고, 실제 표시는
 * live(빌더 Preview DOM)로 확증한다.
 */

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const menuCss = read("../styles/Menu.css").replace(/\s+/g, " ");
const indexCss = read("../styles/index.css");
const menuTsx = read("../Menu.tsx");

describe("Menu 선택 표시 — 데이터 게이팅 + 실제 로드", () => {
  it("selectionMode 별 글리프를 [data-selection-mode] 로 게이팅한다", () => {
    expect(menuCss).toMatch(
      /\.react-aria-MenuItem\[data-selection-mode="multiple"\]\[data-selected\]::before \{ content: "✓"/,
    );
    expect(menuCss).toMatch(
      /\.react-aria-MenuItem\[data-selection-mode="single"\]\[data-selected\]::before \{ content: "●"/,
    );
    // selectionMode:"none" 은 두 값 어디에도 안 걸린다 — 선택 미사용 메뉴의 배치 보존.
    expect(menuCss).not.toMatch(/data-selection-mode="none"/);
    // 글리프는 장식 — 대체 텍스트를 비워 RAC 의 aria 상태와 이중 발화하지 않게 한다.
    expect(menuCss).toMatch(/content: "✓" \/ ""/);
  });

  it("선택 전에도 열을 잡아 라벨이 밀리지 않는다", () => {
    // [data-selected] 없이 두 모드만으로 걸리는 빈 content 규칙이 별도로 존재해야 한다.
    expect(menuCss).toMatch(
      /\[data-selection-mode="single"\]::before, \.react-aria-MenuItem\[data-selection-mode="multiple"\]::before \{ content: ""/,
    );
  });

  it("독립 수치를 만들지 않는다 — 폭은 1em, 색은 accent 토큰", () => {
    expect(menuCss).toMatch(/width: 1em/);
    expect(menuCss).toMatch(/color: var\(--accent\)/);
    // px 상수를 새로 도입하면 catalog sizes 와 갈라진다.
    expect(menuCss).not.toMatch(/\d+px/);
  });

  it("styles/index.css 와 Menu.tsx 양쪽에서 로드된다", () => {
    expect(indexCss).toMatch(/@import "\.\/Menu\.css";/);
    expect(menuTsx).toMatch(/import "\.\/styles\/Menu\.css";/);
    // 생성 CSS 뒤에 와야 base 규칙을 보충한다(앞서면 순서상 의미 없음).
    expect(indexCss.indexOf('@import "./Menu.css";')).toBeGreaterThan(
      indexCss.indexOf('@import "./generated/MenuItem.css";'),
    );
  });
});
