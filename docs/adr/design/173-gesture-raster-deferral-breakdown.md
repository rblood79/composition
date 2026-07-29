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

- [ ] `visibleContentVersion` / `visiblePagePositionVersion` **소비자 전수** — `invalidateContent` 외 소비처 (ADR-136 sceneVersion signature 포함) 와 이연 시 부작용 판정
- [ ] `visiblePageIds` 소비자 전수 — 스트림 루트 외 (레이아웃 발행 `pages` 구성, hit-test, 패널 등). 반경 확대 시 각 소비자의 정상 상태 작업량 증가 실측
- [ ] 반경 200 → 512 시 가시 페이지 수 변화 실측 (대표 줌 3점: 1.0 / 0.5 / 0.176) — 재래스터 1회 비용과 layout publish 대상 증가 폭
- [ ] wheel 팬 경로의 활성/종료 판정 재료 확인 (`useViewportControl` wheel 분기 — debounce 타이머 필요 여부)
- [ ] 편집 유발 무효화 경로 분리 가능성 — `visibleContentVersion` 입력 중 `contentVersion`(콘텐츠) 축과 가시 집합(카메라) 축의 분리 지점 (`resolveSceneVisibility` 의 key 구성)

## 3. Phase 1 — 컬링 기준면 정합 (레버 ①: 공백 제거)

- `DEFAULT_MARGIN` 을 독립 상수에서 **캐시 패딩 파생 단일 소스**로 전환 — `contentPaddingCssPx` 와 같은 값을 참조 (또는 공용 상수 모듈로 승격 후 양쪽이 참조).
- 효과: content surface 의 512px 패딩 영역이 실제 콘텐츠로 채워진다 — 512px 이내 이동은 blit 만으로 공백 없이 완결.
- 트레이드오프: 정상 상태 가시 페이지 수 증가 (Phase 0 실측으로 폭 확정). 재래스터 1회 비용·layout publish 대상이 함께 는다 — Phase 3 의 시점 이연이 상쇄 전제.

## 4. Phase 2 — 무효화 사유 분리 (카메라 vs 콘텐츠)

- `SkiaCanvas` 의 `invalidateContent()` 트리거를 두 축으로 분리:
  - **콘텐츠 유발** (페이지 `contentVersion` 변경 = 편집): **즉시** — 현행 유지
  - **카메라 유발** (가시 집합 진입/이탈만으로 인한 version 변경): Phase 3 의 이연 대상
- 분리 지점은 `resolveSceneVisibility` 의 key 구성 — `visibleContentVersion` 을 "가시 페이지 id 집합" 과 "가시 페이지들의 contentVersion 합" 으로 나누면 두 축이 독립 감지된다.
- **Hard Constraint 2 의 거처**: 편집 즉시성은 이 분리의 정확성에 달려 있다 (R1).

## 5. Phase 3 — 제스처 중 카메라 유발 재래스터 이연 (레버 ②+③)

- 제스처 활성 판정: 버튼 팬 = `isPanningRef` / wheel 팬·줌 = 마지막 카메라 변경 후 debounce 타이머 (Pen 200ms 동형 — `scheduleCleanupRender` 재사용 검토).
- 제스처 활성 중 카메라 유발 무효화는 **pending 플래그**로만 기록하고 발화하지 않는다 — `SkiaRenderer.classify` 의 기하 조건(zoom×3 / coverage-refresh)이 유일한 제스처 중 재래스터 사유가 된다 (안전판 — 512px 초과 고속 이동 시 공백 방치 방지).
- 제스처 종료(또는 debounce 만료) 시 pending 이 있으면 1회 재래스터 + 커맨드 스트림 재구축.
- `useEffect([rendererInput])` 의 `invalidateCommandStreamCache()` 도 같은 이연 게이트를 공유 — 스트림과 surface 의 무효화 시점이 갈리면 안 된다 (ADR-172 Phase 1.5 와 같은 원칙).

## 6. Phase 4 — 재측정 + 잔여 판정

- ADR-172 G5 종결 절의 갈래 A/B 벤치를 **동일 조건**(5,046 요소 문서 — 측정용 요소 유지 결정)으로 재실행.
- Gate 통과 후에도 제스처 종료 재래스터 1회(65ms 급)가 체감 hiccup 으로 남으면 — **비용 축**(content Picture 캐시 / 모션 중 `makeImageSnapshot` 생략, 2026-07-27 분해 실측 레버 ①②) 을 별도 판정. 본 ADR 범위 밖 (memory `project-render-frame-decomposition-flush-vs-js` 참조).

## 7. 파일 변경 요약

| 파일                             | Phase | 성격                                      |
| -------------------------------- | ----- | ----------------------------------------- |
| `scene/buildVisiblePageSet.ts`   | 1     | 반경 상수 단일 소스화                     |
| `skia/SkiaRenderer.ts`           | 1, 3  | 패딩 상수 공유 · 이연 게이트              |
| `scene/buildSceneSnapshot.ts`    | 2     | visibility key 의 카메라/콘텐츠 축 분리   |
| `skia/SkiaCanvas.tsx`            | 2, 3  | 무효화 트리거 분리 + pending 이연         |
| `viewport/useViewportControl.ts` | 3     | 제스처 활성 신호 노출 (필요 시)           |
| 벤치/테스트                      | 4     | 갈래 A/B 재실행 + 무효화 정책 계약 테스트 |

Phase 1 → 2 → 3 순서 강제 (3 의 이연은 2 의 사유 분리를 전제, 1 의 반경 정합 없이는 3 이 공백을 키운다). Phase 4 는 종결 게이트.

## 8. 재현 절차 (측정)

ADR-172 §G5 종결과 동일 — `window.__composition_PERF__` 라벨 3종 + `window.__composition_CACHE_METRICS__` + 갈래 A(가시 집합 불변 팬)/갈래 B(±600 화면px 팬) 벤치. 줌 벤치는 visible 창 필요. 측정용 요소 4,800개(bench-\* prefix)는 문서에 유지되어 있다.
