# ADR-172: 팬 경로 파생 비용 제거 — 카메라 이동과 파생 계층 분리

## Status

Accepted — 2026-07-29 (리뷰 round 1 승인 — `reviews/172.md`, 이슈 2건 전건 fixed)

### 진행 로그

| Phase                             | 상태            | 커밋                      | 비고                                                                                                         |
| --------------------------------- | --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Phase 0 — inventory               | 완료 2026-07-29 | (Phase 1 에 동봉)         | `isVisible`/`viewportVersion` 읽기 0건 · `childrenMap`·`elementById` mutate 0건 (R3·R6 해소)                 |
| Phase 1 — 카메라 dead 필드 제거   | 완료 2026-07-29 | `49b845089`               | `LayoutPublisherInput` 카메라 2필드 삭제 + `ReadonlyMap` 전환                                                |
| Phase 3 — snapshot 카메라 축 분리 | 완료 2026-07-29 | `02f634f10`               | core / visibility / compose 3단계 + key 기반 identity 안정화. 4-1-a 채택                                     |
| Phase 2 — `layoutInputKey` memo   | 완료 2026-07-29 | `fc51d75a8`               | R1 HIGH — **G1 통과** (신규 child 발행 82→83, 투명/미등록 0건) + 정적 가드 2건                               |
| Phase 1.5 — Skia 프레임 재사용    | 완료 2026-07-30 | `2e25a5acd`               | R7 재측정 → **진행 판정**. 커맨드 스트림 캐시에 동봉 (lazy builder) + 계약 테스트 7건                        |
| Phase 4 — 계측 상설화             | 완료 2026-07-30 | `6886453ba` · `4d21e10a6` | 라벨 3종 (`render.derived.{layout-key,scene,children-map}`). 카운터는 신설 안 함 — `PerfStats.count` 가 지표 |
| Phase 5 — 검증                    | 진행 중         | —                         | **G1·G2·G3·G5 통과** (라이브 실측). 6-1 정적 · 6-3 CI 테스트 · G4 잔여                                       |

**축 ① 진행률**: 4지점 **전부 반영 완료** (P-1 Phase 2 / P-2 Phase 3 / P-3 Phase 1 / P-4 Phase 1.5). **20배 규모 실측으로 Hard Constraint 1 실증** (아래 §"G5 종결").

**R4 해소**: 측정이 hidden 탭 제약을 받는다는 전제는 2026-07-30 실측에서 성립하지 않았다 — 탭이 `visible` 이고 rAF 가 정상 동작(120Hz)했다. 이전 세션의 제약을 검증 없이 승계한 것이 원인이다. G5 를 포함한 전 Gate 를 라이브에서 확인했다.

### R7 종결 — P-4 대규모 N 재측정 결과 (2026-07-30, 라이브 실측)

원본 루프(`skiaFramePipeline.ts` P-4)를 실제 입력(`filteredChildIds` 82 entries / `renderNodesMap` 82)으로 재현해 K배 복제 스케일 벤치:

|        자식 수 |        p50 |        p95 |      min | 60fps 예산(p50) |
| -------------: | ---------: | ---------: | -------: | --------------: |
| 80 (현 실사용) |    0.006ms |    0.020ms | 0.0045ms |           0.04% |
|            960 |    0.045ms |    0.058ms |  0.040ms |           0.27% |
|          2,400 |     0.27ms |     0.99ms |  0.090ms |            1.6% |
|          4,800 |     0.21ms |     0.25ms |   0.19ms |            1.3% |
|          7,200 |     1.77ms |     3.03ms |   0.42ms |           10.6% |
|          9,600 | **2.06ms** | **3.72ms** |   0.54ms |       **12.4%** |

`min` 기준으로는 40–58 ns/child 로 **선형**이고, p50/p95 의 초선형 급증은 매 프레임 Map + 배열 수천 개를 새로 할당하는 데서 오는 **GC 압력**이다 — 그 할당이 실제 동작이므로 p50 이 실측치다. R7 의 skip 기준(프레임당 0.1ms)을 대규모 N 에서 크게 초과하므로 **Phase 1.5 진행**으로 종결했다. 현 실사용 규모(80 자식)에서는 여전히 무해하며, 이 Phase 의 근거는 비례성이다.

### G5 종결 — 20배 규모 end-to-end 실측 (2026-07-30, 라이브 빌더)

