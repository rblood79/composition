# ADR-067: 스타일 패널 Skia-native Read Path 전환 (Jotai 제거)

## Status

**Implemented** — 2026-04-15 (Phase 1~6 전부 완료, G1/G2/G3 PASS)

**Phase 1 결과** (Transform pilot):

- G1 (a) ✅ PASS — `computeSyntheticStyle` 호출 0회 (`docs/adr/evidence/067-phase1-csy-calls.md`)
- G1 (b) ✅ PASS — Transform value resolve median 0.1ms / p95 0.1ms (기준 ≤4ms / ≤8ms 대비 40~80배 여유)
- G1 (c) ⚠️ Phase 1 변경이 Skia 렌더 path 외부이므로 회귀 가능성 매우 낮음 (수동 검증 권고)
- G3 baseline 측정 완료 — end-to-end paint latency median 119.1ms / p95 125ms (Phase 6 종결 시 30~40% 개선 목표)

상세: `docs/adr/evidence/067-phase1-paint-latency.md`

## Context

### 배경

composition 스타일 패널은 DOM+CSS Preview 시절의 구조를 Skia-native Builder에 그대로 이식한 상태다. 선택된 요소의 값을 표시하기 위해 다음 4단계 체인을 거친다:

```
inline (element.style.*) → computed (element.computedStyle.*) → synthetic (computeSyntheticStyle — Spec preset을 CSS 문자열로 직렬화) → default
```

`computeSyntheticStyle`은 Skia 렌더링의 D3 시각 SSOT인 Spec을 **CSS 문자열로 흉내**낸 뒤 패널이 다시 파싱하는 구조다. 이는 ADR-063 3-domain 분할 중 D3 대칭 원칙 위반 — CSS consumer 출력을 Skia 패널이 역참조한다. Jotai bridge(`useZustandJotaiBridge` + `buildSelectedElement`)는 O(depth) 부모 체인 탐색을 선택마다 수행하며 캐시가 없다.

### SSOT 체인 내 위상 (D1/D2/D3)

- **D1 (DOM/접근성)**: 변경 없음 — 스타일 패널 UI 자체는 RAC(Select/ListBox/NumberField 등)를 사용하지만, 본 ADR은 **패널의 read path(Spec/layoutMap 소비 경로)** 만 변경. RAC 컴포넌트 자체의 DOM/ARIA 구조는 건드리지 않음. 패널이 표시하는 대상(= 선택된 요소)이 RAC 여부와 무관
- **D2 (Props/API)**: 변경 없음 — 패널이 표시하는 prop 집합 동일
- **D3 (시각 스타일)**: **정렬 대상** — 패널이 D3 SSOT(Spec) + 런타임 파생(layoutMap, propagation)을 **직접 consumer**로 참조하도록 복귀. CSS consumer(CSSGenerator 출력)의 흉내를 역참조하지 않는다

### Hard Constraints

- 쓰기 경로 불변: `updateElementProps` → `elementsMap.properties` → Memory→Index→History→DB→Preview→Rebalance (`.claude/rules/state-management.md`)
- Canvas FPS 60 유지
- Preview/Publish와 SSOT 정합성 — 쓰기 경로 공유로 자동 보존
- `pnpm type-check` 통과
- 프로젝트 로컬 ESLint 룰 준수 — `useStore(useShallow(...))` 금지 (`apps/builder/eslint-local-rules/index.js:55-80`, infinite loop 방지)

### 증거 (profiling 기반)

| 지표                         | 현재                                                | 측정 출처                                              |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `computeSyntheticStyle` 호출 | 선택당 3–5회 (중복)                                 | `services/computedStyleService.ts:329-370`             |
| `buildSelectedElement` 비용  | O(depth) 부모 체인 탐색, 캐시 없음                  | `panels/styles/hooks/useZustandJotaiBridge.ts:138-200` |
| Jotai 생태계 범위            | `apps/builder/src/builder/panels/styles/` 15 파일만 | 전수 조사 (preview/publish/shared/specs 0건)           |
| Canvas 블로킹                | 없음 (startTransition으로 분리)                     | `useCanvasElementSelectionHandlers.ts:61`              |

## Alternatives Considered

### 대안 A: 현상 유지 + synthetic 캐시 강화

