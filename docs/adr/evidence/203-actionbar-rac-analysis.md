# ADR-203 — Action Bar와 RAC 잔여 React 비용

- 날짜: 2026-09-05. 일반 LayerTree content memo 반영 상태에서 분석했다.
- 범위: 분석만 수행했다. 제품 코드·registry·모델 산출 effect 변경 없음.
- 근거: [React 집계 JSON](203-phase1/actionbar-rac-profile.json).

## 측정

Chrome 152 headless/dev, 1440×900, 60요소, Navigator만 열림, Tree 90px/6개 가시 행, ID-only 100ms 간격 50회. React DevTools hook과 CDP CPU sampling을 사용했다. 이 run은 정식 G1 반복 측정이 아니다. props-only hydration을 포함해 store 알림 150회가 발생했다.

기존과 동일하게 positive root duration 및 fiber actualStartTime ≥ 직전 commit 시각을 적용해 stale fiber duration을 제외했다. subtree는 부모·자식 간 중복되므로 표의 모든 행을 합산하지 않는다. actualDuration은 React 렌더 시간이며 DOM commit/layout/paint 전체 시간이 아니다.

| 항목                | 누적 subtree |   self | 비고                          |
| ------------------- | -----------: | -----: | ----------------------------- |
| Root                |      292.7ms |      — | 선택당 약 5.85ms              |
| LayersSection       |      161.3ms |  3.0ms | 선택당 약 3.23ms              |
| RAC TreeInner       |      132.1ms | 11.5ms | LayersSection 하위            |
| NormalItemContent   |       45.0ms |  1.6ms | memo 아래 context 갱신은 유지 |
| ContextualActionBar |      117.0ms | 11.7ms | 100회, 선택당 약 2.34ms       |
| ActionButton        |       47.4ms |  4.9ms | Action Bar 하위               |
| ShortcutTooltip     |       42.5ms |  2.8ms | ActionButton 하위와 중복      |
| OptionsMenu         |       32.3ms |  9.4ms | 100회                         |

callback 간격 p95/max 20.8/21.8ms, RAF timestamp 최대 16.8ms였다. 이 단일 profile에서 초과가 없었다고 이전 반복 측정의 G1 실패를 닫지 않는다.

## 두 Action Bar 렌더 경로

ActionButton의 item prop 참조 변경을 기준으로 Action Bar가 실행된 commit을 분류했다.

| 분류             | commit 수 | Action Bar subtree 합계 |
| ---------------- | --------: | ----------------------: |
| item 변경 관측   |        49 |                  56.6ms |
| item 변경 미관측 |        51 |                  60.4ms |

이는 **props identity 관측 분류**다. item 변경 미관측을 모든 hook/context가 동일한 렌더라고 해석하지 않는다. 그래도 item 모델이 교체되지 않는 쪽에서도 비용이 발생한다는 증거다.

코드상 선택 store 구독으로 먼저 렌더하고, BuilderCanvas의 registry 갱신 이후 effect에서 `startTransition → buildActionBarItems → setModel`을 수행한다. 이 순서는 과거 컴포넌트 토글 라벨이 한 클릭 늦게 표시되는 문제를 피하기 위한 계약이다. effect 제거나 render 단계의 useMemo 이동은 이번 분석의 개선안이 아니다.

## 안정화 가능한 props 경계

`ContextualActionBar.tsx`의 OptionsMenu는 pinned와 onAction만 받는다. 이번 run에서 **onAction 변경 99회**, props 변경 미관측 1회였다. `onOption`의 useCallback dependency는 placement 객체 전체이며, `useActionBarPlacement.ts`는 return 객체와 togglePinned/resetPosition/hide 함수를 매 렌더마다 생성한다. 따라서 pinned가 바뀌지 않는 선택 전환에도 메뉴 subtree를 다시 실행하는 참조 경로가 존재한다.

ActionButton도 item 변경 미관측 151건, item 변경 94건이 관측됐다. 기본 memo로 같은 item을 받는 함수 body 재실행을 줄이는 실험이 가능하다. 단, RAC context·tooltip 내부 갱신까지 사라진다고 가정하지 않는다. 새 item의 run callback을 반드시 반영해야 하므로 id/label만 비교하는 custom comparator는 사용하면 안 된다.

## 다음 구현 후보와 검증 기준

1. **OptionsMenu부터**: placement의 세 액션 함수를 실제 dependency 기준으로 안정화하고, onOption도 그 함수에만 의존하도록 한다. OptionsMenu에는 기본 memo를 적용해 동일 pinned/onAction에서 재실행을 줄이는지 확인한다. 관측된 32.3ms 전체가 제거될 것이라고 약속하지 않는다.
2. **ActionButton 경계**: 같은 item의 재실행을 줄이되 새 item·run callback·label 변경은 즉시 반영한다. 별도 전후 실측으로 효과를 판단한다.
3. **필수 계약**: pin/unpin·reset·hide, page 전환, 삭제/Undo, component 토글 label, Escape 후 Canvas focus, 새 선택에 대한 action target을 검증한다. 모델 산출 effect와 registry 최신성 순서는 유지한다.

