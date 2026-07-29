# ADR-173 구현 상세 — 제스처 중 재래스터 이연

> 본 문서는 [ADR-173](../173-gesture-raster-deferral.md) 의 구현 상세다. 결정·대안·위험은 ADR 본문 참조.

## 1. 관점 점검 — fork checkpoint 4 질문 lock-in

ADR-172 범위 경계표(축 ②·③ 이연)의 후속 제안이므로 adr-writing.md §fork checkpoint 를 통과한다. 사용자 confirm: 2026-07-30 AskUserQuestion "새 ADR 작성 후 구현 (권장)" 선택.

1. **base/응용 분류**: ADR-172(파생 계층 — React memo/JS 조립)와 본 ADR(래스터 계층 — surface 무효화 정책)은 **직교 계층**이며 base/응용 관계가 아니다. ADR-172 완료는 본 ADR 의 **측정 전제**였을 뿐이다 (파생 소음 제거 후 재래스터 축이 드러남).
2. **schema 직교성**: 본 ADR 은 스키마 무변경 — 무효화 정책과 컬링 반경 상수만 다룬다.
3. **선행 ADR 전제 reverse 검증**: ADR-172 의 축 ③ 이연 사유("재래스터는 빈도가 낮다")는 G5 실측(60프레임 중 35회)으로 **반증 확인 후** 출발한다 — 자동 승계가 아니라 반증이 출발점이다.
4. **codex 리뷰를 미루지 않음**: 본문 작성 직후 리뷰 진입.

## 2. Phase 0 — inventory (일부 2026-07-30 선행 확정)

### 2-1. 이미 확정된 사실

| 항목                           | 값                                                                                  | 근거                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 컬링 반경                      | `DEFAULT_MARGIN = 200` (화면 px)                                                    | `scene/buildVisiblePageSet.ts:7`                           |
| 캐시 패딩                      | `contentPaddingCssPx = 512`                                                         | `skia/SkiaRenderer.ts:70`                                  |
| 스트림 루트 = 가시 페이지 한정 | `visiblePageIds` 밖 페이지는 스트림에 없음                                          | `skia/visiblePageRoots.ts:18-24`                           |
| 렌더러 분류는 이미 Pen 모델    | camera-only blit / zoom×3 / coverage-refresh / 200ms cleanup                        | `SkiaRenderer.ts:216-240` (`classify`, 주석 "Pencil 모델") |
| 상류 강제 격상 지점 2곳        | `visibleContentVersion` / `visiblePagePositionVersion` 변경 → `invalidateContent()` | `SkiaCanvas.tsx:622-646`                                   |
| 커맨드 스트림 강제 무효화      | `useEffect([rendererInput])` → `invalidateCommandStreamCache()`                     | `SkiaCanvas.tsx:267`, `skiaTreeBuilder.ts:117`             |
| 팬 제스처 신호 존재            | `isPanningRef` (버튼 팬) — wheel 팬은 명시 종료 이벤트 없음                         | `viewport/useViewportControl.ts:81,236,249`                |
| 페이지 경계 사건 밀도          | zoom 0.176 에서 페이지 간격 ≈ 화면 79px — 기하 조건(512px)의 **~6.5배** 빈도        | 2026-07-30 실측 (ADR-172 §G5 종결)                         |
| 재래스터 1회 비용              | 65.1ms @5,046 요소 (21× 스케일)                                                     | 〃                                                         |

### 2-2. 잔여 inventory (Phase 1 진입 전)

- [x] `visibleContentVersion` / `visiblePagePositionVersion` **소비자 전수** — `invalidateContent` 외 소비처 (ADR-136 sceneVersion signature 포함) 와 이연 시 부작용 판정
- [x] `visiblePageIds` 소비자 전수 — 스트림 루트 외 (레이아웃 발행 `pages` 구성, hit-test, 패널 등). 반경 확대 시 각 소비자의 정상 상태 작업량 증가 실측
- [x] 반경 200 → 512 시 가시 페이지 수 변화 실측 (대표 줌 3점: 1.0 / 0.5 / 0.176) — 재래스터 1회 비용과 layout publish 대상 증가 폭
- [x] wheel 팬 경로의 활성/종료 판정 재료 확인 (`useViewportControl` wheel 분기 — debounce 타이머 필요 여부)
- [x] 편집 유발 무효화 경로 분리 가능성 — `visibleContentVersion` 입력 중 `contentVersion`(콘텐츠) 축과 가시 집합(카메라) 축의 분리 지점 (`resolveSceneVisibility` 의 key 구성)
- [x] **R7 처방 판정 (리뷰 round 1 MED)** — **(a) freeze 채택** (§2-3 B). 선택지 (b) 반경 확대 사전 발행은 경계 통과 빈도가 반경과 무관해 단독으로 부족함이 실측으로 확인됐다 (§2-3 C).

