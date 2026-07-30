# Builder 프레임 드랍 기준선 — 5,069 요소 실문서 실측

> **작성일**: 2026-07-30
> **측정 조건**: live builder (dev, visible 탭, 120Hz), 5,069 요소 / 23 페이지 문서 (`bench-*` 필러 0건 — persist 전수 확인), Page 22 활성, 코드 = ADR-172 착수 직전 원복 상태 (`61a191b35` 동등, revert `64cad5432` 이후)
> **방법**: `canvas.dispatchEvent(WheelEvent)` 로 실핸들러에 프레임당 1 이벤트 주입 + rAF gap 기록 + `__composition_PERF__` 라벨 분해 + `__composition_CACHE_METRICS__` + JS Self-Profiling API 귀속. MCP `left_click_drag` 합성 팬의 무동작 함정(`project-mutation-cost-scales-with-document-size` §측정 함정) 회피.
> **위상**: ADR-172/173 되돌림(2026-07-30) 후 재진입용 기준선. 172/173 문서 안의 수치는 필러 5,046 문서(+반경 512)에서 잰 오염값이므로 **본 문서가 대체 기준선**이다.
> **관련 메모리**: `project-frame-drop-map-5k-baseline` · `feedback-perf-gate-favorable-case-only-measurement`

---

## 1. 경로별 실측 결과

| 경로                                    | frame gap                             | 스트림 캐시                                  | 분해                                                                     |
| --------------------------------------- | ------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| 유휴 (360f)                             | p50 8.3ms · 드롭 0                    | 히트 100%                                    | `render.frame` 0.7ms · `content.build` **0.6ms/f 상시**                  |
| **팬 — 가시 집합 불변** (무선택, 60f)   | **p50 16.6ms** · 16.7 초과 21/60      | 미스 0                                       | 렌더 본문 0.1ms — 나머지 전부 **React 축 상수 비용**                     |
| **팬 — 가시 집합 변경** (무선택)        | p50 26~66ms · **스파이크 115~183ms**  | `forced` 미스 (집합 변경 이벤트마다)         | 재기록 `record.content` 21.8~72ms                                        |
| **스크롤** (스크롤 요소 선택 + 세로 휠) | p50 24.9ms · **매 프레임** 재기록     | `registry` 미스 60/60                        | scrollBy 1회 → `notifyLayoutChange()` → 전역 재구축                      |
| **줌 오실레이션** (±30, 96f)            | **p50 132.9ms (~7.5fps) · max 550ms** | `forced` 60 + contentSurface `invalidate` 60 | `record.content` **p50 109.5ms** · nodePicture **히트 8 / cold 287,116** |
| style 편집 1회                          | sync 17~24ms + 비동기 persist         | —                                            | 합계 **205ms / garbage 35MB** (전문서 재작성 ×2 — 병렬 세션 5회 실측)    |

프로파일 귀속 (팬 중 busy 샘플 105개): `layoutCache`(시그니처 해싱) **~40%** + `useLayoutPublisher` **~18%** + `renderCommands`/`skiaFramePipeline`(재구축·재기록) **~13%**.

## 2. 구조 진단 — 요소 수가 프레임을 무너뜨리는 4개 경로

1. **무효화 단위가 전역이다.** `registryVersion` 1 bump = 커맨드 스트림 전체 폐기 (`renderCommands.ts` 5중 키). 레지스트리에는 비가시 페이지 포함 **4,969 노드가 전역 등록**되어 있어, 요소 1개의 스크롤 1px(`useSkiaNode.registerSkiaNode` 재등록)이 전체 재구축 + 가시 영역 전체 재기록을 유발한다.
2. **줌아웃은 가시 집합 ≈ 전 문서로 만든다.** 재기록이 O(전체 N) 이 되는데(109.5ms), 이때 기댈 노드 Picture 캐시(ADR-153 Phase 3)가 줌 중 **적중 8 / cold 287,116** — 사실상 0%. 벡터 Picture 는 CTM 재생이 가능함에도 줌 틱마다 전량 재기록된다 (cold 원인 미규명 — 재진입 시 규명 대상). "요소 많은 문서에서 줌아웃해 둘러보기"가 최악 경로(7.5fps)인 이유.
3. **팬 프레임마다 React 축이 깨어난다.** 카메라 변경 → rAF 당 1 커밋 → `createPageLayoutSignature` 해싱 + `useLayoutPublisher` 가 상수 실행. 가시 집합이 안 바뀌어도 8~16ms — 이것만으로 120Hz 예산(8.3ms)의 2배다. ADR-172 P-1/P-2 진단과 일치.
4. **편집은 렌더가 아니라 mutation 경로다.** 동기 20ms + 비동기 전문서 직렬화·clone persist 2경로 = 205ms/35MB. 문서 크기에 선형 (상세: memory `project-mutation-cost-scales-with-document-size`).

## 3. ADR-172/173 재평가 (본 기준선 기준)