Soft Constraint 의 "end-to-end 프레임 미검증" 을 해소한다. 실문서에 요소를 **246 → 5,046 (20.5배)** 로 확장해(19 페이지 × 250, Phase 0 의 4,868 대조점과 동급) 팬을 두 갈래로 나눠 측정했다. **갈래를 나누는 것이 핵심**이다 — 합치면 두 축이 섞여 원인이 안 보인다.

#### 갈래 A — 가시 페이지 집합 **불변** 팬 (= 축 ① 의 정의역)

| 지표              | 246 요소 | **5,046 요소** |
| ----------------- | -------: | -------------: |
| 파생 3축 count    |        0 |          **0** |
| commandStream hit |     100% |       **100%** |
| 16.7ms 초과 드롭  |        0 |          **0** |
| 프레임 간격 max   |    9.4ms |      **9.3ms** |
| 프레임 본문 p50   |    1.0ms |          1.7ms |

**Hard Constraint 1 이 실증됐다** — 요소가 20배가 되어도 파생 재구축은 0 이고 프레임 간격이 변하지 않는다. 늘어난 1.7ms 는 그리기 비용이지 파생이 아니다. Phase 0 이 이 규모에서 추정한 팬당 약 35ms 가 **실측 0** 이 됐다.

#### 갈래 B — 가시 집합이 **바뀌는** 팬 (= 축 ②·③ 의 정의역)

| 구성요소                 |   246 요소 |  **5,046 요소** | 배율 |
| ------------------------ | ---------: | --------------: | ---: |
| Skia 재래스터 (`record`) |      3.1ms |      **65.1ms** |  21× |
| `layout-key` 재계산      |      2.5ms |        **15ms** |   6× |
| `children-map` 조립      |      0.1ms |           0.4ms |   4× |
| `scene` (core)           |          0 |           **0** |    — |
| 프레임 본문 p50          |      0.9ms |      **67.9ms** |  75× |
| 드롭 비율                | 9/180 (5%) | **42/60 (70%)** |      |

#### 이 측정이 뒤집은 것 — 축 ③ "빈도가 낮다" 전제 반증

범위 경계표는 축 ③ 을 미포함으로 두며 **"③은 재래스터 시에만 발생하고 blit 프레임에는 없으므로 ①보다 빈도가 낮다 — 먼저 ①을 처리하고 재측정한다"** 고 적었다. 그 재측정 결과, **빈도가 낮지 않다**:

- 60 프레임 팬에서 재래스터 **35회** — 가시 페이지가 하나 드나들 때마다 `rendererInput` identity 가 바뀌고(`SkiaCanvas.tsx:267` 의 `useEffect([rendererInput])`) 커맨드 스트림 캐시가 `forced` 로 무효화된다. miss 34회 중 **전부** `forced` 다.
- 재래스터 1회가 **65ms** (최대 126ms) — 프레임 예산 8.33ms 의 8~15배. 드롭의 주범이며 21× 로 스케일한다.

즉 축 ③ 의 이연 사유("빈도가 낮다")는 **가시 집합 불변 팬에서만 참**이고, 페이지 경계를 넘는 팬에서는 성립하지 않는다. 축 ② 의 `layout-key` 15ms 도 같은 프레임에 겹친다.

**본 ADR 은 여기까지 하지 않는다** — 축 ②·③ 은 범위 밖이고, 위 수치는 후속 판정의 근거로만 남긴다. 다만 이연 사유가 실측으로 반증됐다는 사실은 후속 ADR 의 출발점이 달라진다는 뜻이다.

#### 부수 정정

- **R4(hidden 탭 제약) 는 성립하지 않았다.** 탭이 `visible` 이고 rAF 가 120Hz 로 정상 동작했다 — 이전 세션의 제약을 검증 없이 승계한 것이다. 프레임 예산도 60fps 의 16.7ms 가 아니라 **8.33ms** 다.
- 브라우저 콘솔에서 `import("/src/.../renderCommands.ts")` 로 얻은 모듈은 앱과 **다른 인스턴스**라 앱 캐시를 무효화하지 못한다. 런타임 캐시 확인은 `window.__composition_CACHE_METRICS__` 를 쓸 것.
- 측정용 요소 4,800개는 문서에 **그대로 남긴다** (사용자 결정 2026-07-30) — 후속 재측정에 재사용한다.

## Context

