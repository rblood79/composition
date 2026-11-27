import { describe, expect, it } from "vitest";
import {
  catalogBreadcrumbsCollapse,
  catalogBreadcrumbsVisibleCount,
} from "../breadcrumbsCollapse";

/**
 * ADR-326 Phase 0 P6 (breakdown §4.4 · review m5) — 경로 줄의 crumb 자리 넷 시제품 (판정 층).
 *
 * 기준 = 「crumb 을 전부 그린 Breadcrumbs」: 실제 `catalogBreadcrumbsVisibleCount` 에 모든 crumb 의 폭을 넣고
 * `catalogBreadcrumbsCollapse` 로 메뉴를 낸 것. 시제품 = 자리 넷 (넷 이하면 전부, 넘으면 첫 · 끝에서 둘째 · 끝)
 * 의 폭과 실제 crumb 수로 같은 판정을 내고, 메뉴는 판정 뒤 전체 경로에서 낸다.
 *
 * 전제 (폭이 자리 수와 무관): crumb 이 줄어들지 않는다 — S2 `breadcrumbStyles` `flexShrink: 0`
 * (`@react-spectrum/s2@1.8.2/src/Breadcrumbs.tsx:261`). 실제 rect 대조 (Canvas · Chrome) 는 live 몫이다.
 */

/** The slot crumbs' indices into the whole path (breakdown §4.4 `cascaderTrail`). */
const slotsOf = (length: number): number[] =>
  length <= 4
    ? Array.from({ length }, (_, i) => i)
    : [0, length - 2, length - 1];

/**
 * The visible count from the slot widths and the real crumb count — the input
 * `catalogBreadcrumbsVisibleCount` gains in Phase 3 (a size above the slots collapses even at four
 * or fewer slots). Prototype: forces the not-fitting branch through a fifth zero-width crumb
 * when the path is longer than the slots (`size > MAX_VISIBLE_ITEMS`), whose width the
 * trailing loop never reads (it reads the last two and caps at two).
 */
const slotVisibleCount = (
  slotWidths: readonly number[],
  size: number,
  listWidth: number,
  gap: number,
  folder: number,
) => {
  if (size <= slotWidths.length)
    return catalogBreadcrumbsVisibleCount(slotWidths, listWidth, gap, folder);
  // [first, (middle — never read), second-last, last]
  const [first, secondLast, last] = slotWidths as [number, number, number];
  return catalogBreadcrumbsVisibleCount(
    [first, 0, 0, secondLast, last],
    listWidth,
    gap,
    folder,
  );
};

const judge = (
  path: readonly string[],
  widths: readonly number[],
  listWidth: number,
  gap = 6,
  folder = 32,
) => {
  const visible = catalogBreadcrumbsVisibleCount(
    widths,
    listWidth,
    gap,
    folder,
  );
  const hidden = catalogBreadcrumbsCollapse(path, visible)?.hidden ?? [];
  return { visible, hidden, shown: shownOf(path, visible) };
};

/** The crumbs drawn: the first and the `visible` last when collapsed (S2), else all. */
const shownOf = (path: readonly string[], visible: number) =>
  visible < path.length && path.length > 2
    ? [path[0]!, ...path.slice(path.length - visible)]
    : [...path];

const judgeSlots = (
  path: readonly string[],
  widths: readonly number[],
  listWidth: number,
  gap = 6,
  folder = 32,
) => {
  const slots = slotsOf(path.length);
  const visible = slotVisibleCount(
    slots.map((i) => widths[i]!),
    path.length,
    listWidth,
    gap,
    folder,
  );
  // 폴더 메뉴 = 판정 뒤 전체 경로에서 (Round 2 m5).
  const hidden = catalogBreadcrumbsCollapse(path, visible)?.hidden ?? [];
  return { visible, hidden, shown: shownOf(path, visible) };
};

describe("ADR-326 P6 — crumb 자리 넷 = 전부 그린 Breadcrumbs 의 판정", () => {
  it("root > A > B > C > D > E — 끝 둘이 보이는 폭 · 하나만 보이는 폭", () => {
    const path = ["root", "A", "B", "C", "D", "E"];
    const widths = [40, 50, 50, 50, 50, 60];
    // 310: 첫 41 + 폴더 32 + gap 6 → 남은 231 에서 E 61 · gap · D 51 → 끝 둘.
    const wide = judge(path, widths, 310);
    expect(wide).toEqual({
      visible: 2,
      hidden: ["A", "B", "C"],
      shown: ["root", "D", "E"],
    });
    expect(judgeSlots(path, widths, 310)).toEqual(wide);
    // 180: 남은 101 에서 E 61 → 하나. 메뉴에 D 가 들어간다 (끝에서 둘째 자리는 숨는다).
    const narrow = judge(path, widths, 180);
    expect(narrow).toEqual({
      visible: 1,
      hidden: ["A", "B", "C", "D"],
      shown: ["root", "E"],
    });
    expect(judgeSlots(path, widths, 180)).toEqual(narrow);
    // 보이지도 메뉴에 있지도 않은 조상 0.
    for (const result of [wide, narrow])
      expect([
        result.shown[0],
        ...result.hidden,
        ...result.shown.slice(1),
      ]).toEqual(path);
  });

  it("깊이 2 · 4 · 6 × 폭 무작위 — 자리 넷의 판정 · 메뉴가 기준과 같다 (고정 seed)", () => {
    let seed = 0x326;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    let cases = 0;
    let collapsed = 0;
    for (let run = 0; run < 3000; run += 1) {
      const depth = [2, 3, 4, 5, 6, 7, 8][Math.floor(random() * 7)]!;
      const path = Array.from({ length: depth }, (_, i) => `c${i}`);
      const widths = path.map(() => 20 + Math.floor(random() * 120) + random());
      const listWidth = 60 + random() * 600;
      const gap = [4, 6, 9][Math.floor(random() * 3)]!;
      const base = judge(path, widths, listWidth, gap);
      expect(
        judgeSlots(path, widths, listWidth, gap),
        JSON.stringify({ widths, listWidth, gap }),
      ).toEqual(base);
      expect([base.shown[0], ...base.hidden, ...base.shown.slice(1)]).toEqual(
        path,
      );
      cases += 1;
      if (base.hidden.length) collapsed += 1;
    }
    expect(collapsed).toBeGreaterThan(cases / 4);
  });

  it("넷 이하인데 폭이 모자라면 — 자리 = 전부라 같은 입력", () => {
    const path = ["root", "A", "B", "C"];
    const widths = [60, 70, 70, 70];
    expect(judgeSlots(path, widths, 150)).toEqual(judge(path, widths, 150));
  });
});