| 항목                             | 판정                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 172 진단 (P-1~P-3 React 축 비용) | **정합** — 깨끗한 문서에서 재확인 (팬 상수 8~16ms, 프로파일 40%+18%). 실패는 측정 설계(유리한 경우만)와 범위("그것만"), 병목 지목이 아니었다        |
| 173 P5 (content Picture replay)  | **방향 정합** — 줌 병목의 지배 축이 재기록(walk)임이 재확인. 죽인 것은 반경 확대(P1)와의 결합. 단독 재평가 가치 있음 — 반경 확대 재시도 금지는 유지 |
| 173 P1 (컬링 반경 200→512)       | **기각 유지** — 비용/적중률 거래를 정합으로 오판 (`feedback-perf-gate-favorable-case-only-measurement`)                                             |
| 172 축 ③ 이연 ("빈도 낮음")      | **기각 확정** — 집합 변경 팬·줌 모두에서 재기록이 지배                                                                                              |

**실패 층 분해 (2026-07-30 추가)** — "진단이 맞았는데 왜 버그만 났나"의 답은 층이 다르다:

| 층                          | 판정   | 귀결                                                                                                     |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| 진단 (어디가 느린가)        | 정합   | 본 기준선 재측정으로 재확인 (팬 상수 8~16ms · 줌 재기록 109.5ms 지배)                                    |
| 설계 (무엇을 어떻게 고치나) | 결함 2 | ① 173 P1 거래 오판 → **유일한 실버그** (텍스트 소실, §8) ② 172 축 ③ 배제 → 지배 축을 안 고쳐 체감 이득 0 |
| 검증 (게이트)               | 결함   | 유리한 경우만 측정 (팬+집합 불변+필러 문서, 총비용 미측정) → 위 두 결함을 **모두 통과**시킴              |

극단 사례: 173 P1 검증 기록의 `layout publish 14→17 (×1.21 예측 일치)` 는 **비용 증가**인데 "예측 일치"를 통과 근거로 썼다 (`feedback-perf-gate-favorable-case-only-measurement`).

## 4. 부수 발견 (렌더 성능 외)

- **`activatePage()` 가 page body 를 자동 선택한다** → 선택된 스크롤 가능 요소가 있으면 `useViewportControl` Phase E 가 휠을 독점 (scrollBy 라우팅, 여유 없으면 no-op). 사용자가 페이지를 활성화한 직후의 세로 휠은 캔버스 팬이 아니라 **페이지 내부 스크롤**이 되고, 그 스크롤이 위 registry storm 을 태운다. UX 정책과 성능이 얽힌 지점.
- **`useScrollWheelInteraction`(무선택 호버 휠 스크롤) 은 실이벤트에서 도달 불가로 보인다** — viewport wheel 핸들러(capture)가 팬/줌 분기 모두에서 `stopPropagation()` 하므로 bubble 리스너가 스킵된다. 선택 시엔 Phase E 가 대신 처리해 증상이 가려짐. 별도 확인 필요 (dead listener 의심).

## 5. 측정 함정 3종 (재측정 시 필수 회피)

1. **Phase E 휠 삼킴**: 스크롤 가능 요소 선택 상태에서 휠 dispatch 는 스크롤 여유가 없으면 **완전 no-op** — "팬이 완벽히 부드럽다"는 무동작 측정일 수 있다. 팬 측정 전 `clearSelection()` + 카메라 실이동을 스크린샷으로 확증할 것.
2. **at-target dispatch 이중 라우팅**: containerEl 에 직접 dispatch 하면 capture(viewport)+bubble(scroll hook) 이 둘 다 발화한다 (`stopPropagation` 은 같은 노드의 이후 방문만 차단). 실전파 재현은 **target=canvas** 로.
3. **상태 누적**: 프로브가 카메라/스크롤/줌을 누적시켜 다음 프로브의 가시 집합·재기록 비용을 바꾼다. 프로브 간 정착 대기 + 상태 명시.

## 6. 개선 레버 (측정 근거 우선순위)

| #   | 레버                                                        | 회수 기대                                | 근거                             |
| --- | ----------------------------------------------------------- | ---------------------------------------- | -------------------------------- |
| 1   | content Picture replay (줌·집합 변경 축) — 반경 정책 무변경 | 줌 133ms → ~20ms 급                      | §1 줌 행 + 173 P5 실측 계보      |
| 2   | nodePicture 줌 중 cold 원인 규명·수리                       | 재기록 자체 감소                         | 히트 8/287k                      |
| 3   | React 축 상수 제거 (P-1 memo + P-2 카메라 분리 재도입)      | 팬 프레임 -8~16ms                        | §1 팬 불변 행 + 프로파일 40%+18% |
| 4   | 무효화 국소화 (registry bump → 서브트리/페이지 단위)        | 스크롤·단일 요소 변경의 전역 재기록 제거 | §2-1                             |
| 5   | mutation persist 단일화                                     | 편집 205ms → 수십 ms                     | §2-4                             |

레버 간 순서 제약: 1·2 가 재기록 비용을 줄이면 4 의 긴급도가 내려간다 (전역 무효화가 싸지므로). 3 은 독립. 검증 게이트에는 **최적화가 이득을 못 보는 경로 1개 이상**(집합 변경 팬 / 실편집)과 **프레임 총비용**을 반드시 포함할 것 — `feedback-perf-gate-favorable-case-only-measurement` 의 세 실패를 게이트 설계로 재생산하지 않는다.