빌더에서 카메라를 이동(팬/줌)하면 rAF 당 1회 Zustand viewport store 가 갱신되고(`viewport/useViewportControl.ts:349`), 그 구독으로 `BuilderCanvas` 가 리렌더된다. 리렌더마다 **요소 수에 비례하는 파생 계층 재구축 3건**(P-1~P-3, React 축)이 실행되고, 이와 별개로 Skia 프레임 루프가 blit 프레임에도 파생 1건(P-4, Skia 축)을 매 rAF 재구축한다 — **합계 4지점**이다.

**SSOT 위상**: 본 ADR 은 **builder-system layer**(빌더 내부 성능 아키텍처) 규칙이며 SSOT 3-domain(D1 DOM/D2 Props/D3 시각) 체인과 무관하다. catalog/spec/Generator 확장 없음, 사용자 캔버스 컴포넌트의 시각 결과 무변경. ADR-163(패널 구조 표준)과 같은 위상이다.

### 실측 (2026-07-29, 라이브 빌더)

| 지점 | 위치                                                                                         | 성격                                      |
| ---- | -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| P-1  | `layoutInputKey` → `createPageLayoutSignature`                                               | **useMemo 없음** — 훅 본문 직접           |
| P-2  | `sceneStructureSnapshot` useMemo (deps 에 카메라)                                            | 카메라 결합                               |
| P-3  | `buildPageLayoutPublisherInput` 의 `new Map(elementById)`                                    | 방어적 복사 + 카메라 결합                 |
| P-4  | `buildSkiaFrameContent` 의 `commandChildrenMap` 재구축 (`skia/skiaFramePipeline.ts:260-274`) | **Skia 축** — blit 프레임에도 매 rAF 실행 |

P-1~P-3 은 React 축(리렌더 유발), P-4 는 Skia 축이다. `SkiaCanvas.tsx:665` 의 `buildSkiaFrameContent` 앞에 프레임 종류별 early return 이 없어, camera-only(blit) 프레임에서도 `filteredChildIds` 전체를 순회하며 새 `Map` + 새 배열을 만든다 (O(visible 요소)). **P-4 는 현 규모에서 무해로 이미 실측됐다** — 2026-07-27 프레임 분해 실측이 팬 중 JS 조립 구간(P-4 를 포함하는 content.build + plan.build)을 0.07~0.13ms/frame(약 7%)로 재고 "사실상 0" 으로 격하 판정했다. 본 ADR 이 문제 삼는 것은 절대값이 아니라 **비례성**이다 — 이 구간은 캐시 게이트 없이 매 프레임 O(N) 으로 도는 유일한 접두부라 대규모 N 스케일링만 미측정이며, 그 스케일링은 2026-07-30 재측정으로 확인됐다 — 9,600 자식에서 p50 2.06ms(예산 12.4%)로 skip 기준을 크게 초과해 Phase 1.5 를 진행했다 (위 §"R7 종결"). ADR-167(idle rAF 정지, 기각·재론 금지)과는 축이 다르다 — 167 은 프레임 **실행 여부**(유휴 6.7ms/s 쪽), 본 건은 실행되는 프레임의 **내부 비용**(상호작용 884ms/s 쪽)으로, 분포 실측이 최적화 대상으로 지목한 축이다.

팬 프레임당 합계 (P-1~P-3 만, P-4 제외):

| 노드 수            | P-1        | P-2       | P-3 | 합계      | 60fps 예산 대비 |
| ------------------ | ---------- | --------- | --- | --------- | --------------- |
| **62 (현 실사용)** | 0.3ms      | 0.1ms     | ~0  | ~0.4ms    | 2% — 무해       |
| 980                | 5.9ms      | 0.4ms     | ~0  | ~6.4ms    | 38%             |
| 4,868              | 33.4ms     | 1.3ms     | 0.2 | ~35ms     | 초과 (약 28fps) |
| 9,728              | **63.1ms** | 2.1–3.9ms | 0.4 | **~66ms** | 초과 (약 15fps) |

P-1 은 요소당 `LAYOUT_STYLE_KEYS` 73개 + `LAYOUT_PROP_KEYS` 43개를 문자열로 잇는다(요소당 약 1.4KB) — N=9,728 에서 **프레임마다 12.8MB 문자열**을 만들어 useEffect deps 비교에만 쓴다. GC 압력은 미측정이다.

