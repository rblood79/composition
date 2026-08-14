# ADR-067 Phase 1 — `computeSyntheticStyle` Call Count (G1 a)

**Date**: 2026-04-15
**Branch**: `refactor/adr-059-b5-togglebutton-indicator-ssot` (HEAD `c36e2498`)
**Goal**: Transform 섹션 렌더 중 `computeSyntheticStyle` 호출 0회 검증.

## Method

1. `apps/builder/src/services/computedStyleService.ts:345` `computeSyntheticStyle` 함수 진입부에 임시 계측 추가:
   ```ts
   window.__csyCalls.push({ tag, time, stack });
   ```
2. `localStorage["styles-panel-collapse"]`로 Transform 섹션만 펼치고 Layout/Appearance/Typography/State 모두 접음
3. 페이지 reload → 5회 요소 선택 (Cancel/Save/Card 교대)
4. `window.__csyCalls` 배열 크기 측정

## Result

| Action                                | Count |
| ------------------------------------- | ----- |
| 페이지 로드 + 초기 selection          | 0     |
| 요소 선택 5회 (Cancel/Save/Card 교대) | 0     |
| **합계**                              | **0** |

`window.__csyCalls`는 reload 후 5회 클릭이 끝난 시점에도 **`undefined`** — `computeSyntheticStyle` 함수가 단 한 번도 호출되지 않음을 의미 (instrumentation은 첫 호출 시 array를 lazy 생성).

## 비교 (sanity check)

Layout/Appearance/Typography 섹션을 펼친 상태로 동일 측정 시 csy 호출 9회 (`Button` tag) 발생 — 이는 `syntheticComputedStyleAtom` 및 derived `*StyleAtom`들이 해당 섹션에서 `useAtomValue`로 구독되기 때문. Transform 섹션이 더 이상 이 atom들을 구독하지 않음을 확정.

## 판정

✅ **G1 (a) PASS** — Transform 섹션 렌더 중 `computeSyntheticStyle` 호출 0회.

## Cleanup

계측 코드는 측정 직후 `apps/builder/src/services/computedStyleService.ts`에서 제거 (커밋 안 함).

## 참조

- ADR-067: `docs/adr/067-style-panel-skia-native-read-path.md` §Gates G1
- Phase 1 breakdown: `docs/adr/design/067-style-panel-skia-native-read-path-breakdown.md` Task 7 Step 5