## 7. 재현 절차 (요약)

1. 시드 문서(23p/5,069 요소, 시드 경로: memory `reference-bulk-seeding-live-builder-via-page-context`) 로드, visible 탭 확보.
2. `clearSelection()` 후 대상 페이지 `activatePage()` — **활성화가 body 를 재선택하므로 다시 `clearSelection()`**.
3. 하니스: rAF 루프에서 프레임당 `canvas.dispatchEvent(new WheelEvent("wheel", { deltaY, clientX/Y: 캔버스 중심, bubbles: true, cancelable: true, [shiftKey|ctrlKey] }))` + gap 기록. 각 phase 전 `__composition_PERF__.reset()` / `__composition_CACHE_METRICS__.reset()`.
4. phase: 유휴 → 팬 소진폭(집합 불변) → 팬 지속(집합 변경) → 줌 오실레이션(ctrlKey ±30) → 편집(`updateSelectedStyle` + 원복).
5. 판독: gap 분포 + `render.skia.record.content` + `commandStream.missReasons` (`forced`=input identity / `registry`=재등록) + nodePicture hit/cold.

## 8. 잠재 결함 — paragraph 캐시 문턱과 텍스트 소실 (되돌림 후에도 잔존, 2026-07-30 추가)

ADR-172/173 되돌림은 "P1 반경 확대가 문턱을 넘게 한 원인"을 제거한 것이지, **문턱 자체를 제거한 것이 아니다**. 소실 버그의 성립 조건은 지금 main 에도 그대로 있다.

### 기제 — 2단으로 갈라진다

1. **스래싱 (성능)**: 한 프레임 walk 에서 그리는 텍스트(paragraph) 수 > 전역 LRU 상한 **1,000** → 프레임마다 전량 퇴거·재생성.
2. **글리프 소실 (버그)**: 퇴거가 **프레임 도중** 일어나며 즉시 WASM `.delete()` → 해제된 힙 주소를 같은 프레임의 새 paragraph 가 재사용 → CanvasKit(Ganesh) 텍스트 blob 캐시가 그 주소를 키로 stale 히트 → `drawParagraph` 는 실행되는데 글리프만 조용히 소실.

**문턱 변수는 요소 총수가 아니라 walk 당 가시 텍스트 draw 수**다. 요소 총수는 줌아웃(가시 ≈ 전 문서)을 경유해서만 문턱에 관여한다 — 컬링 반경 200 에서도 텍스트 밀도가 높은 큰 문서를 줌아웃하면 넘을 수 있다.

### 실측 경계

| 조건                                              | walk 당 텍스트 | 결과                                              |
| ------------------------------------------------- | -------------- | ------------------------------------------------- |
| 반경 512 (ADR-173 P1) + 5,046 요소                | 1,416          | **재현** (`49d71dbd3` 격리)                       |
| 반경 200 + 5,046 요소 + 줌 15% 왕복 (되돌림 검증) | < 1,000 추정   | 미재현 — 단 그 문서·그 줌 한정 사실이지 보증 아님 |

### 현행 main 상태 (2026-07-30 확인)

- 상한 고정 1,000 복귀: `nodeRendererState.ts:20` (env `VITE_PARAGRAPH_CACHE_SIZE` 로만 override — 임시 완화 노브)
- 퇴거 시 즉시 delete 복귀: `nodeRendererText.ts:85`
- `deferredDisposal.ts` 부재 — 처치 커밋 `49d71dbd3` (동적 상한 + flush 후 지연 폐기) 이 "증상 처치"로 분류되어 전량 되돌림에 포함됐기 때문

### Pen 대조 — 성립 조건 자체가 없는 구조 (상세: PEN 분석 문서 §3-4-1)

Pen 은 ① paragraph 수명 = 노드 수명 (전역 LRU/상한/퇴거 0건 — 프레임 중 사용 객체 delete 경로 부재) ② 일반 렌더는 `paragraph.getPath()` → Path fill (`drawParagraph` 는 PDF export 전용 — Ganesh blob 캐시 미경유) ③ 제스처 중 surface blit 으로 텍스트 draw ≈ 0. 세 층이 각각 스래싱 문턱·blob stale·프레임당 draw 수를 구조적으로 제거한다.

### 수리 후보 (착수는 사용자 판정)

| 후보                                                                  | 성격                                                                                          | 규모 |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---- |
| **폐기 지연 단독 재도입** (flush 후 delete — `49d71dbd3` 의 절반)     | 성능 최적화가 아니라 use-after-free 계열 수명 결함의 수리. 구조 무변경으로 소실 기제만 끊는다 | 소   |
| retained 전환 (paragraph 수명을 노드/registry entry 에 묶기 — Pen 형) | 전역 LRU 폐지. 단 composition 은 전 페이지 4,969 노드 전역 등록 — **메모리 축 검토 선행**     | 중   |