### 2-3. inventory 결과 (2026-07-30 — Phase 0 완료)

#### A. 무효화 격상 지점은 5곳이고, **전부 `sceneVisibility` 한 곳의 하류**다

```
resolveSceneVisibility            BuilderCanvas.tsx:489-497
 → sceneVisibility.key            :505          ← snapshot identity 를 정하는 유일 입력
 → sceneStructureSnapshot         :506-510
 → sceneSnapshot                  :516
 ├→ visiblePageIds :518 → visiblePages :519 → layoutPublisherInputs :525 → useLayoutPublisher :641   ⑤ R7 (15ms)
 └→ skiaRendererInput deps :677 → rendererInput
      └→ SkiaCanvas useEffect([rendererInput]) :267-278
           → invalidateCommandStreamCache() + invalidateContent()                                     ① 즉시 격상
 SkiaCanvas RAF :623-631  visibleContentVersion ref 비교        → invalidateContent()                  ②
 SkiaCanvas RAF :633-642  visiblePagePositionVersion ref 비교   → invalidateContent() + stale 3프레임  ③
 SkiaCanvas    :466-467   visiblePagePositionVersion → buildSkiaFrameContent(pagePosVersion)
                          = 커맨드 스트림 5중 캐시 키                                                  ④
 composeSceneStructureSnapshot :283-290  sceneVersion 해시 입력 (ADR-136 계약)
```

- **ADR 본문이 지목한 `SkiaCanvas.tsx:622-646` 은 5곳 중 ②③ 두 곳**이다. 더 상류인 ①(`useEffect([rendererInput])`)이 스트림과 surface 를 **동시에** 격상시키므로, 개별 게이트 방식은 최소 5곳을 각각 손봐야 한다.
- `visiblePageIds` 의 다른 소비자는 스트림 루트(`skia/visiblePageRoots.ts:18-24`)뿐 — 히트 판정은 스트림 산출물(hitBoundsMap)이라 간접이다. `visibleContentVersion`/`visiblePagePositionVersion` 의 비-테스트 소비자는 위 ①~④ + sceneVersion 이 전부다 (grep 전수).

#### B. R7 처방 판정 — **(a) 카메라 유발 가시 집합 갱신 freeze 채택**

1. **한 게이트가 5곳을 흡수한다**. (b) 반경 확대 사전 발행은 ①~⑤ 중 무엇도 막지 못한다 — 경계 통과 사건 자체가 반경과 무관하기 때문이다 (아래 C 실측).
2. **축 분리가 부산물로 따라온다**. 게이트 판정을 "`sceneStructureCore` identity 불변 + 카메라만 변경" 으로 두면, 편집은 core 를 바꾸므로 게이트를 그대로 통과해 즉시 반영된다 → **R1/HC2 자동 충족**. visibility key 를 카메라/콘텐츠 축으로 **분해할 필요가 없어** signature 입력 목록이 무변경 → **R5 소멸 · HC4 자동 충족**.
3. **R6 도 소멸**한다 — 스트림과 surface 는 둘 다 같은 `rendererInput` 에서 나오므로 한 지점 freeze 로 같은 세대에 멈춘다.

#### C. 반경 200 → 512 실측 (19페이지 · 470 간격 · 390×844 · 컨테이너 1800×884, pan 전 구간 10px 스윕)

| zoom  | 가시 페이지 avg (200) | avg (512) |  증가 | 경계 사건 (200) | (512) |
| ----- | --------------------: | --------: | ----: | --------------: | ----: |
| 1.0   |                  4.60 |      5.64 | ×1.23 |              36 |    34 |
| 0.5   |                  7.26 |      8.95 | ×1.23 |              36 |    32 |
| 0.176 |                 12.62 |     15.26 | ×1.21 |              32 |    24 |