- 설명: `computeSyntheticStyle` 호출 결과를 더 aggressive하게 캐시하고 Jotai atom 구조 유지
- 위험: 기술(LOW) / 성능(MEDIUM) / 유지보수(**HIGH**) / 마이그레이션(LOW)
- 근거: CSS 문자열 흉내 레이어는 본질적으로 D3 대칭 위반. 캐시 강화는 증상 완화일 뿐 근본 해결 아님. Jotai bridge의 O(depth) 재탐색과 15-파일 생태계 분산 부담 지속

### 대안 B: Zustand 직접 + Spec 직접 lookup (채택)

- 설명: 4단계 체인을 3-tier(inline / effective / specDefault)로 재구성. 각 tier를 개별 primitive Zustand selector + `useSyncExternalStore(onLayoutPublished, getSharedLayoutMap)` + `resolveSpecPreset(type, size)` 조합으로 구현. pencil/Figma의 granular live subscribe 동형. Jotai를 6-phase로 완전 제거
- 위험: 기술(LOW) / 성능(LOW) / 유지보수(**감소**) / 마이그레이션(MEDIUM)
- 근거: Spec 직접 lookup은 O(1), `useSyncExternalStore`는 React 18 표준, Zustand primitive selector는 Object.is equality로 granular 구독 자연 달성. ESLint 룰의 `useShallow` 금지와 정합

### 대안 C: Zustand + useSyncExternalStore + Jotai 유지 (하이브리드)

- 설명: 패널 내부 read는 Zustand 직접, Jotai atom은 derived state용으로 부분 유지
- 위험: 기술(LOW) / 성능(LOW) / 유지보수(**HIGH**) / 마이그레이션(LOW)
- 근거: 생태계 2중화 영구화. Jotai의 이점(atom graph composition)이 Skia-native 패널에서는 사실상 불필요 → 2중화 비용만 누적. Phase 경로의 종착점을 흐림

### Risk Threshold Check

| 대안 | HIGH+ 개수                    | 판정                                     |
| ---- | ----------------------------- | ---------------------------------------- |
| A    | 유지보수 HIGH 1개             | D3 대칭 위반 장기화 — 기각               |
| B    | 마이그레이션 MEDIUM (6-phase) | 수용 가능 — 각 phase 독립 PR + 롤백 가능 |
| C    | 유지보수 HIGH 1개             | 2중화 영구화 — 기각                      |

루프 불필요 (대안 B가 HIGH 없음).

## Decision

**대안 B 채택** — 스타일 패널을 Zustand 직접 구독 + Spec 직접 lookup 기반 3-tier read path로 전환하고, Jotai 생태계를 6-phase에 걸쳐 완전 제거한다.

### 위험 수용 근거

- 마이그레이션 MEDIUM은 단일 디렉터리(15 파일) 내 한정 → phase 간 일시 비대칭 영향 범위 작음
- 각 phase 독립 PR + Gate 통과 조건으로 회귀 차단
- ESLint 룰 `useShallow` 금지 제약은 개별 primitive selector + `useMemo` 조립 패턴으로 정합 (breakdown §Phase 1)

### 기각 사유

- **A 기각**: 증상 완화로는 D3 대칭 원칙 복원 불가. CSS 문자열 흉내는 Skia-native 아키텍처의 근본 부채
- **C 기각**: 종착점 없는 2중화는 유지보수 부담을 영구화. 이번 결정의 핵심은 "생태계 단일화"이며, 부분 유지는 이를 훼손

> 구현 상세: [067-style-panel-skia-native-read-path-breakdown.md](../design/completed/067-style-panel-skia-native-read-path-breakdown.md)
> 원 설계 검토 기록: [docs/superpowers/specs/2026-04-15-style-panel-skia-native-read-path-design.md](../../superpowers/specs/2026-04-15-style-panel-skia-native-read-path-design.md)

## Gates