**대조군**: Pen v1.2.1 은 같은 구간이 0ms 다 — `scenegraph.updateLayout()` 호출부가 렌더 경로에서는 `redrawContentIfNeeded()` 안에만 있어, 팬/줌(blit) 중에는 레이아웃도 파생 재구축도 실행되지 않는다. 재래스터 시에도 씬 그래프를 직접 순회하며 중간 파생 계층이 0개다. 상세: [PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md §6-3](../explanation/research/PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md).

**핵심 실측 1건** — `LayoutPublisherInput.panOffset` / `.zoom` 은 선언만 되고 **어디서도 읽히지 않는다** (`hooks/useLayoutPublisher.ts` 참조 0건, `hooks/` + `renderers/` 전체에서 `input.panOffset`/`input.zoom` 소비 0건). P-3 의 카메라 결합은 동작에 기여하지 않는 잔재다.

### 범위 경계 — Pen 의 스케일 무관성 4축 중 어디까지인가

원 조사 질문은 "Pen 은 요소가 많아도 왜 느려지지 않는가" 였고, 그 답은 성격이 다른 **4개 축**이다 (연구 문서 §6-3). 본 ADR 은 그중 **①만** 다룬다. 나머지를 다루지 않는 사유를 여기 명시해 후속 판정의 기준으로 남긴다.

| 축                             | Pen                                                       | composition 현황                                                                                                             | 본 ADR        |
| ------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------- |
| ① 카메라 이동 중 파생 재구축 0 | `updateLayout()` 이 `redrawContentIfNeeded()` 안에만 존재 | React 축 P-1~P-3 + **Skia 축 P-4**                                                                                           | **전부 대상** |
| ② 편집 시 O(dirty 경로)        | 조상 체인 dirty + 조기 중단, 하강도 매 레벨 게이트        | `createPageLayoutSignature` O(N) + 커맨드 스트림 **전체 재구축** (`renderCommands.ts:347-388` 5중 키에 `layoutVersion` 포함) | **이연**      |
| ③ 서브트리 컬링 O(1) 진입 차단 | `beginRender` 실패 시 자식 재귀 자체가 없음               | replay 가 커맨드 배열을 전체 순회하며 `skipDepth` 로 건너뜀 (`renderCommands.ts:967-1013`)                                   | **미포함**    |
| ④ 파생 계층 0                  | 씬 그래프 직접 순회                                       | 4겹                                                                                                                          | **미포함**    |

이연·미포함 사유:

- **②** — 편집 경로는 미측정이라 채택 근거가 없다. 측정 후 별도 ADR 로 판정한다 (design §7). 본 ADR 의 대안 C 기각 사유와 같은 논리다.
- **③** — 커맨드 배열 선형 스캔은 요소당 상수 시간이고, 실제 그리기(`CMD_DRAW`)는 이미 건너뛴다. 개선하려면 스트림에 서브트리 오프셋을 심어야 하는데 이는 스트림 캐시 무효화 정책과 얽힌다. **③은 재래스터 시에만 발생**하고 blit 프레임에는 없으므로 ①보다 빈도가 낮다 — 먼저 ①을 처리하고 재측정한다.
  - **2026-07-30 재측정 결과 이 사유는 반증됐다** (§"G5 종결" 갈래 B): 가시 페이지 집합이 바뀌는 팬에서 60프레임 중 재래스터 35회 · 1회당 65ms(21× 스케일)로, 빈도도 비용도 낮지 않다. "blit 프레임에는 없다"는 **가시 집합 불변 팬에서만** 참이다. 미포함 판정 자체는 유지하되(본 ADR 범위 밖), 후속 판정의 출발점은 달라진다.
- **④** — 파생 계층 축소는 제품 구조 결정이며, Pen 의 단층성은 DOM/CSS 정합 포기의 산물이다 (연구 문서 §6-3-4). 차용 대상이 아니다.

**확인된 정상 항목** (과잉 수정 방지):

- `executeRenderCommands` 는 `contentNode.renderSkia` 안에 있어 **재래스터 시에만** 실행된다 (`skia/skiaFramePipeline.ts:318-330`) — blit 프레임에서 돌지 않으므로 Pen 과 동형이다.
- 노드 Picture 캐시가 이미 가동 중이다 (`stream.selfSpans`, ADR-153 Phase 3). Pen 에는 없는 기제이며 이 축은 composition 우위다.

### Hard Constraints