- **R2 폭 확정: 정상 상태 작업량 +21~23%** (줌 3점에서 일정).
- 경계 사건 수는 반경과 거의 무관 — 사건 수를 정하는 것은 **페이지 개수**(19 × 진입/이탈 ≈ 36)이지 경계 위치가 아니다. 대안 C 기각 근거의 정량 재확인.

#### D. 제스처 신호 — 소스별 분기 불요, **store 단일 깔때기**

- 모든 카메라 변경이 `ViewportController.setOnStateSync(handleStateSync)` → `useViewportSyncStore.setViewportSnapshot` 한 곳을 지난다 (`useViewportControl.ts:107-126`). 버튼 팬·wheel 팬·줌·프로그램 이동 전부 포함.
- `BuilderCanvas` 는 같은 store 를 구독한다 (`:330-331`) — 카메라가 바뀌면 이미 리렌더 중이라 신호 state 추가 비용이 없다.
- wheel 은 종료 이벤트가 없지만 `isZoomingRef`/`zoomEndTimeoutRef` debounce 선례가 이미 있다 (`useViewportControl.ts:84-85`). 신호를 `isPanningRef` 가 아니라 **store 변경 debounce** 로 잡으면 소스별 분기가 사라진다.

#### E. R4 안전판의 실효 범위 정정

freeze 중에는 `coverage-refresh` 가 발동해도 **그릴 내용이 freeze 된 가시 집합**이라 새로 진입한 페이지는 채워지지 않는다. 안전판이 회복하는 것은 "이미 가시 집합에 있던 페이지의 커버리지/품질" 뿐이며, 새 페이지의 공백은 제스처 종료(≤200ms) 후에 메워진다 (G4 가 시한 관리). Pen 도 제스처 중 새 콘텐츠를 그리지 않으므로 동형이다.

## 3. Phase 1 — 컬링 기준면 정합 (레버 ①: 공백 제거)

- `DEFAULT_MARGIN` 을 독립 상수에서 **캐시 패딩 파생 단일 소스**로 전환 — `contentPaddingCssPx` 와 같은 값을 참조 (또는 공용 상수 모듈로 승격 후 양쪽이 참조).
- 효과: content surface 의 512px 패딩 영역이 실제 콘텐츠로 채워진다 — 512px 이내 이동은 blit 만으로 공백 없이 완결.
- 트레이드오프: 정상 상태 가시 페이지 수 증가 (Phase 0 실측으로 폭 확정). 재래스터 1회 비용·layout publish 대상이 함께 는다 — Phase 3 의 시점 이연이 상쇄 전제.

## 4. Phase 2 — 무효화 사유 분리 (카메라 vs 콘텐츠)

Phase 0 판정(§2-3 B)에 따라 **분리 지점은 `visibleContentVersion` key 의 분해가 아니라 `sceneVisibility` 재계산 게이트**다. key 를 분해하지 않으므로 ADR-136 signature 입력 목록은 무변경이다 (HC4).

- `BuilderCanvas.tsx:489-497` 의 `sceneVisibility` useMemo 에 게이트를 도입한다:
  - **콘텐츠 유발** (`sceneStructureCore` identity 변경 = 편집/레이아웃): 게이트를 그대로 통과 — **즉시** 재계산 (현행과 동일).
  - **카메라 유발** (core 는 그대로이고 `panOffset`/`zoom`/`containerSize` 만 변경): 게이트가 활성이면 **직전 visibility 를 그대로 반환**한다.
- 게이트 활성 신호는 이 phase 에서 **주입 파라미터로만** 정의하고 기본값은 비활성 — 동작 변화 0. 실제 배선은 Phase 3.
- 무효화 **사유 분류 표가 이미 코드에 있다** — `skia/renderInvalidation.ts:38-52` (reason: content/viewport/layout/…). 카메라 유발 이연 사유는 이 표의 확장으로 기록한다 (신규 분류 체계 창설 금지).
- **Hard Constraint 2 의 거처**: 편집 즉시성은 "core identity 가 바뀌면 반드시 통과" 라는 게이트 판정의 정확성에 달려 있다 (R1). 계약 테스트로 고정한다 — core 가 바뀌면 게이트 활성 여부와 무관하게 새 visibility 를 반환.