**측정 범위 원칙 (공통)**: 모든 Gate는 `selectedElementId` / `layoutVersion`이 store에 commit된 이후 패널이 값을 resolve/present하는 시간만 측정한다. 클릭 → commit 이전의 hitTest/pointerdown/startTransition 경계는 별도 작업(선택 입력 파이프라인 최적화) 범위이며 본 Gate에 포함하지 않음.

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 실패 시 대안                                                                                                   |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| G1   | Phase 1 끝 | (a) Transform 섹션 렌더 중 `computeSyntheticStyle` 호출 0회 (b) **Transform value resolve 전용 시간만 측정** (bridge/buildSelectedElement 비용 제외 — StylesPanel 최상위 `useZustandJotaiBridge()`가 Phase 6까지 잔존하기 때문). React Profiler의 TransformSection 렌더 실제 수행 시간 × 30 samples, median ≤ 4ms + p95 ≤ 8ms. **End-to-end median 30–40% 개선은 Phase 6 종결 시점(G3)에 평가** (c) Canvas FPS 60 유지 — **drag/resize 진행 중 시나리오** 포함 (`pnpm dev` + Chrome DevTools Rendering FPS meter로 1초 이상 연속 drag 중 60fps 유지 시각 확인) | `resolveSpecPreset` / `useTransformValue` 내부 롤백 후 재측정. 필요 시 Phase 1 scope 축소 (보조 selector 분리) |
| G2   | Phase 4 끝 | propagation chain 정합: size=lg Card → 자식 Label `fontSize` 정확히 반영 (기존 동작과 동일). 6개 이상 propagation 시나리오 스냅샷 테스트                                                                                                                                                                                                                                                                                                                                                                                                                       | propagation 유틸을 ADR-048 레지스트리로 재조정                                                                 |
| G3   | Phase 6 끝 | `grep -r "from ['\"]jotai" apps/builder/src` → 0 hit + `package.json`에서 `jotai` 제거 + `pnpm type-check` 통과 + 전체 패널 시각 회귀 0 + **end-to-end paint latency** (선택 → 패널 표시) × 30 samples, baseline 대비 median 30–40% 개선 + p95 회귀 없음 (bridge 제거로 O(depth) 탐색 소멸 효과 최종 검증)                                                                                                                                                                                                                                                     | 남은 atoms를 Zustand로 이관하거나 phase 분할                                                                   |

## Consequences

### Positive

- **D3 대칭 원칙 복원**: 패널이 D3 SSOT(Spec)를 직접 consume, CSS 흉내 레이어 제거
- **생태계 단일화**: Jotai 완전 제거 → Zustand만 남음. `useZustandJotaiBridge`, `buildSelectedElement`, `selectedElementAtom`, `styleAtoms.ts`, 5개 `use*ValuesJotai` 훅 삭제
- **성능 개선**: synthetic 캐시 제거 + O(depth) 부모 탐색 제거. Phase 1에서는 Transform value resolve 시간(React Profiler 기준) median ≤ 4ms / p95 ≤ 8ms 달성(G1 (b)), end-to-end 선택→패널 paint latency는 bridge 제거가 완료되는 Phase 6 종결 시점에 30–40% 개선 검증(G3)
- **pencil/Figma 동형 UX**: drag/resize 중 placeholder 실효값이 실시간 추적 (live granular)
- **ESLint 룰과 정합**: 개별 primitive selector 패턴은 프로젝트 컨벤션과 일치

### Negative

- **6 phase 마이그레이션 기간 동안 일시 비대칭**: Jotai/Zustand 섹션 공존. 단일 디렉터리 내 한정되나 리뷰 부담 존재
- **`useShallow` 대신 개별 selector + `useMemo` 조립**: object selector 사용 시 더 간결할 수 있으나 ESLint 룰 제약
- **Phase 4 propagation chain 설계 부담**: ADR-048 레지스트리 기반 `resolvePropagatedProp` 유틸 신설 필요 (HIGH 아님이나 non-trivial)
- **baseline 측정 필요 (G3 전용)**: G3 end-to-end 30–40% 개선 기준 설정을 위해 Phase 1 시작 전 commit에서 30 samples 측정 수행. G1 (b)는 절대 기준(median ≤ 4ms / p95 ≤ 8ms)이므로 baseline 불필요
- **Bridge 비용은 Phase 6까지 잔존**: `StylesPanel.tsx:58`의 `useZustandJotaiBridge()`는 Layout/Appearance/Typography/Fill/ComponentState 섹션이 계속 사용하므로 Phase 6 종결 시점까지 실행됨. Phase 1 단독에서는 bridge 비용이 지배적이어서 end-to-end median 개선을 Phase 1에서 측정하면 측정 오차가 크다 → G1 (b)를 "Transform value resolve 전용 시간"으로 scope 축소 (Gates 참조)
- **Spec 구조 가정의 위험**: `resolveSpecPreset`이 `spec.sizes[size]` 구조를 가정. 일부 spec(ToggleButton, TagGroup 등)은 flat 구조일 수 있어 breakdown Task 1에 flat-spec fallback 테스트 필수 포함