1. **Canvas 60fps 유지** (CLAUDE.md 성능 기준) — 팬 프레임당 파생 비용이 요소 수에 비례하지 않아야 한다.
2. **레이아웃 발행 누락 0** — `addElement` 는 `elements`/`layoutVersion` 갱신 후 `pageIndex`/`elementsMap` 을 별도 commit 으로 rebuild 하고 두 번째 commit 은 `layoutVersion` 이 불변이다. 그래서 page/frame **input 구조 자체**가 publish trigger 여야 신규 child 가 layoutMap 없이 투명/미등록 상태로 남지 않는다 (`hooks/useLayoutPublisher.ts:82-85` 주석). **deps 를 `layoutVersion` 단독으로 좁히는 것은 금지.**
3. **ADR-136 `sceneVersion` signature 입력 목록 정합** — projection-relevant field 추가/이동 시 signature 입력 목록 동시 갱신 의무 (`.claude/rules/canvas-rendering.md` §9).
4. **시각 결과 무변경** — 사용자 캔버스 렌더 결과에 차이가 없어야 한다 (성능 전용 변경).

### Soft Constraints

- ~~측정이 MCP 탭 `visibilityState: hidden` 제약으로 **end-to-end 프레임 미검증** — 위 수치는 "측정된 함수 비용 × 코드로 확정한 빈도" 다.~~ → **2026-07-30 해소**: 탭이 `visible` 이고 rAF 가 120Hz 로 정상 동작했다 (이전 세션 제약의 무검증 승계였다). 20배 규모 end-to-end 실측은 §"G5 종결" 참조.
- 계측 인프라는 이미 있다 (ADR-153 Implemented, `builder/utils/perfMarks.ts`).
- 편집 경로는 미측정 — 본 ADR 범위 밖 (design §7 조건부 판정).

## Alternatives Considered

### 대안 A: 국소 수정 4종 — dead 필드 제거 + 메모이제이션 + 카메라 축 분리 + Skia 프레임 재사용

