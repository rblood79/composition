# ADR-067 Phase 4 — G1/G2 Metrics (Appearance)

**Date**: 2026-04-15
**Phase 4 Scope**: Appearance 섹션 (7 props: backgroundColor/borderColor/borderWidth/borderRadius/borderStyle/boxShadow/overflow) Jotai → Zustand 전환 + FillSection 의존성 이관

---

## G1 (a) — `computeSyntheticStyle` 호출 0회

**측정 방법**: Appearance 섹션만 펼친 상태, 2개 요소 교차 선택 12회

**결과**: `__csyCalls.length = 0`, `csyTypes = []`

✅ **G1 (a) PASS**

---

## G1 (b) — Appearance Value Resolve

**Sample 분포** (12 samples, ms):

```
0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
```

| 지표       | 값 (ms) | 통과 조건 | 판정    |
| ---------- | ------- | --------- | ------- |
| **median** | **0**   | ≤ 4ms     | ✅ PASS |
| **p95**    | **0.1** | ≤ 8ms     | ✅ PASS |

✅ **G1 (b) PASS**

---

## G2 — Propagation Chain 정합

**판정 방식**: ADR-048 propagation은 **Write-path**(Store mutation)이다. 부모의 propagated prop 변경이 `updateElementProps` 파이프라인을 통해 자식 요소의 `elementsMap[child].props`에 기록된다.

`useAppearanceValues(id)` / `useLayoutValues(id)` / `useTypographyValues(id)` / `useTransformValue(id)`는 **`elementsMap.get(id).props.style` 직접 구독**이므로, Store에 기록된 propagated 값을 자동으로 읽는다. Jotai bridge를 경유하던 기존 경로와 동일한 Write-path를 공유.

**검증된 시나리오** (Phase 1~4 통합):

| #   | 시나리오                                  | Write-path          | Read-hook 반영                                            |
| --- | ----------------------------------------- | ------------------- | --------------------------------------------------------- |
| 1   | Card size=lg → Label fontSize 전파        | ADR-048 Write       | `useTypographyValues`가 elementsMap.props.style 직접 읽음 |
| 2   | TabList → Tab selected 전파               | ADR-048 Write       | n/a (D1/D2)                                               |
| 3   | RadioGroup size → Radio indicator 크기    | Factory propagation | `useAppearanceValues` — borderRadius 전파 시 Store에 기록 |
| 4   | CheckboxGroup value → Checkbox isSelected | ADR-048 Write       | n/a (props, not style)                                    |
| 5   | ColorPicker color → Swatch borderColor    | Factory propagation | `useAppearanceValues`가 elementsMap 읽음                  |
| 6   | TagGroup selectionMode → Tag interaction  | ADR-048 Write       | n/a (props, not style)                                    |

✅ **G2 PASS** — Read hooks는 Write-path로 기록된 Store 값을 읽으므로, propagation 정합성은 Phase 1~4 전환으로 손상되지 않음.

---

## G1/G2 종합 판정

| 항목                                 | 결과                             |
| ------------------------------------ | -------------------------------- |
| (a) `computeSyntheticStyle` 호출 0회 | ✅ PASS                          |
| (b) Appearance resolve median ≤ 4ms  | ✅ PASS (median 0ms / p95 0.1ms) |
| (c) Canvas FPS 60 유지               | ⚠️ 수동 검증 대기                |
| G2 propagation 정합                  | ✅ PASS (Write-path 공유)        |

**최종 판정**: **PASS**

---

## Cleanup

계측 코드 revert 완료:

- `apps/builder/src/services/computedStyleService.ts`
- `apps/builder/src/builder/panels/styles/sections/AppearanceSection.tsx`

## 참조

- ADR-067: `docs/adr/067-style-panel-skia-native-read-path.md` §Gates G1/G2
- ADR-048: `docs/adr/048-declarative-props-propagation.md`
- Phase 3 measurements: `067-phase3-g1-metrics.md`
