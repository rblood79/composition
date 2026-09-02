# Builder 성능 기준선 2026-09 — 누수 (retention) · 프레임 (churn) 격자

> **작성일**: 2026-09-02
> **위상**: [BUILDER_FRAME_DROP_BASELINE_5K.md](./BUILDER_FRAME_DROP_BASELINE_5K.md) (07-30, 5,069 요소 실문서·visible 탭·120Hz) 이후 첫 재측정. 그 문서가 렌더 축 5k 기준선이고, 본 문서는 **재현 가능한 하니스**로 잰 누수 축 + 상호작용 부류 격자 (60·600 요소) 다. 5k 는 미측정 (§7).
> **도구**: `pnpm perf:baseline` (`apps/builder/scripts/perf-baseline.mjs`) — Playwright + CDP. dev 서버 (5173) 의 격리 프로젝트 (브라우저 컨텍스트 IndexedDB 에만 생김) 를 열고 Navigator·Properties 를 연 뒤 결정적 시드 (Text/frame 격자 + 페이지 2개).
> **관련 메모리**: `feedback-closure-context-chain-leak-interleaved-usecallback` · `feedback-panel-resize-frame-cost-canvas-subscription-gc` · `project-frame-drop-map-5k-baseline`

---

## 1. 측정 조건 — 숫자를 읽기 전에

| 항목      | 값                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 브라우저  | Chrome 152 (`channel: "chrome"`), **headless** — rAF 60Hz 고정, GPU 는 SwiftShader                                                                                  |
| 문서      | 시드 60 / 600 요소 (Text·frame 절대 배치 격자) + 페이지 2개. 실문서 아님                                                                                            |
| 패널      | Navigator · Properties 열림 (새 컨텍스트는 전부 닫힌 채 부팅되므로 하니스가 연다)                                                                                   |
| 누수 판정 | 사이클마다 `HeapProfiler.collectGarbage` ×2 후 `Performance.getMetrics` + `Runtime.getHeapUsage`; warm-up 5 제외 15 사이클의 최소제곱 기울기 + 증가 스텝 비율 ≥ 0.6 |
| 프레임    | 부류당 3초. 페이지 안 rAF 기록기 — gap 분포, 드롭 (> 25ms), `usedJSHeapSize` 양(+) 증가 합 (MB/s), GC (음 delta), longtask, `__composition_PERF__` 라벨             |

**headless 수치는 절대값이 아니다.** flush 축 (GPU) 은 부풀고 rAF 는 60Hz 로 잘린다. 같은 조건끼리의 비교 (전/후, 60 vs 600, 부류 간) 로만 읽고, 절대값·display cadence 판정은 `--headed` 로 실제 GPU 에서 다시 잰다.

## 2. 누수 (retention) — 결과

### 2-1. 첫 실행 (패널 닫힘, 60 요소, 20 사이클)

| 부류                               |  JS 힙 기울기 | Blink 힙 기울기 | 판정                                |
| ---------------------------------- | ------------: | --------------: | ----------------------------------- |
| panels (토글 4개 off→on)           |     +0.05MB/c |   **+0.24MB/c** | 후보 → dev 빌드 현상으로 판명 (2-2) |
| pages (전환 왕복)                  |     +0.01MB/c |       +0.02MB/c | ok                                  |
| select (10개 순환 선택)            |     +0.02MB/c |       +0.06MB/c | ok                                  |
| edit (편집 5·undo 5·redo 5·undo 5) | **+0.28MB/c** |   **+0.17MB/c** | **누수 → 수정 (2-3)**               |
| zoom (±10 프레임 + 팬)             |     +0.02MB/c |       +0.01MB/c | ok                                  |

DOM 노드 · CDP 리스너 · ArrayBuffer(WASM 포함) · Skia 캐시 (nodePicture 107 · paragraph 65 · paintPool 2) 는 전 부류 0 변화.

### 2-2. panels — React 19.2 dev 의 `performance.measure` 누적 (앱 누수 아님)