- 설명: ① `LayoutPublisherInput` 의 미소비 카메라 필드 삭제 + 방어적 Map 복사 제거 (identity 안정화의 절반 — 나머지 절반은 ③이 담당: deps 에 남는 `sceneSnapshot`·`visiblePages` 가 카메라 결합 스냅샷 산출물이라 ③ 전까지 팬마다 identity 가 깨진다, `BuilderCanvas.tsx:516-527`) ② 그 위에서 `layoutInputKey` 를 `useMemo` 로 감쌈 ③ `buildSceneStructureSnapshot` 을 카메라 무관 core 와 카메라 의존 visibility 로 분리 ④ `buildSkiaFrameContent` 의 `commandChildrenMap` 을 커맨드 스트림 캐시와 **같은 키**로 재사용 (blit 프레임에서 재구축 skip).
- 근거: Pen 실측(#5 — 팬 중 `updateLayout()` 호출 0). React 공식 지침의 "deps 로만 소비되는 파생값" 패턴. ①의 대상이 **미소비 필드임을 grep 으로 확증**했고, ④의 대상은 이미 옆에서 5중 키 캐시(`getCachedCommandStream`)가 돌고 있어 같은 키를 재사용하면 된다.
- 위험:
  - 기술: **MEDIUM** — ③의 `ScenePageSnapshot.isVisible` 이 core/visibility 두 단계에 걸쳐 계약 변경이 필요할 수 있다. ④는 `commandChildrenMap` 이 반환값(`childrenMap`)으로도 나가므로 소비자의 identity 가정을 확인해야 한다.
  - 성능: **LOW** — 순수 감산. 새 비용 없음.
  - 유지보수: **LOW** — useMemo deps 가 늘지 않고, 오히려 dead 필드가 줄어든다.
  - 마이그레이션: **LOW** — 내부 구조 변경, 저장 데이터·사용자 산출물 무관.

### 대안 B: 카메라를 React 구독에서 완전 제거 (mutable ref 단독)

- 설명: `panOffset`/`zoom` 을 Zustand 구독에서 빼고 렌더 루프가 `mutableViewport` ref 로만 읽는다. 리렌더 자체를 없앤다.
- 근거: `SkiaCanvas.tsx:458` 이 이미 "ViewportController 뮤터블 ref 에서 직접 읽기 (zero-latency)" 로 이 패턴을 부분 채택. Pen·Figma 모두 카메라를 씬 모델 밖에 둔다.
- 위험:
  - 기술: **HIGH** — 카메라를 React 에서 읽는 **정당한** 소비자가 다수다 (선택 오버레이 좌표 변환 `screenToViewportPoint`, 패널 표시, 히트테스트 진입점). 전수 전환 없이는 stale 좌표가 생긴다.
  - 성능: LOW — 이득은 A 이상.
  - 유지보수: **MEDIUM** — "카메라는 React 에서 읽지 않는다" 규율을 신규 코드에 지속 강제해야 한다.
  - 마이그레이션: MEDIUM — 소비자 전수 전환.

### 대안 C: 시그니처 해싱 폐기 → mutation 시점 dirty 집합 (Pen #12/#14 직접 차용)

- 설명: `createPageLayoutSignature` 를 없애고, store mutation 시점에 조상 체인 dirty 마킹(이미 dirty 면 조기 중단)으로 대체.
- 근거: Pen `invalidateLayout()` — `for(e=parent; e && !e.layout.dirty; e=e.parent)` 조기 중단으로 O(dirty 경로). 하강도 매 레벨 `if(n.layout.dirty)` 게이트.
- 위험:
  - 기술: **HIGH** — `layoutCache` 계약 전체 교체이며 layout-engine.md 의 **5-심볼 2계층 체인**(`LAYOUT_AFFECTING_PROP_KEYS` / `NON_LAYOUT_PROPS_UPDATE` / `INHERITED_LAYOUT_PROPS_UPDATE` / `LAYOUT_STYLE_KEYS` / `LAYOUT_PROP_KEYS`)과 결합돼 있다.
  - 성능: LOW — 이득은 크다.
  - 유지보수: MEDIUM — dirty 마킹 누락이 **조용한 무반영**으로 나타난다 (기존 체인의 알려진 실패 양식).
  - 마이그레이션: **HIGH** — 누락 1건이 특정 편집만 무반영시키는 형태라 회귀 탐지가 어렵다.

### 대안 D: 현상 유지 + 규모 상한 문서화

- 설명: 현 실사용 62 노드에서 0.4ms 이므로 손대지 않고, 성능 한계 규모만 문서에 남긴다.
- 근거: ADR-167 선례 — idle rAF 정지가 G0 실측(유휴 코어 0.67%)으로 기각됐다. 측정 없이 최적화하지 않는다는 규율.
- 위험:
  - 기술: LOW
  - 성능: **HIGH** — 비용이 요소 수에 선형이고 980 노드에서 이미 예산 38%, 4,868 에서 예산 초과다. 노코드 빌더 산출물이 그 아래로 고정된다는 근거가 없다.
  - 유지보수: MEDIUM — dead 필드와 비-memo 문자열 조립이 그대로 남아 후속 작업자가 같은 함정을 재생산한다.
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안 | 기술     | 성능     | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | -------- | -------- | -------- | ------------ | :--------: |
| A    | MEDIUM   | LOW      | LOW      | LOW          |   **0**    |
| B    | **HIGH** | LOW      | MEDIUM   | MEDIUM       |     1      |
| C    | **HIGH** | LOW      | MEDIUM   | **HIGH**     |     2      |
| D    | LOW      | **HIGH** | MEDIUM   | LOW          |     1      |

**루프 판정**: 대안 A 가 HIGH+ 0 이므로 추가 대안 생성 루프 불요 (`.claude/rules/adr-writing.md` §Risk Threshold Check — "모든 대안이 HIGH 1개 이상" 조건 미충족).

## Decision

**대안 A: 국소 수정 4종**을 선택한다.

선택 근거:

1. **측정된 회수량이 있는 유일한 대안이다.** P-1~P-3 는 실측된 비용이고, A 는 그것을 전부 제거한다. B 는 A 의 상위집합이지만 추가 이득이 미측정이다.
2. **축 ① 을 완결한다.** P-4(Skia 축)를 빼면 Hard Constraint 1("팬 프레임당 파생 비용이 요소 수에 비례하지 않는다")이 성립하지 않아 **G5 가 구조적으로 통과할 수 없다** — React 축만 고치면 blit 프레임에 `commandChildrenMap` O(N) 이 남는다. 범위 경계표의 ① 은 4지점 전부여야 닫힌다.
3. **최대 항목(P-1, 63ms)이 가장 싼 수단으로 해소된다.** 63ms 의 원인은 알고리즘이 아니라 **메모이제이션 부재**다 — 문자열은 useEffect deps 비교에만 쓰이는데 매 렌더 조립된다. 시그니처 자체를 교체(C)하지 않아도 된다.
4. **잔존 위험이 Gate 1개로 관리된다.** 유일한 HIGH(R1)는 Hard Constraint 2 의 publish trigger 보존이고, 이는 G1(live `addElement` 시나리오)로 직접 검증된다.
5. **P-3 는 위험이 없다** — 미소비 필드 삭제임을 grep 으로 확증했다.

기각 사유:

- **대안 B 기각**: 카메라를 React 에서 읽는 정당한 소비자가 다수라 전수 전환 비용이 측정되지 않은 추가 이득에 비해 과대하다. A 로 팬 경로 이득을 먼저 확보하고, **잔존 리렌더가 문제로 실측되면** 그때 재론한다(ADR-167 이 세운 "측정 후 채택" 규율 준수).
- **대안 C 기각**: 측정된 비용의 대부분이 편집 경로가 아니라 **매 렌더 실행**에서 오고, 그것은 메모이제이션만으로 해소된다. 시그니처 교체는 편집 경로 실측 후 별도 ADR 로 판정한다 (design §7).
- **대안 D 기각**: 현 규모에서 무해한 것은 맞으나 P-3(미소비 필드)는 비용과 무관하게 잔재이고, P-1 은 980 노드에서 이미 예산 38% 다. ADR-167 과 달리 여기서는 **실측된 비용이 규모에 선형으로 증가**한다 — 기각 근거가 성립하지 않는다.

> 구현 상세: [172-pan-path-derived-cost-breakdown.md](design/172-pan-path-derived-cost-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                          |  심각도  | 대응                                                                                                                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `layoutInputKey` 메모이제이션이 publish trigger 를 놓쳐 신규 요소가 layoutMap 없이 **투명/미등록** (`hooks/useLayoutPublisher.ts:82-97` 의 addElement 2-commit 계약)                          | **HIGH** | deps 를 `layoutVersion` 으로 좁히지 않고 `pages`/`framePages` 배열 identity 유지 (Phase 1+3 이 그 identity 를 카메라와 분리 — Phase 1 단독으로는 deps 의 `sceneSnapshot`/`visiblePages` 가 카메라 결합으로 남는다) + **G1**                                                                                                            |
| R2  | `buildSceneStructureSnapshot` 분리 시 `ScenePageSnapshot.isVisible` 계약 변경으로 소비자 파손 / 페이지 진입·이탈 미반영 (`scene/buildSceneSnapshot.ts:179`)                                   |   MED    | Phase 0 에서 `isVisible` 소비자 전수 후 4-1-a/4-1-b 택일 + **G3**                                                                                                                                                                                                                                                                      |
| R3  | `elementById` 를 `ReadonlyMap` 으로 전달할 때 mutate 하는 소비자가 존재 (`renderers/rendererInput.ts:67` 의 방어적 복사가 가리고 있었을 가능성)                                               |   MED    | Phase 1 착수 전 mutate 소비자 grep. 있으면 그 지점만 지역 복사 유지 + 사유 주석                                                                                                                                                                                                                                                        |
| R4  | 측정이 hidden 탭 제약으로 end-to-end 미검증 — 실제 프레임 개선폭이 추정과 다를 수 있음                                                                                                        |   MED    | **G2/G5** 를 visible 창(사용자 실행)에서 수행. Phase 4 계측 상설화로 재현 가능성 확보                                                                                                                                                                                                                                                  |
| R5  | ADR-136 `sceneVersion` signature 입력 목록에 `isVisible` 이동이 미반영되어 same-count phantom change 미감지                                                                                   |   MED    | Phase 3 에서 `.claude/rules/canvas-rendering.md` §9 입력 목록 대조 (§4-2 체크 항목)                                                                                                                                                                                                                                                    |
| R6  | P-4 재사용 시 `commandChildrenMap` 이 반환값 `childrenMap` 으로도 나가므로(`skia/skiaFramePipeline.ts:335`), 소비자가 프레임마다 새 identity 를 전제하거나 반환 Map 을 mutate 하면 stale/오염 |   MED    | **해소 (2026-07-29 Phase 0)** — `childrenMap` mutate 소비자 0건 확인(bench 픽스처만 `set`). Phase 1.5 는 커맨드 스트림과 **동일 5중 키 엔트리에 동봉**해 별도 키를 신설하지 않았고, 캐시 hit 시 이전 identity 를 반환한다 — 종전에는 스트림(캐시)과 childrenMap(매 프레임 새로 조립)의 세대가 갈려 있었으므로 오히려 비대칭이 해소됐다 |
| R7  | P-4 는 현 규모 실측(JS 조립 0.07~0.13ms/frame, 2026-07-27 프레임 분해)에서 이미 "사실상 0" 격하 판정 — 대규모 N 에서도 작으면 Phase 1.5 가 비용 대비 무의미                                   |   LOW    | **종결 (2026-07-30)** — 대규모 N 재측정 결과 9,600 자식에서 p50 2.06ms(예산 12.4%)로 skip 기준(0.1ms) 크게 초과 → Phase 1.5 진행. 측정표는 위 §"R7 종결"                                                                                                                                                                               |

잔존 HIGH 는 R1 1건이며 G1 과 1:1 대응한다. R1 은 Phase 2 국소 변경에 한정되므로 별도 ADR 분리 대상이 아니다.

## Gates

| Gate | 시점         | 통과 조건                                                                                       | 실패 시 대안                                                               | 결과                                                                            |
| ---- | ------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| G1   | Phase 2 직후 | live builder 에서 요소 추가 직후 신규 child 정상 렌더 — 투명/미등록 **0건** (2-commit 시나리오) | Phase 2 revert. deps 를 배열 identity 가 아닌 구조 해시로 재설계 후 재시도 | **통과** 2026-07-29 (82→83 발행)                                                |
| G2   | Phase 5      | 팬 중 P-1/P-2 재계산 횟수 **0** (Phase 4 카운터)                                                | 잔존 재계산 유발 dep 을 식별해 Phase 1/3 보강                              | **통과** 2026-07-30 (팬 180프레임 0회 / 페이지 전환 1회씩 — 대조군 확인)        |
| G3   | Phase 5      | 페이지 경계를 넘는 팬에서 새 페이지 진입/이탈 정상 렌더                                         | 4-1-b(계약 유지, 얕은 복사)로 전환                                         | **통과** 2026-07-30 (전환·복귀 왕복 + 대폭 팬 정상 렌더)                        |
| G4   | Phase 5      | 프레임 편집 모드 / 브레이크포인트 전환 / undo·redo 후 레이아웃 발행 정상                        | 해당 경로의 publish trigger 를 deps 에 명시 추가                           | 잔여                                                                            |
| G5   | Phase 5      | visible 창에서 60fps 유지 (`useGPUProfiler`) + 팬 프레임당 파생 비용이 요소 수에 **상수**       | 스케일 회귀 테스트(design §6-3)가 지목한 잔존 O(N) 지점 처리               | **통과** 2026-07-30 — 20배 규모(5,046) 갈래 A 에서 드롭 0 · 파생 0 (§"G5 종결") |

## Consequences

### Positive

- 팬/줌 프레임당 파생 재구축이 요소 수와 무관해진다 — 980 노드 기준 약 6.4ms, 9,728 노드 기준 약 66ms 회수 (추정, G5 에서 확인).
- 프레임당 최대 12.8MB 문자열 할당이 사라져 GC 압력이 준다 (미측정 부수 효과).
- `LayoutPublisherInput` 에서 미소비 필드 2개가 제거돼 계약이 실제 소비와 일치한다 — `feedback-engine-declared-but-unread-style-fields` 계열 함정 1건 해소.
- `perfMarks` 에 팬 경로 라벨이 상설화되어 이후 회귀를 즉시 관측할 수 있다 (ADR-153 인프라 재사용).
- 스케일 회귀 테스트가 생겨 "요소 수에 비례하는 프레임 비용" 이 다시 들어오면 CI 에서 잡힌다.

### Negative

- `buildSceneStructureSnapshot` 이 함수 2개로 갈라져 호출부가 늘어난다 (`BuilderCanvas.tsx` useMemo 1개 → 2개). `isVisible` 을 계약에서 빼는 안(4-1-a)을 택하면 소비자 수정이 동반된다.
- `useLayoutPublisher` 의 deps 가 배열 identity 에 의존한다는 사실이 **암묵에서 명시로** 바뀌는 대신, 그 identity 를 깨는 상류 변경(예: 새 카메라 결합 dep 추가)이 조용히 성능을 되돌릴 수 있다 — G2 카운터가 그 감시 수단이다.
- 편집 경로는 그대로 남는다. `createPageLayoutSignature` 의 O(N) 비용이 편집당 1회 유지되며, 그 판정은 design §7 로 이연된다.
