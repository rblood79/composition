/**
 * ADR-198 — live 에서 **발견됐지만 아직 고치지 않은** 프로덕션 결함 (test-only)
 *
 * Phase 2 의 Skia 백색 처리와 같은 취급이다: 숨기지도, fixture 를 유리하게 바꾸지도
 * 않고 **현재 값을 못박는다** (measurement-validity §1 Q2). `count` 를 정확히 맞춰야
 * 통과하므로 결함이 고쳐지면 테스트가 깨지고, 그때 여기서 지우는 것이 올바른 대응이다.
 * 늘어나도 깨진다.
 *
 * 한 곳에 모아 둔 이유: 같은 결함이 두 게이트(Phase 1 identity, Phase 3 G2)에 동시에
 * 걸리는데, 각 테스트가 자기 목록을 들면 한쪽만 지워져 조용히 갈린다.
 *
 * `LegResult.consoleErrors` 자체는 **거르지 않는다** — leg 산출물은 사실 그대로 남고,
 * 무엇을 알면서 넘어가는지는 판정하는 쪽이 명시한다.
 */

export interface KnownDefect {
  pattern: RegExp;
  count: number;
  note: string;
}

export const KNOWN_PREVIEW_DEFECTS: Record<string, KnownDefect[]> = {
  "text-raster-resources": [
    {
      pattern: /tag <%s> is unrecognized[\s\S]*paragraph/,
      count: 1,
      note:
        "Preview 가 catalog `Paragraph` 를 `<p>` 가 아니라 `<paragraph>` 로 낸다. " +
        "`preview/App.tsx:971` 의 `resolveHtmlTag` default 가 spec registry 미등록 타입을 " +
        "`getElementForTag` → `type.toLowerCase()` 로 떨구는데 " +
        "(`packages/specs/src/runtime/tagToElement.ts:227`), ADR-142 catalog cutover 로 " +
        "Paragraph.spec 이 사라져 registry 에 없다. 같은 결함을 먼저 맞은 `Text` 는 " +
        "명시 case 를 받았지만(App.tsx:894) Paragraph 는 못 받았다. 바인딩이 요구하는 " +
        "태그는 `<p>` (`packages/shared/src/catalog/bindings/Paragraph.binding.ts:4,13`). " +
        "프로덕션 수정은 Phase 3(test-only) scope 밖 — 별도 작업.",
    },
  ],
};

/** 알려진 결함으로 설명되지 **않는** 에러만 남긴다. 이것이 0 이어야 게이트 통과. */
export function unexplainedErrors(
  caseId: string,
  errors: readonly string[],
): string[] {
  const known = KNOWN_PREVIEW_DEFECTS[caseId] ?? [];
  return errors.filter((e) => !known.some((k) => k.pattern.test(e)));
}

/** 알려진 결함별 실제 발생 횟수 — ratchet 이 정확히 일치해야 한다. */
export function knownDefectHits(
  caseId: string,
  errors: readonly string[],
): { defect: KnownDefect; hits: number }[] {
  return (KNOWN_PREVIEW_DEFECTS[caseId] ?? []).map((defect) => ({
    defect,
    hits: errors.filter((e) => defect.pattern.test(e)).length,
  }));
}
