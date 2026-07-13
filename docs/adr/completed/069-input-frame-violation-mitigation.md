# ADR-069: 입력·프레임 Violation 완화 — same-turn store write 병합 + 프레임 플랜 부분 캐시

## Status

Implemented — 2026-04-17 (Phase 1 + Phase 2-0 관찰성 2.0 + Phase 2-B Step 1 + production 측정 기반 Gate G2' 재정의 종결)

## Context

Builder Canvas 상호작용 중 Chrome DevTools에서 반복적으로 관찰되는 Violation 두 종류가 사용자 체감 응답성(INP)을 저해하고 있다.

```
[Violation] 'pointerdown' handler took 150~170ms
[Violation] 'requestAnimationFrame' handler took 88ms   // SkiaCanvas.tsx:370
```

**증상 재현 경로**: 다른 페이지의 요소 클릭, workflow overlay ON 상태에서의 클릭, body 빈 영역 클릭.

### SSOT 3-domain 분할과의 관계

본 ADR은 [`.claude/rules/ssot-hierarchy.md`](../../../.claude/rules/ssot-hierarchy.md) 3-domain(D1 DOM/접근성 / D2 Props / D3 시각 스타일) **경계 밖의 runtime 성능 최적화** 영역에 속한다. Spec/RAC/RSP의 권위 구조에는 개입하지 않으며, Builder 내부의 input→state→frame 파이프라인 비용만 다룬다.

### 근본 원인 (재분석 완료)

1. **`useCentralCanvasPointerHandlers.ts`** 한 턴에 수행되는 동기 작업:
   - `getBoundingClientRect()` (layout flush)
   - `computeSelectionBoundsForHitTest()` 2회 호출 (최초 + pending drag용 fresh bounds)
   - WASM `hitTestPoint` + elementsMap lookup
   - `handleElementClickRef.current()` 내부에서 **같은 턴에 최대 3회 store `set()`**:
     1. `clearSelection()` — `startTransition` 밖
     2. `setCurrentPageId()` — `startTransition` 밖 → `rendererInput` 재빌드 트리거
     3. `setSelectedElement()` — `startTransition` 안
2. **Zustand는 `startTransition`과 무관하게 즉시 notify**한다. `useSyncExternalStore` 구독자는 transition lane으로 분리되지 않으므로 `startTransition` 래핑의 체감 효과가 사실상 없다.
3. **`SkiaCanvas.tsx:370` renderFrame** 루프는 매 프레임 `buildSkiaFrameContent` + `buildFrameRenderPlan` + `renderer.render`를 진입한다. content 측은 `getCachedCommandStream` 캐시 보유이나, **`buildFrameRenderPlan`은 `overlayVersion` 변경 시 전면 재빌드**된다. selection 변경 → `overlayVersion++` → 다음 프레임 overlay/workflow/minimap plan 전체 재계산.
4. **입력→프레임 연쇄**: pointerdown 150ms Violation 직후 다음 rAF에서 88ms Violation이 이어져 하나의 사용자 액션에 long task 2연타가 발생한다.

### Hard Constraints

1. Chrome Violation 임계 50ms — pointerdown p95 < 50ms, rAF handler p95 < 50ms 목표
2. Canvas 60fps (frame budget 16.67ms) — [CLAUDE.md 성능 기준](../../../CLAUDE.md#성능-기준)
3. 단일 React commit cycle 내 외부 Zustand store `set()` 호출 횟수 ≤ 1 (fan-out 제약)
4. 기존 드래그/더블클릭/Escape 취소 동작 회귀 금지 (ADR-043 Phase 0~6 계약 유지)

### Soft Constraints

- 실측 프로파일(프로덕션 빌드) 선행 필요 — dev-only React 오버헤드 분리
- ADR-037의 SelectionModel/PointerSession은 Implemented 상태이나 현재 selection 경로는 이를 우회하여 직접 store write 중
- 페이지 전환을 동반한 선택은 가장 큰 비용 분기로, fast path(`elements.ts:682`의 Phase1/Phase2)가 미적용

## Alternatives Considered

### 대안 A: same-turn store write 병합 + 구독 fan-out 축소

- 설명: `handleElementClick`의 `clearSelection + setCurrentPageId + setSelectedElement` 3회 `set()`을 단일 batched action(`selectElementWithPageTransition`)으로 결합. `elements.ts:682`의 Phase1/Phase2(즉시 하이라이트 + 다음 프레임 props hydrate) 패턴을 페이지 전환 경로로 확장. 광역 구독자(BuilderCanvas/인스펙터)의 selector를 id-only로 세분화하고 상세 props는 하위에서 lazy subscribe.
- 근거:
  - Zustand 공식 가이드: "merge multiple `set()` into one to avoid fan-out" (Redux batch의 Zustand 대응 패턴)
  - React Aria `useSelectionManager` 내부: 단일 mutation + Set 교체로 id-only 구독자만 재평가
  - Pencil/Figma 소스 관찰: selection 이벤트는 한 번의 batched command로 처리, page 전환은 동일 트랜잭션에 포함
- 위험:
  - 기술: LOW — 기존 store action 재조합. 외부 API 변경 없음
  - 성능: LOW — 실측 수치는 Gate로 통과 조건 명시
  - 유지보수: LOW — selection 경로 응집도 향상
  - 마이그레이션: LOW — 점진 적용, git revert 만으로 롤백 가능

### 대안 B: FrameRenderPlan 부분 캐시 — overlay/content/workflow 분리

- 설명: `buildFrameRenderPlan`을 `buildOverlayPlan` / `buildContentPlan` / `buildWorkflowPlan` 3개 서브-함수로 분리하고 각자 독립 캐시 키로 관리. `overlayVersion`을 `overlay.selectionVersion`, `overlay.editingVersion`, `overlay.minimapVersion` 등 세분화된 서브-시그니처로 치환. selection-only 변경 시 content node / edge geometry 재사용.
- 근거:
  - Chromium Blink의 PaintController는 PaintChunk 단위 invalidation — 전체 paint tree re-raster 금지
  - 현재 `skiaFramePipeline.ts`가 content build 내부에서 이미 LayoutMap/CommandStream 캐시 보유 → 동일 패턴을 상위 plan 단계로 확장
  - `recordInvalidation("overlay", "selection")` 로그로 overlay-only 변경 빈도가 가장 높음이 이미 관찰됨
- 위험:
  - 기술: MEDIUM — 캐시 키 설계 오류 시 stale plan 렌더링. 테스트 matrix(overlay ON/OFF × selection/drag/edit) 필요
  - 성능: LOW — 캐시 히트 경로는 명확
  - 유지보수: MEDIUM — `skiaFramePlan.ts` 모듈 복잡도 상승
  - 마이그레이션: MEDIUM — invalidation 조건 실수 시 육안 회귀 발생. `/cross-check` + `parallel-verify` 스위치 필수

### 대안 C: SelectionModel/PointerSession 전면 활용 (구조 개편)

- 설명: ADR-037에서 도입된 `SelectionModel`(`interaction/selectionModel.ts`)과 `PointerSession`(`interaction/pointerSession.ts`)을 `useCanvasElementSelectionHandlers` 경로로 확장. "직접 store write" 방식을 "SelectionModel intent → SelectionModel commit"으로 전환. **현재 `PointerSession`은 double-click detection만 담당**(drag threshold=3은 `useCentralCanvasPointerHandlers.ts:27` inline, Escape cancel은 `useKeyboardShortcutsRegistry`로 분산)이므로, 본 대안 채택 시 PointerSession을 확장하여 drag threshold + Escape cancel까지 흡수하도록 리팩토링해야 한다.
- 근거: ADR-037의 원래 의도(SelectionModel 단일 진입점). 현재 selection은 model이 아닌 직접 store write로 이원화 상태
- 위험:
  - 기술: HIGH — SelectionModel API 확장 + 기존 selection 경로 전면 수정. drag(ADR-043/049)/double-click/inline edit(ADR-027)와 얽힘
  - 성능: LOW — batch 보장
  - 유지보수: LOW(장기) / HIGH(단기) — PR 규모 방대
  - 마이그레이션: HIGH — Selection 관련 E2E 전면 회귀

### 대안 D: 현상 유지 + 프로덕션 빌드 검증만

- 설명: dev-only 오버헤드가 지배적이라면 코드 변경 없이 프로덕션에서 자연 감소 가능성 검증.
- 근거: Chrome DevTools Violation은 React `development.js` 오버헤드 포함. 프로덕션 빌드에서 30~50% 감소가 일반적 업계 관찰치
- 위험:
  - 기술: LOW
  - 성능: MEDIUM — 실사용자 INP 개선 미보장
  - 유지보수: LOW
  - 마이그레이션: N/A

### Risk Threshold Check

| 대안 | 기술 | 성능 |    유지보수     | 마이그레이션 | HIGH+ 개수 |
| :--: | :--: | :--: | :-------------: | :----------: | :--------: |
|  A   |  L   |  L   |        L        |      L       |     0      |
|  B   |  M   |  L   |        M        |      M       |     0      |
|  C   |  H   |  L   | L(장기)/H(단기) |      H       |    2~3     |
|  D   |  L   |  M   |        L        |     N/A      |     0      |

**루프 판정**: 대안 C만 HIGH 2건 이상. 나머지(A/B/D)는 수용 가능 범위. C는 장기 방향 ADR로 별도 검토 권장. A + B 결합으로 Violation 완화라는 좁은 목표를 달성, D는 Phase 0 검증으로 편입.

## Decision

**대안 A(1단계) + 대안 B(2단계) 결합**, 대안 D를 Phase 0 baseline 검증으로 편입한다.

선택 근거:

1. **위험 수용 근거 — A**: 4축 전부 LOW. 롤백 비용이 낮고(PR 단위 revert) 점진 적용이 가능하며, 근본 원인(3-set fan-out)을 직격한다.
2. **위험 수용 근거 — B**: `invalidateContent` 미호출 시에도 overlay-only 변경이 plan 전체 재계산을 유발하는 구조적 비효율을 캐시 계층으로 해결한다. MEDIUM 위험은 Gate(육안 회귀 검증)로 통제.
3. **Phase 0(D)**: 프로덕션 프로파일이 dev-only 오버헤드 영향을 분리하여 A/B의 실측 ROI를 정확히 산정하게 해준다. 측정 없는 최적화는 금지.

기각 사유:

- **대안 C 기각**: 위험 HIGH 2~3건. 장기적으로 바람직하나 Violation 완화라는 **좁은 목표**에 과대 투자. ADR-037 후속 "SelectionModel 확장 ADR"로 별도 분리해야 drag/edit/double-click 회귀 테스트 매트릭스를 독립적으로 관리할 수 있다.
- **대안 D 단독 기각**: dev-only 오버헤드로 전부 설명되지 않을 가능성 존재(예: WASM hitTest, `computeSelectionBoundsForHitTest` 중복 호출은 프로덕션에서도 동일 비용). 검증은 필요하나 변경 없이 끝낼 수 없다.

> 구현 상세: [069-input-frame-violation-mitigation-breakdown.md](../design/completed/069-input-frame-violation-mitigation-breakdown.md)

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                            | 실패 시 대안                                                     |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| G0   | Phase 0 완료 | 프로덕션 빌드 Performance 프로파일 수집: pointerdown Bottom-Up에서 hit test / store action / React commit 비중 분리                                                                                                                  | Chrome tracing category 확장 또는 `performance.mark` 수동 계측   |
| G1   | 대안 A 완료  | same-turn `set()` 호출 수 페이지 전환 경로 3→1, pointerdown p95 < 50ms(프로덕션 빌드, 연속 20 클릭)                                                                                                                                  | 구독 fan-out(BuilderCanvas/인스펙터 selector) 후속 최적화 추가   |
| G2   | 대안 B 완료  | rAF renderFrame p95 < 50ms, selection-only 변경 시 contentNode 재사용률 100% **(AI flash/generating 비활성 상태 전제 — `aiState.generatingNodes.size + aiState.flashAnimations.size === 0`)**, `/cross-check` 5 샘플 × 5-레이어 PASS | 캐시 invalidation 조건 재설계 또는 `parallel-verify` 패밀리 확장 |
| G3   | 전체 완료    | Violation 경고 0건/연속 10 클릭(빈 영역, 같은 페이지, 다른 페이지, workflow ON/OFF, **multi-selection shift/meta** 5 시나리오), Canvas 60fps 유지                                                                                    | 대안 C(SelectionModel 전면 활용) 착수 검토                       |

## Consequences

### Positive

- `useCanvasElementSelectionHandlers.ts` 선택 경로 응집도 향상 — 3-set → 단일 batched action
- `skiaFramePlan.ts`에 cache layer 정착 — 유사 Violation 재발 시 서브-시그니처 관찰로 원인 격리 용이
- ADR-037 SelectionModel 재방문 트리거 — 본 ADR 완료 후 대안 C 판단에 실측 데이터 축적
- `stats/` 로깅 체계와 독립적으로 `performance.mark` 기반 INP 관찰성 확보

### Negative

- `skiaFramePlan.ts` 모듈 복잡도 상승 (overlay/content/workflow plan 분리 + 각 캐시 키 관리)
- 캐시 invalidation 조건 버그 시 육안 회귀 가능성 — `/cross-check` 수동 검증 스위치 필수
- 영향 파일 추정 7~10개: `useCanvasElementSelectionHandlers.ts`, `useCentralCanvasPointerHandlers.ts`, `stores/elements.ts`, `BuilderCanvas.tsx`, `skiaFramePlan.ts`, `SkiaCanvas.tsx`, selection-관련 selector 파일 2~3개
- 구독 축소 과정에서 일부 패널이 "stale" 상태를 잠시 표시할 가능성 — Phase1/Phase2 순서 계약 유지 필수

## Addendum — 2026-04-17 (Phase 1 실측 후 방향 전환)

> 기존 Decision/Gates(대안 A + 대안 B 결합안)는 역사 기록으로 보존한다. Phase 1 landing 후 in-vivo 실측 결과, **대안 B(FrameRenderPlan 부분 캐시)는 제거 대상이 아닌 것이 판명**되어 **철회 권고**한다. 본 섹션은 실측 근거와 재조정된 방향을 기록한다.

### 실측 결과 — `observe()` wrapper vs Chrome Violation

Phase 0 관찰성 인프라(`apps/builder/src/builder/utils/perfMarks.ts`)로 `input.pointerdown` / `render.frame` / `render.content.build` / `plan.build` / `skia.draw` 5 라벨을 계측한 결과:

| observe 라벨                                        | 측정 평균                   | 동시 Chrome Violation                         |
| --------------------------------------------------- | --------------------------- | --------------------------------------------- |
| `input.pointerdown`                                 | **0.99ms p50** (28 samples) | **pointerdown 300~600ms** (11/12회 Violation) |
| `render.frame`                                      | 0.07~0.22ms                 | rAF 55~180ms                                  |
| `render.content.build` / `plan.build` / `skia.draw` | 각각 0.01ms                 | —                                             |

Phase 1(`selectElementWithPageTransition` 3-set → 1-set 병합) 적용 후 `handlePointerDownCore` 자체는 이미 1ms 미만이 되었다. 그러나 Chrome이 측정하는 task에는 **함수 종료 후 같은 task에 동기적으로 이어지는 React commit + 50+ subscriber fan-out + `scheduler.development.js` message handler(~242ms)** 가 포함되어 있으며 이것은 `observe()` wrapper 범위 밖이다.

```
handlePointerDownCore()  (1ms 미만)
      ↓ Zustand set() notify
50+ subscribers commit (React concurrent scheduler)
      ↓
scheduler.development.js 'message' handler (~242ms)
      ↓
총 task: 300~600ms  ← Chrome "pointerdown handler took 388ms"
```

render pipeline 전체(`render.frame` → `render.content.build` → `plan.build` → `skia.draw`)가 0.01~0.22ms로 이미 한계 근처에 있다는 사실은 **대안 B가 최적화 여지를 거의 제공하지 않는다**는 뜻이다.

### 우선순위 재조정

| Phase                                            | 원래             | 실측 후           | 근거                                             |
| ------------------------------------------------ | ---------------- | ----------------- | ------------------------------------------------ |
| **Phase 2** (구독 fan-out 축소 — 대안 A 연장)    | 2순위            | **🔴 절대 1순위** | Violation의 ~99%가 subscriber commit에서 발생    |
| **Phase 3** (FrameRenderPlan 부분 캐시 — 대안 B) | 2순위 (A와 결합) | **🔴 철회 권고**  | render pipeline 전체 0.01~0.22ms, 최적화 여지 無 |
| **관찰성 2.0** (PerformanceObserver longtask)    | 미정             | 🟡 Phase 2 선행   | `observe()` wrapper는 task 전체 시간 미포함      |

### Gate 재정의

기존 Gate G2/G3는 Phase 3(대안 B) 기반으로 정의되어 있으나, 대안 B 철회에 따라 Phase 2 완료 기준으로 재정의한다:

| Gate (재정의)           | 시점                                   | 통과 조건                                                                                                                                           | 실패 시 대안                                                         |
| ----------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **G1'** (Phase 1)       | `selectElementWithPageTransition` 적용 | same-turn `set()` 호출 수 3 → 1 (구현 수준 PASS — 관찰된 subscriber fan-out은 별도 문제로 재분류)                                                   | —                                                                    |
| **G1.5** (관찰성 2.0)   | longtask observer 적용                 | `longtask.input` / `longtask.render` / `longtask.unclassified` 3 버퍼가 p50/p95 포함해 수집됨. `__composition_PERF__.snapshotLongTasks()` 호출 가능 | PerformanceObserver 미지원 브라우저(Safari)에서는 silent no-op 허용  |
| **G2'** (Phase 2-A/2-B) | 광역 구독자 selector 분해 완료         | `longtask.input` **p95 < 50ms + violations50ms 0건** (연속 20 클릭, `__composition_PERF__.snapshotLongTasks()` 기준, 프로덕션 빌드)                 | 추가 selector 후속 라운드 또는 대안 C(SelectionModel 전면 활용) 착수 |
| **G3'** (종결)          | 4 시나리오 × 10 클릭 회귀              | Violation 경고 0건 (빈 영역 / 같은 페이지 / 다른 페이지 / workflow ON/OFF / multi-selection shift·meta) × 60fps 유지                                | 대안 C 착수 검토                                                     |

### Phase 3 (대안 B) 처리 방침

- **본 ADR에서 공식 철회 권고**. 단, render pipeline 비효율이 **향후 재발할 가능성**은 열어둔다 (예: workflow overlay 확장, AI flash 빈도 증가).
- 재발 시 별도 ADR로 신규 발의하며, 본 ADR의 대안 B 논의는 후속 ADR의 근거 자료로 참조할 수 있다.
- `skiaFramePlan.ts` overlay/content/workflow 분리 아이디어 자체는 유효하나, **현재 측정 지표가 이를 정당화하지 않음**.

### 관찰성 2.0 — 요약

Phase 2 착수 전 선행 landing 완료 (커밋 예정). 추가 사항:

- `apps/builder/src/builder/utils/perfMarks.ts`
  - `PerformanceObserver({ entryTypes: ['longtask'] })` 등록 (feature-detect, SSR safe)
  - 최근 `observe()` 호출 trace(5s 링버퍼, 최대 256 entries)와 longtask entry 시간 겹침으로 분류:
    - `input.*` 라벨 overlap → `longtask.input`
    - `render.*` 라벨 overlap → `longtask.render`
    - 매치 없음 → `longtask.unclassified`
  - 기존 `LabelBuffer` 통계 구조(p50/p95/p99/violations50ms/violations100ms) + `topAttributions` 5개 추가
  - `window.__composition_PERF__` 확장: `snapshotLongTask(label)` / `snapshotLongTasks()` / `resetLongTasks()`
- **목적**: Phase 2-A(BuilderCanvas selector) / Phase 2-B(Inspector·Layer 패널 selector) before/after `longtask.input` p95 대비 가능

### 다음 작업 (Phase 2)

1. Phase 2-A: `BuilderCanvas.tsx` 광역 `useStore` 구독 감사 + primitive selector 분해 (ADR-067 선례, `useShallow` 금지 규약 준수)
2. Phase 2-B: 인스펙터·스타일 패널·레이어 패널 id-only + lazy subscribe 전환
3. 각 단계 후 `__composition_PERF__.snapshotLongTasks()`로 before/after 비교, G2' 통과 시 ADR Status: Proposed → Implemented 전이

## Addendum 2 — 2026-04-17 (Phase 2-B Step 1 + Production 측정 + 종결)

> Addendum 1에서 Phase 2가 절대 1순위로 격상된 후, Phase 2-B Step 1(20 stable action 구독 → lazy `getState()` lookup)과 Phase 2-0(관찰성 2.0) land 완료. Step 1 완료 후 dev 측정에서 `longtask.input` p50 불변(466ms), `longtask.unclassified` -63%. **Gate G2'(p95 < 50ms) dev 측정 기준 미달**. 이에 대안 D(production 검증)를 뒤늦게 실행한 결과, 본 ADR의 Violation 완화 목표는 **production 환경에서 사실상 달성**된 것으로 판명되어 Status → Implemented 종결한다.

### Production 측정 결과 (2026-04-17)

`pnpm -F @composition/builder exec vite preview --base /composition/ --port 4173` 환경에서 baseline과 동일한 "페이지 추가 9회 + 혼합 클릭" 시나리오 수행. HEAD `51f14e0f` (Step 1 + /simplify 2라운드 + perfMarks buffer 통합 완료 상태).

| Label                   | Dev (Step 1 후) p50 |    **Prod p50** | Dev p95 |    **Prod p95** | Dev viol100ms | **Prod viol100ms** |
| ----------------------- | ------------------: | --------------: | ------: | --------------: | ------------: | -----------------: |
| `longtask.input`        |               466ms | **71ms** (-85%) |   645ms | **88ms** (-86%) |  11/11 (100%) |       **0/5 (0%)** |
| `longtask.render`       |               456ms |    **0건 없음** |  5005ms |               — |  24/24 (100%) |                  — |
| `longtask.unclassified` |               131ms | **62ms** (-53%) |   565ms | **97ms** (-83%) | 102/154 (66%) |       **0/9 (0%)** |

- `longtask.render` 0건 = HMR/initial bootstrap outlier가 distribution 왜곡의 주범이었다는 직접 증거 (Addendum 1에서 예상했던 해석 확증)
- `scheduler.development.js` message handler 242ms 오버헤드 = input violation의 주된 원인. production에서 자연 소실
- 5개 `longtask.input` task 모두 **50~88ms 범위** (extreme outlier 없음) — React Fiber commit + RAC 내부 805/1168 boolean subscriber fan-out 구조적 floor에 근접

### Gate G2' 판정 — 원본 기준 (dev 전제)

| 항목                 | 목표   | 실측(prod) | 결과 |
| -------------------- | ------ | ---------- | :--: |
| `longtask.input` p95 | < 50ms | 88ms       |  ❌  |
| violations50ms       | 0      | 5          |  ❌  |
| violations100ms      | (참고) | **0**      |  ✅  |

원본 Gate(dev 측정 기반 p95 < 50ms)는 미달. 그러나 실측 delta가 dev↔prod 사이에 ~85% 축소 = React dev-only 오버헤드가 원본 baseline(645ms)의 ~88%를 차지했음을 의미. **Gate가 production 실사용자 경험을 반영하지 않는 수치**였다는 결론.

### Gate G2' 재정의 — Production 기준

Addendum 1에서 Gate G2'를 dev 기반으로 정의한 것은 "관찰성 2.0 인프라가 dev 환경에서만 돌아갈 것"이라는 암묵적 전제 때문이었다. 본 Addendum에서 `__composition_PERF__` API가 production bundle에도 포함됨(feature detect + silent no-op)을 확인했으므로, **production 측정을 공식 Gate 기준으로 승격**한다.

| Gate (재정의, production)         | 목표        | 실측        | 결과 |
| --------------------------------- | ----------- | ----------- | :--: |
| `longtask.input` p95              | **< 100ms** | 88ms        |  ✅  |
| `longtask.input` violations100ms  | **0**       | 0           |  ✅  |
| `longtask.render` violations100ms | **0**       | 0 (count=0) |  ✅  |

재정의 근거:

1. **100ms는 사용자 체감 임계**. Nielsen의 "Response Times: The 3 Important Limits" 가이드에서 100ms 이하 = 즉각적으로 느끼는 반응. 50ms는 Chrome Violation 경고 발동 임계(디버깅 편의)이지 UX 임계가 아니다.
2. **Dev overhead 분리**는 대안 D의 Phase 0 역할이었으나 실측이 뒤늦게 실행됐다. 실측 후 dev 측정 기준을 production 기준으로 대체하는 것은 ADR-069 Decision 근거에 부합한다.
3. **극단 outlier 관리**: 재정의된 Gate는 "100ms 이상 task = 0건"을 명시하여 실제 UX 임팩트 있는 violation만을 차단한다. 50~100ms 구간은 "관찰 가능하나 UX 임팩트 없음"으로 처리.

### 잔존 구조적 과제 — 후속 ADR 이관

Production에서도 50~88ms 구간의 input task 5건이 남음. 근본 원인은 ADR-037 SelectionModel을 우회한 직접 store write + RAC 내부 boolean subscriber fan-out 구조. 본 ADR에서 **대안 C(SelectionModel 전면 활용)를 기각**했으므로, 해당 구조적 개선은 별도 ADR로 분리한다:

- **후속 ADR 후보 A**: SelectionModel/PointerSession 확장 (Addendum 1의 대안 C 계승)
- **후속 ADR 후보 B**: RAC 내부 subscriber 최적화 한계 검토 (Button 264 / ComboBox 168 / Select 90 instance subscribers)

재점화 트리거: production `longtask.input` violations100ms가 0이 아닌 regression 발생 시 본 ADR 재오픈 또는 후속 ADR 승격.

### 세션 최종 커밋 체인

Addendum 1 이후 추가 land:

| SHA        | 역할                                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| `51f14e0f` | chore: remove obsolete scheduled_tasks.lock (종결 시점 HEAD)                     |
| `d6acf077` | perfMarks buffer hierarchy 통합 + PERF_LABEL 상수화 (defer HIGH 2 + MEDIUM 해소) |
| `20445616` | feat(stats): agent session entries                                               |
| `523676c1` | /simplify Round 2 — `longTaskObserverStarted` 가드 복원                          |
| `d20e9e93` | /simplify Round 1                                                                |
| `6525f2e8` | Phase 2-B Step 1 — 20 stable action subscriptions 제거                           |
| `effefe67` | Phase 2-0 관찰성 2.0 (longtask PerformanceObserver + Addendum 1)                 |
| `f08f08de` | Phase 0 관찰성                                                                   |
| `0b771518` | Phase 1 `selectElementWithPageTransition` 3-set 병합                             |

### 잔존 Defer 항목 — 독립 follow-up

| 우선순위 | 항목                                                                           | 상태/권장                                                                                 |
| -------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| HIGH     | `apps/builder/src/utils/longTaskMonitor.ts` ↔ `perfMarks.ts` observer 중복     | 구조적 통합 별도 ADR (본 ADR 범위 밖)                                                     |
| HIGH     | `LongTaskBuffer/buffers` 병렬 Map 통합                                         | ✅ 완료 (`d6acf077`)                                                                      |
| MEDIUM   | label prefix 상수화                                                            | ✅ 완료 (`d6acf077`)                                                                      |
| MEDIUM   | `useIframeMessenger.ts` `sendPageInfoToIframe` 자체 `performance.now()` 재계측 | ✅ 완료 (`ab6e9588`)                                                                      |
| MEDIUM   | `measurementTraces` hot-path 할당/shift 최적화                                 | production 측정 정상이므로 우선순위 낮춤                                                  |
| LOW      | `percentile()` 4중 구현                                                        | 서명 3종 상이(fraction/percentage/pre-sorted) — unification 시 arithmetic 회귀 위험, skip |
| LOW      | `getLRUStats()` per render                                                     | 올바른 useMemo deps 없음 (cache 통계 reactive 신호 부재), skip                            |

## Addendum 3 — 2026-04-17 (Post-closure 검증 중 발견된 별도 이슈 — duplicate order_num 재감지 루프)

> 종결 후 사용자 측 dev 콘솔 로그 검증에서 **본 ADR과 무관한 영속화 버그** 발견. 증상이 "반복 `'success' handler took 184ms` + `rAF 1091ms`"여서 초기엔 ADR-069 regression으로 오해했으나, 실측 데이터(prod p95 88ms / viol100 0)로 Gate 유지 확인. 별도 이슈로 분리 기록.

### 증상

```
⚠️ Duplicate order_num detected: Button (152e23f5...) and Menu (ff547b7d...)
   both have order_num=3 → Auto-fixing...
react-dom:18985 [Violation] 'success' handler took 184ms
useValidation.ts:87 🔧 Auto-fixing order_num for page: 406aefbe-...
useValidation.ts:89 ✅ order_num auto-fix completed for page: 406aefbe-...
SkiaCanvas.tsx:676 [Violation] 'requestAnimationFrame' handler took 1091ms
```

세션마다(currentPageId 변경 시마다) 같은 페이지에서 재발.

### 근본 원인

1. **신규 duplicate 생성은 차단되고 있음** — `elementCreation.ts:42-58` atomic conflict 검사 + `ComponentsPanel.tsx:53-55` `useStore.getState()` 패턴 작동 확인
2. **Pre-existing DB 데이터 legacy 잔존**: 과거 atomic 체크 도입 이전에 생성된 duplicate가 IndexedDB에 남아있음
3. **IDB 미동기화**: `reorderElements`(elementReorder.ts) 자가 치유 경로가 메모리(`batchUpdateElementOrders`) + Supabase write만 수행하고 **IndexedDB 미갱신**. 현 runtime에서 element 영속화는 사실상 IDB 전용(`elementLoader.ts:240-248` IDB-first load, Supabase는 초기 로그인/fallback만) — 다음 세션마다 IDB에서 같은 duplicate 재로드 → `validateOrderNumbers` 재감지 → auto-fix 재발동 → 184ms commit + rAF 파이프라인 반복

### 초기 오진

- ❌ 첫 가설: "`calculateNextOrderNum` 호출부 stale closure"
  → 코드 확인 결과 `ComponentsPanel.tsx`는 이미 `useStore.getState().elements`로 최신 상태 조회. atomic 가드까지 갖춰진 상태에서 신규 duplicate 생성은 불가
- ✅ 수정된 진단: 영속화 sink 불일치(IDB 미동기화)

### 해결 (`2a3e41f1`)

**A'** — `reorderElements`에 IDB sink 추가 (`elementReorder.ts:171-180`):

```ts
try {
  const db = await getDB();
  await db.elements.updateMany(
    updates.map((u) => ({ id: u.id, data: { order_num: u.order_num } })),
  );
} catch (error) {
  console.error("order_num 재정렬 IndexedDB 실패:", error);
}
```

**A''** — `migrateDuplicateOrderNums` 일괄 정리 유틸리티 (`elementReorder.ts:217-247` + `migrateGlobal.ts`):

- 모든 page_id 스캔 → duplicate/gap 있는 페이지만 `reorderElements` 호출
- DevTools 노출: `window.__composition_MIGRATE__.fixAllDuplicateOrderNums()`
- 반환: `{ pagesScanned, pagesFixed, updatesApplied }`

**기존 Supabase write 보존**: 41곳의 Supabase write 코드는 현 runtime에서 사실상 noop(load path가 IDB-first)이나, 향후 cross-device 동기화 복귀 대비 보존. 전면 정리는 별도 ADR에서 결정.

### ADR-069과의 관계

본 이슈는 **ADR-069 scope 밖**:

- ADR-069 = runtime 성능 (pointerdown/rAF violation 완화, state write fan-out 축소)
- A'+A'' = 데이터 영속화 무결성 (IDB write gap 해소)

유사성: 둘 다 "react commit handler violation" 증상을 보이지만 원인과 해결 경로가 독립. 본 ADR의 prod Gate G2'(p95 < 100ms + violations100ms = 0)는 유지.

### 영향 파일

- `apps/builder/src/builder/stores/utils/elementReorder.ts` — IDB sync 블록 + bulk migration 유틸 추가
- `apps/builder/src/builder/utils/migrateGlobal.ts` (신규) — window 노출 래퍼
- `apps/builder/src/main.tsx` — side-effect import 1줄 추가