## 5. Phase 3 — 제스처 중 카메라 유발 재래스터 이연 (레버 ②+③)

- 제스처 활성 신호는 **`useViewportSyncStore` 변경 debounce** 하나로 잡는다 (§2-3 D) — 버튼 팬·wheel 팬·줌·프로그램 이동이 모두 그 store 를 지나므로 소스별 분기가 없다. Pen 동형 200ms (`SkiaRenderer.scheduleCleanupRender` 와 같은 값).
- 신호가 활성인 동안 Phase 2 의 게이트가 닫히고, 그 결과 하류 5곳(§2-3 A ①~⑤)이 **한꺼번에** 이연된다 — 소비자별 pending 플래그가 필요 없다. 제스처 중 재래스터 사유는 `SkiaRenderer.classify` 의 기하 조건(zoom×3 / coverage-refresh)만 남는다.
- 신호가 만료되면 게이트가 열리고 visibility 가 재계산되어 snapshot identity 가 바뀐다 → layout publish → 스트림 재구축 → 1회 재래스터가 **자연 순서대로** 일어난다. 별도 flush 경로를 만들지 않는다.
- 만료 트리거는 리렌더를 유발해야 하므로 신호는 ref 가 아니라 state 다. 카메라 변경 시점에는 이미 `BuilderCanvas` 가 리렌더 중이라(§2-3 D) 추가 비용이 없다.
- coverage 안전판의 실효 범위는 §2-3 E 대로 "이미 가시 집합에 있던 페이지" 한정 — 새 페이지 공백의 복구 시한은 G4 가 관리한다.

## 6. Phase 4 — 재측정 + 잔여 판정

- ADR-172 G5 종결 절의 갈래 A/B 벤치를 **동일 조건**(5,046 요소 문서 — 측정용 요소 유지 결정)으로 재실행.
- Gate 통과 후에도 제스처 종료 재래스터 1회(65ms 급)가 체감 hiccup 으로 남으면 — **비용 축**(content Picture 캐시 / 모션 중 `makeImageSnapshot` 생략, 2026-07-27 분해 실측 레버 ①②) 을 별도 판정. 본 ADR 범위 밖 (memory `project-render-frame-decomposition-flush-vs-js` 참조).

## 7. 파일 변경 요약

| 파일                             | Phase | 성격                                                        |
| -------------------------------- | ----- | ----------------------------------------------------------- |
| `scene/buildVisiblePageSet.ts`   | 1     | 반경 상수 단일 소스화                                       |
| `skia/SkiaRenderer.ts`           | 1     | 패딩 상수 공유 (단일 소스 export 또는 공용 모듈 참조)       |
| `BuilderCanvas.tsx`              | 2, 3  | `sceneVisibility` 게이트 도입 + 제스처 신호 배선            |
| `skia/renderInvalidation.ts`     | 2     | 사유 분류 표 확장 (카메라 유발 이연 기록)                   |
| 제스처 신호 훅 (신설)            | 3     | `useViewportSyncStore` 변경 debounce → 활성 state           |
| 벤치/테스트                      | 2, 4  | 게이트 계약 테스트 + 갈래 A/B 재실행                        |

Phase 1 → 2 → 3 순서 강제 (3 의 신호 배선은 2 의 게이트를 전제, 1 의 반경 정합 없이는 3 이 공백을 키운다). Phase 4 는 종결 게이트.

`scene/buildSceneSnapshot.ts` 는 Phase 0 판정으로 **변경 대상에서 빠졌다** — visibility key 를 분해하지 않기 때문이다 (§2-3 B-2).

## 8. 재현 절차 (측정)

ADR-172 §G5 종결과 동일 — `window.__composition_PERF__` 라벨 3종 + `window.__composition_CACHE_METRICS__` + 갈래 A(가시 집합 불변 팬)/갈래 B(±600 화면px 팬) 벤치. 줌 벤치는 visible 창 필요. 측정용 요소 4,800개(bench-\* prefix)는 문서에 유지되어 있다.