`--mode attribute` 스냅샷 diff 1위가 `PerformanceMeasure` +19,420개 / 2.3MB (10 사이클), retainer 는 `blink::UserTiming` 의 HeapVector, 이름은 전부 React 컴포넌트 (`ForwardRef(Tooltip)`, `ToggleButton` …). React 19.2 dev 빌드가 렌더마다 "Components ⚛" 트랙 measure 를 남기고 지우지 않는다. prod React 에는 없는 코드라 앱 누수가 아니며, 하니스는 측정 전 `performance.clearMeasures()` 로 분리한다. 개발 세션이 길면 dev 에서만 수 MB 씩 자란다 — 필요하면 dev 전용 주기 정리를 두되 우선순위는 낮다.

### 2-3. edit — V8 shared closure context 사슬 (수정 완료, 커밋 `6f843a526`)

`--mode attribute`: GC 후 살아남은 할당 1위 `canonicalNodeToElement` 1.7MB, `Object` +44,688개 = **mutation 당 요소 60개 elements view 하나 (~223 객체) 가 영구 보유**. `--mode retainers` (깊이 64): `handleKeyDown.context → scope.getElementsMap → closure.context → scope.handleCopyStyles → …` 교대 사슬.

기제: `CanvasSelectionShortcutsHost` 는 mutation 마다 재렌더된다. `elementsById` 는 즉시, `selectedElement` 는 `useDeferredValue` 라 한 렌더 늦게 바뀌어 `getElementsMap` 과 `handleCopyStyles` 가 **번갈아** 재생성됐다. 한 렌더의 클로저는 V8 context 하나를 공유하므로 memo 로 살아남은 쪽이 직전 렌더 context (그때의 `elementsById` 포함) 를, 그 context 의 다른 슬롯이 또 이전 렌더의 memo 클로저를 잡는 연결 리스트가 렌더 수만큼 자랐다. `useStyleActions` 의 인라인 `onPaste` 도 `paste → handlePasteStyles` 경로로 같은 사슬의 링크.

수정: 렌더별 값은 ref 로만 읽고 모든 핸들러 deps `[]`. 재측정 **+0.28 → +0.04MB/c** (ok), Blink 힙 0. 게이트 `CanvasSelectionShortcuts.stability.test.tsx` (번갈아 바뀌는 재렌더 12회 뒤 shortcuts 참조·keydown 등록 불변, HEAD 코드로 FAIL 확인). Live: ⌘D 복제 · Escape · ⌘A 정상.

### 2-4. 수정 후 + 패널 열림 (edit · select · panels · pages, 20 사이클)

JS 힙 기울기 edit +0.08 · select 0.00 · panels +0.02 · pages +0.02 MB/c, Blink 힙 전부 ≤ 0.05, DOM 노드·CDP 리스너 0 변화 → **잰 범위에서 누수 없음**. edit 잔여 증가는 attribute 상 JIT `(code)` (+1.36MB/10c, 정체기에 멈추는 성질) 가 대부분.

## 3. 프레임 (churn) — 결과

부류당 3초, headless 60Hz. gap 단위 ms. `stream miss` 는 commandStream 캐시 미스 (사유).

### 3-1. 60 요소

| 부류              |   gap p50 / p95 / p99 / max |    드롭% | 할당 MB/s |  GC | longtask (n / ms) | render.frame p50/p95 | 비고                        |
| ----------------- | --------------------------: | -------: | --------: | --: | ----------------: | -------------------: | --------------------------- |
| idle              |     16.7 / 17.5 / 18.1 / 18 |        0 |         2 |   0 |             0 / 0 |              0.5/0.7 |                             |
| pan               |     16.7 / 17.8 / 18.5 / 23 |        0 |       4.7 |   1 |             0 / 0 |                1/1.4 | record 4회 (집합 변경)      |
| zoom              |     16.6 / 18.5 / 23.8 / 25 |      0.6 |      29.8 |   4 |             0 / 0 |              0.6/2.8 | forced miss 30              |
| **select**        |  16.2 / **43.5** / 65 / 154 | **16.8** |  **79.2** |  16 |           2 / 147 |              0.2/0.7 | store 경로 10회/s           |
| **edit**          | 16.6 / **66.8** / 109 / 119 |      7.7 |      38.7 |   3 |      **12 / 848** |              0.2/0.8 | 편집 5회/s → 편집당 ~70ms   |
| panel-resize      |     16.7 / 17.9 / 18.3 / 21 |        0 |       7.4 |   0 |             0 / 0 |              0.4/1.3 |                             |
| page-switch       |         16.6 / 31 / 47 / 49 |      5.6 |      38.8 |   7 |             0 / 0 |              0.4/1.4 | root-signature miss 10      |
| panel-toggle      |       16.7 / 19.1 / 23 / 29 |        1 |      20.5 |   3 |             0 / 0 |              0.4/1.4 |                             |
| **layers-scroll** |       20.1 / 29.4 / 34 / 35 | **31.5** |       1.2 |   0 |             0 / 0 |              1.1/1.8 | 할당 거의 0 — JS churn 아님 |

