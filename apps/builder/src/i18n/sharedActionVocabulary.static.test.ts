/**
 * 같은 동작은 표면마다 같은 이름으로 부른다 (ADR-200 후속).
 *
 * **Why**: `Undo` 하나가 명령 팔레트·우클릭 메뉴·헤더에서는 "실행 취소", 저장 실패
 * 토스트의 버튼에서는 "되돌리기" 였다. 영어는 네 자리 모두 `Undo` 라 영어만 보면 드러나지
 * 않고, 한 화면 안에서 두 이름이 같이 보이지도 않아 오래 남아 있었다 (2026-08-31 발견).
 *
 * 그래서 판정 기준을 **영어 값**으로 둔다: 영어가 같은 문구면 한국어도 같아야 한다.
 * 같은 영어 단어가 서로 다른 개념을 가리키는 경우만 아래 두 목록으로 예외 처리한다.
 */
import { describe, expect, it } from "vitest";
import { localizedStrings } from "./translations";

/**
 * 같은 영어 단어가 **다른 개념**을 가리키는 자리 — 한국어가 달라야 맞다.
 * 새 항목을 넣기 전에 "정말 다른 개념인가" 를 먼저 확인한다.
 */
const HOMONYMS = new Set([
  "Navigation", // 팔레트 분류(탐색) ↔ nav 컴포넌트(내비게이션)
  "Plan", // AI 작업 계획 ↔ 요금제 preset 필드
  "Level", // 직급 preset 필드 ↔ 레벨 preset 필드
  "Visibility", // 공개범위 preset 필드 ↔ 반응형 표시 여부
  "Transform", // DataTable 값 변환 ↔ CSS transform
]);

/**
 * 같은 개념인데 표기가 갈린 자리 — **고쳐야 할 것**이지만 어느 쪽으로 통일할지는
 * 별도 판단이 필요해 남겨 둔다. 지금은 비어 있고, 비어 있는 채로 두는 것이 목표다.
 *
 * 2026-08-31 에 세 건을 비웠다: `Interactions`("이벤트"→"인터랙션"),
 * `History`("히스토리"→"작업 내역"), `Default`("기본값"→"기본" + 폰트 섹션 머리말은
 * 값이 아니라 분류라 영어까지 `Built-in` 으로 갈라냄).
 */
const KNOWN_DRIFT = new Set<string>([]);

describe("표면이 달라도 같은 동작은 같은 이름", () => {
  const en = localizedStrings["en-US"] as Record<string, unknown>;
  const ko = localizedStrings["ko-KR"] as Record<string, unknown>;

  /** 영어 문구 → (한국어 문구 → 그 문구를 쓰는 키들) */
  const byEnglish = new Map<string, Map<string, string[]>>();
  for (const key of Object.keys(en)) {
    const english = en[key];
    const korean = ko[key];
    // 보간 항목(함수)은 인자에 따라 값이 달라져 이 비교가 성립하지 않는다
    if (typeof english !== "string" || typeof korean !== "string") continue;
    if (!english.trim()) continue;
    if (!byEnglish.has(english)) byEnglish.set(english, new Map());
    const koreanVariants = byEnglish.get(english)!;
    if (!koreanVariants.has(korean)) koreanVariants.set(korean, []);
    koreanVariants.get(korean)!.push(key);
  }

  it("비교할 문구가 실제로 있다", () => {
    // 카탈로그 구조가 바뀌어 수집이 비면 아래 테스트가 조용히 통과한다
    expect(byEnglish.size).toBeGreaterThan(500);
  });

  it("Undo / Redo 는 모든 표면에서 한 이름이다", () => {
    for (const action of ["Undo", "Redo"]) {
      const variants = byEnglish.get(action);
      expect(variants, `en "${action}" 를 쓰는 키가 없다`).toBeDefined();
      expect(
        [...variants!.keys()],
        `"${action}" 의 한국어 표기가 갈렸다`,
      ).toHaveLength(1);
    }
  });

  it("영어가 같으면 한국어도 같다 (동음이의어 제외)", () => {
    const conflicts = [...byEnglish.entries()]
      .filter(([english, variants]) => variants.size > 1)
      .filter(([english]) => !HOMONYMS.has(english) && !KNOWN_DRIFT.has(english))
      .map(
        ([english, variants]) =>
          `"${english}" → ${[...variants.entries()]
            .map(([korean, keys]) => `"${korean}"(${keys.join(", ")})`)
            .join(" | ")}`,
      );
    expect(conflicts).toEqual([]);
  });

  it("예외 목록이 실제로 살아 있다", () => {
    // 해소됐는데 목록에 남으면 다음 드리프트를 가려 준다
    const stale = [...HOMONYMS, ...KNOWN_DRIFT].filter(
      (english) => (byEnglish.get(english)?.size ?? 0) <= 1,
    );
    expect(stale, "이 항목들은 더 이상 갈리지 않는다 — 목록에서 지운다").toEqual(
      [],
    );
  });
});