RAC TreeInner의 132.1ms는 별도로 남아 있다. 이번 표만으로 선택·focus·DnD context 구독 자체를 제거할 근거는 없다. Action Bar 경계 실험은 ADR-203의 LayerTree 제품 변경 범위를 넘어가므로 다음 구현 시 별도 범위로 명시한다.

이번 분석에서는 Action Bar 제품 코드를 수정하지 않았다. 문서 포맷·guard·diff 검사를 수행했으며, 제품 테스트는 재실행하지 않았다. 원본 profile은 임시 경로에 있고 집계 JSON에 SHA-256을 보존했다. G1과 ADR 상태는 유지한다.

## 후속 구현 — placement 액션과 OptionsMenu (2026-09-05)

사용자 후속 착수 지시로 Action Bar 범위의 세 파일을 변경했다. `useActionBarPlacement`의 togglePinned/resetPosition/hide를 useCallback으로 안정화했다. togglePinned는 pinned 변경 시 새 callback을 만들어 최신 상태를 사용한다. `onOption`은 placement 객체 전체 대신 세 함수에 의존하고, OptionsMenu는 React.memo 기본 비교를 사용한다. 모델 산출 effect·transition·registry 순서와 ActionButton은 변경하지 않았다.

같은 Chrome/headless/dev, 60요소, Navigator 90px/6행, ID-only 50회 조건의 전후 profile을 비교했다. [집계 JSON](203-phase1/options-memo.json)의 component 배열은 `[subtree ms, self ms, 관측 fiber 수]`다.

| 항목                           |        변경 전 |       변경 후 |
| ------------------------------ | -------------: | ------------: |
| OptionsMenu subtree            | 32.3ms / 100회 |   0.4ms / 1회 |
| OptionsMenu onAction 변경 관측 |           99회 |           0회 |
| Action Bar subtree             |        117.0ms |        81.3ms |
| Root React 누적                |        292.7ms |       241.5ms |
| callback p95 / max             |  20.8 / 21.8ms | 20.9 / 23.4ms |

불필요한 OptionsMenu 재실행과 React 비용은 줄었지만 단일 run의 callback 지연 개선은 입증되지 않았다. G1 통과나 GPU stall 해결로 해석하지 않는다. 다른 subtree의 run 간 변동이 있으므로 Root 감소 전체를 이 변경만의 효과로 확정하지 않는다.

인접 Action Bar 테스트 5 files/46 tests PASS. 신규 테스트는 page/offset 변화에서 함수 참조 유지, pinned 변경 후 최신 toggle, reset/hide 동작을 검증한다. 기존 page context·Escape/canvas focus·placement·모델 정책 테스트도 통과했다. Catalog/Spec/CSS/Skia/Preview 소비 경로와 제품 DOM 구조는 변경하지 않았다.

최종 검증: 별도 headed 격리 Builder에서 실제 OptionsMenu pin/unpin/reset/hide 및 메뉴 닫힘 후 Canvas focus 복귀 PASS. `codex:preflight` PASS, 시각 parity doctor3+matrix98=101 PASS, diff 검사 PASS. G1은 열림을 유지하며 commit/push는 하지 않았다.

## 후속 구현 — ActionButton 동일 item memo (2026-09-05)

사용자 후속 착수 지시로 ActionButton에 React.memo 기본 비교를 적용했다. 같은 item 참조일 때 부모 갱신에 따른 재실행을 줄이며 새 item은 id가 같아도 반영한다. id/label만 비교하는 comparator는 없다. registry effect, 모델 생성, RAC 버튼·tooltip 내부 context 구독은 유지한다.

OptionsMenu 최적화 후 결과를 대조군으로 같은 60요소/90px/6행/ID-only 50회/headless dev 조건에서 측정했다. [집계 JSON](203-phase1/actionbutton-memo.json)의 component 배열은 `[subtree ms, self ms, 관측 fiber 수]`다.

| 항목                              |       변경 전 |       변경 후 |
| --------------------------------- | ------------: | ------------: |
| ActionButton subtree / 관측 fiber |  44.5ms / 243 |  26.2ms / 124 |
| ShortcutTooltip subtree           |        39.5ms |        23.0ms |
| Action Bar subtree                |        81.3ms |        66.5ms |
| Root React 누적                   |       241.5ms |       236.7ms |
| callback p95 / max                | 20.9 / 23.4ms | 20.5 / 22.2ms |

ActionButton subtree 비용 감소는 관측됐지만 단일 run이고 Navigator subtree에도 변동이 있다. callback 지연 개선을 확정하거나 정식 G1 통과로 해석하지 않는다. 47개 Action Bar 테스트가 통과했으며, 추가 테스트는 같은 action id를 유지한 새 item에서 라벨과 run callback이 모두 교체되는 계약을 검증한다.

ActionButton 최종 검증: headed 격리 Builder에서 perf-seed-0 → perf-seed-2 선택 후 Duplicate를 눌러 새 Text의 내용이 `Seed 2`임을 확인했다. `codex:preflight` 및 시각 parity 101 PASS, diff 검사 PASS. commit/push 및 G1 승격은 수행하지 않았다.