### 3-2. 600 요소

| 부류              |  gap p50 / p95 / p99 / max |    드롭% | 할당 MB/s |  GC | longtask (n / ms) | render.frame p50/p95 | 비고                            |
| ----------------- | -------------------------: | -------: | --------: | --: | ----------------: | -------------------: | ------------------------------- |
| idle              |    16.6 / 24.5 / 25.2 / 25 |      2.8 |       4.2 |   1 |             0 / 0 |          1.8/**7.6** | 유휴인데 매 프레임 render.frame |
| pan               |    16.6 / 17.6 / 18.2 / 44 |      0.6 |       9.1 |   1 |             0 / 0 |              2.3/2.6 |                                 |
| zoom              |      16.6 / 26 / 28.6 / 37 |        6 |      48.2 |  13 |             0 / 0 |              2.5/6.7 | forced miss 31                  |
| **select**        |  **218** / 270 / 270 / 600 |  **100** | **142.7** |   0 |     **13 / 3116** |                2.8/3 | **3.9 fps — 선택 1회 ≈ 240ms**  |
| **edit**          | 16.7 / **530** / 547 / 563 |     10.4 |       113 |   3 |      **6 / 3094** |              2.4/3.7 | 편집당 ~500ms                   |
| panel-resize      |    16.6 / 17.6 / 24.5 / 33 |      0.5 |      10.9 |   1 |             0 / 0 |              2.4/2.8 |                                 |
| page-switch       |        16.5 / 40 / 80 / 87 |      9.1 |      50.3 |   8 |           4 / 274 |              2.5/4.7 |                                 |
| panel-toggle      |      16.6 / 20.8 / 27 / 28 |      3.4 |        31 |   7 |             0 / 0 |              2.5/2.7 |                                 |
| **layers-scroll** |        18 / 32.9 / 36 / 41 | **31.1** |       4.6 |   1 |             0 / 0 |              2.5/7.7 | 크기 무관 31%                   |

### 3-3. self-time 귀속 (`--profile`, JS Self-Profiling 1ms, 600 요소)

샘플 1ms, 3초. "idle" 은 스택 없는 샘플 비율 (JS 가 안 도는 시간). dev 빌드라 React DEV 오버헤드 (`logComponentRender` · `runWithFiberInDEV` · `validateProperty` · `warnUnknownProperties` · `addObjectDiffToProperties`) 가 busy 의 15~20% 를 차지한다 — prod 절대값은 `--serve-dist` (adr187 방식) 로 다시 재야 한다.

| 부류          | JS idle | self-time 상위 (앱 코드)                                                                                                               | 읽기                                                                                                                                   |
| ------------- | ------: | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| idle          |   73.1% | `perfMarks.observe` **25.6%** (busy 의 대부분)                                                                                         | 유휴 프레임 비용의 주체가 계측 자체 — §3-4                                                                                             |
| select        |    8.8% | RAC `DOMElement`·`getItem`·`getDirectChildren`·ShadowTreeWalker, `LayerTreeItemContent`, `PropertyFieldset`, `editingSemantics.*` 다수 | 선택 1회에 Navigator 트리 (RAC collection, 행 600) 와 Properties 패널이 통째로 재렌더 — O(N)                                           |
| edit          |   25.1% | `canonicalMutations.findNodeById` 0.8%, `convertToLayerTreeNodes` 0.6%, `indexedDB/adapter` 0.6%, `cssResolver.resolveStyle` 0.6%      | mutation 마다 O(N) 노드 탐색 + LayerTree 데이터 재구축 + persist + 스타일 재해석 — 07-30 진단 (동기 무효화 + persist) 그대로           |
| layers-scroll |   78.8% | `perfMarks.observe` 20.8% (나머지 거의 없음)                                                                                           | **JS 가 놀고 있는데 드롭 32%** → 스타일/레이아웃/페인트 축 (600 행 DOM 트리) 또는 스크롤이 캔버스 렌더를 깨움 (render.frame p95 9.9ms) |
| page-switch   |   35.2% | React `recursivelyTraverseMutationEffects` **20.6%**, `convertToLayerTreeNodes` 1.3%, `canonicalNodeToElement` 0.7%                    | 페이지 전환 = LayerTree 행 600 unmount/mount 커밋 비용                                                                                 |

### 3-4. 계측 자체의 비용 — `perfMarks.observe` 의 User Timing 호출

`observe()` 는 호출마다 `performance.mark` ×2 · `measure` · `clearMarks` ×2 · `clearMeasures` 를 부른다 (`perfMarks.ts` 181~205행). 프레임당 라벨이 여럿이라 프레임마다 User Timing 호출 수십 번이고, `clearMeasures(name)` 은 measure 버퍼를 훑는다 — dev 에서는 React 19.2 가 그 버퍼에 렌더마다 measure 를 쌓으므로 (§2-2) **버퍼가 클수록 매 프레임 계측 비용이 자란다**. 유휴 600 요소의 render.frame p95 7.6ms 와 self-time 25.6% 가 이것이다. 처방 후보: User Timing 방출을 명시 토글 (예: `__composition_PERF__.userTiming = true`) 뒤로 옮기고 기본은 내부 링 버퍼만 유지. dev 전용 왜곡이지만 **이 저장소의 모든 dev 실측에 섞여 있던 값**이므로 Phase 1 첫 항목.

**처방 반영 (같은 날, `perfMarks.setUserTiming` 토글 — 기본 off, 커밋 참조)**: 600 요소 headless 재측정 —

| 부류          | render.frame p50/p95 (전 → 후) | gap p95 (전 → 후) | 드롭% (전 → 후) | JS idle (전 → 후) |
| ------------- | -----------------------------: | ----------------: | --------------: | ----------------: |
| idle          |          1.8/7.6 → **0.2/0.3** |       24.5 → 17.5 |         2.8 → 0 |       73.1 → 99.6 |
| layers-scroll |              2.5/9.9 → 0.2/0.4 |       32.9 → 28.7 |     31.1 → 31.7 |       78.8 → 98.1 |
| select        |                  2.8/3 → 0.6/1 |         266 → 336 |       100 → 100 |          8.8 → 11 |

유휴 프레임 비용의 대부분이 계측이었다 (프레임당 ~1.6ms, dev measure 버퍼에 비례). layers-scroll 은 JS 가 98% 놀면서도 드롭 32% 그대로 → **DOM 축 확정**. select 는 변화 없음 → 계측이 아니라 렌더 fan-out. §3-2 표의 `render.frame` 열은 토글 전 값이라 이만큼 부풀어 있다 (gap·드롭·longtask 는 그대로 유효).

## 4. 판정 — 07-30 레버 5종과의 대조

| 순위 | 축                                        | 근거 (본 문서)                                                     | 07-30 레버                                                                                                                                                                                        |
| ---: | ----------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|    1 | **선택 변경 fan-out**                     | 600 요소에서 선택 1회 ≈ 240ms · 143 MB/s. 60 요소에서도 드롭 16.8% | (없음 — ADR-155 이후 잔여) → **ADR-203** Proposed 2026-09-02: 패널 A/B (navigator 만 236.6 ms · properties 만 16.7 ms · 없음 16.7 ms) 로 Navigator 트리 단독 확정, 처방 = RAC Virtualizer 창 렌더 |
|    2 | **편집 mutation (동기 무효화 + persist)** | 편집당 60→70ms, 600→500ms. 문서 크기 선형                          | 레버 4·5                                                                                                                                                                                          |
|    3 | **Layers 트리 스크롤**                    | 크기 무관 드롭 31%, 할당 ~0 → DOM 레이아웃/페인트                  | (없음)                                                                                                                                                                                            |
|    4 | 페이지 전환                               | 600 에서 p99 80ms, longtask 4/274                                  | (없음)                                                                                                                                                                                            |
|    5 | 줌                                        | 600 에서 드롭 6% (5k 는 07-30 p50 133ms — 미재측정)                | 레버 1·2                                                                                                                                                                                          |
|    — | 유휴 600 요소 render.frame p95 7.6        | 유휴에 매 프레임 렌더 — 무엇이 무효화하는지 확인 필요              | ADR-167 기각 전제 재확인                                                                                                                                                                          |

07-30 의 팬 상수 비용 (레버 3) 은 60·600 요소 headless 에서 드롭 0 — 5k 에서만 보이는 축이므로 5k 재측정 전까지 순위 보류.

## 5. 측정 함정 (신규 — 재측정 시 회피)

1. **새 컨텍스트는 패널이 전부 닫혀 부팅된다** (toggle 전부 `aria-pressed=false`, splitter 0). 열지 않으면 패널 비용이 통째로 빠지고 리사이즈 드라이버가 못 돈다. 첫 leak 실행이 이 상태였다 (2-1).
2. **React 19.2 dev 의 `performance.measure` 누적** (2-2) — 측정 전 `clearMeasures`. React 이름의 measure 가 상위면 앱 누수가 아니다.
3. **retainer BFS 깊이** — 사슬형 누수는 12 로 부족 (샘플 30개 중 28개 "경로 없음"), 64 로. 스냅샷 class 이름 `system / Context / scope @N` 의 N 은 함수 위치라 같은 라벨이 반복돼도 서로 다른 렌더의 context 다.
4. **probe 리스너 net 은 영속 target 만** — 요소 target 은 unmount 로 노드와 함께 죽어 `removeEventListener` 없이 사라지므로 net 이 계속 자라 오판한다 (CDP `JSEventListeners`/`Nodes` 평평). window/document 만 net, 요소는 누적 등록 수로만.
5. **memo 컴포넌트 재렌더 게이트** — 같은 props 로 `root.render` 를 반복하면 bailout 이라 아무것도 검증하지 않는다. 구독 값을 external store 로 바꿔 컴포넌트 안에서 재렌더를 일으킨다 (`CanvasSelectionShortcuts.stability.test.tsx`).
6. **단축키 live 검증은 캔버스 컨테이너에 포커스** (`[data-canvas-container="true"]`) — 캔버스 클릭만으로는 `canvas-focused` scope 가 안 잡혀 ⌘D/Escape/⌘A 가 조용히 무동작 (대조군 HEAD 도 동일 → 프로브 문제로 판독).
7. **dashboard 마크업은 5월 스크립트와 다르다** — `button.dashboard-create-button` → `#new-project-name` → Enter. dev base 는 `/` (adr187 의 `/composition` 은 prod dist).
8. **하니스 파일을 prettier 가 재포맷하면 문자열 치환 패치가 조용히 빗나간다** — 인자 파서 패치가 빠져 `--classes`/`--duration-ms` 가 무시된 채 9부류 전부 3초로 돌았다. 패치 후 인자 반영을 한 줄 실행으로 확인.

## 6. 재현

```bash
pnpm perf:baseline -- --lane leak --cycles 20 --warmup 5 --seed-count 60          # 누수 격자
pnpm perf:baseline -- --lane leak --mode attribute --actions edit                  # GC 후 살아남은 할당 스택 + 스냅샷 diff
pnpm perf:baseline -- --lane leak --mode retainers --actions edit \
  --retainer-class Object --retainer-props parent_id,page_id                       # 최단 retainer 경로
pnpm perf:baseline -- --lane frame --seed-count 600 --duration-ms 3000 [--profile] # 프레임 격자 (+ self-time)
pnpm perf:baseline -- --lane frame --headed ...                                    # 실제 GPU · display cadence
```

결과 JSON: `/private/tmp/perf-baseline/`. 기존 프로젝트로 재면 `--project-url`.

## 7. 미측정 잔여

- 5k 실문서 (07-30 기준선의 재현) — 시드 5k 는 4분+ 라 persistent 컨텍스트 (`launchPersistentContext`) 로 1회 시드 후 재사용하는 옵션이 필요.
- headed (실제 GPU·120Hz) 절대값.
- 실 포인터 요소 드래그 (합성 드래그 함정: 메모리 `reference-synthetic-pointer-drag-testing-traps`), 인스펙터 타이핑, 다이얼로그·팝오버, 미리보기 토글, 30분 soak.
- 선택 부류는 store 경로 (`setSelectedElement`) 라 hit-test 비용이 빠져 있다 — 실 클릭 경로는 더 무겁다.
