# ADR-226: 페이지 헤더 DOM 층 줌 LOD — 제스처 중 프레임 집합 동결 + 헤더 폭 티어

## Status

Accepted — 2026-09-19 (Proposed 09-19 → [reviews/226.md](reviews/226.md) round 1 HIGH 1 · MEDIUM 3 · LOW 3 전부 fixed → round 2 수리 검증 VERIFIED FIXED 7/7 · 신규 LOW 1 deferred (settle 순서 — Phase 2 흡수) → 사용자 승격 지시. 구현은 미착수)

설계 요청: 사용자 `/create-adr 4-2 줌 LOD` (2026-09-19). 발단은 연구 문서 [PAGE_HEADER_DOM_LAYER_SCALING_2026-09.md](../explanation/research/PAGE_HEADER_DOM_LAYER_SCALING_2026-09.md) §4-1 실측 (같은 날) — "제스처 중 헤더 mount/unmount 는 실제로 돈다 (줌 1 · 50p 수평 pan 4/4 · 줌 0.1 · 200p 3 s 에 200/240) · 레이어/GPU 와 드래그 occlusion 은 V=60 에서 병목 아님 · 4-2 줌 LOD 만 착수 사유 성립 (MEDIUM · 긴급 아님)".

## Context

**SSOT 3-domain 관계**: D1/D2/D3 어느 것도 아니다 (ADR-221 과 같다). 페이지 헤더는 산출물에 없는 빌더 workspace chrome 이라 Builder↔Preview 대칭 대상이 아니고, RAC DOM 도 컴포넌트 props 도 아니다. 이 ADR 이 정하는 것은 그 chrome 층의 **부하 정책** — 뷰포트 안 페이지 수 V 가 커질 때 무엇을 마운트하고 언제 갈아끼우는가 — 다.

### 문제

ADR-221 은 카메라 제스처 중 헤더 층의 **DOM 쓰기** 를 0 으로 게이트했다 (G2 ① 22 페이지 attribute 변경 0). 그러나 배치 훅의 게이트는 쓰기만 막고, 층 컴포넌트의 입력 `visiblePageFrames` 는 제스처 중에도 `transientVisiblePageIds` 재계산으로 매 프레임 바뀐다 — 뷰포트 마진 (200 px) 을 넘나드는 페이지마다 React 가 헤더 항목 (div + 버튼 2 + span + svg 2) 을 mount/unmount 한다. 훅 주석이 이 사실을 알고 있었고 (`usePageHeaderPlacement.ts:170-174`), §4-1 이 처음으로 그 크기를 쟀다.

### 코드 사실 (2026-09-19, main `1cb5c9b5b`)

요약 — 전문은 breakdown §2 (F1~F12, 경로:라인).

- 층 입력은 컬링 결과 `visiblePageFrames`; 제스처 중 매 프레임 참조가 바뀐다 (`BuilderCanvas.tsx:641-690 · 1648`).
- 훅 게이트는 쓰기만 막는다 — mount/unmount 는 게이트 밖 (`usePageHeaderPlacement.ts:170-177`).
- 게이트 신호 `useViewportSyncStore.cameraGestureActive` 는 소비자 1 (배치 훅). settle zoom 미러는 `useViewportSyncStore.zoom` (`viewportSync.ts:17 · BuilderCanvas.tsx:425`).
- 헤더 화면 폭 = 페이지 폭 × zoom, chrome ≈ 64 px (padding + 버튼 20 ×2 + gap). breakpoint 폭 desktop 1920 · tablet 768 · mobile 390 → `minZoom` 0.1 에서 192 · 76.8 · **39 px** (`canvasBreakpoints.ts:16-18` · `ViewportController.ts:72`).
- 액션 버튼 2 는 `onPress` 미배선 ("동작 보류", `PageHeaderLayer.tsx:254-275`).
- 현행 타이틀은 12px · 600, 이름 편집 input 만 700 이다 (`PageHeaderLayer.css:44-57 · 141-150`). pointer pan effect cleanup 은 진행 중 session 을 finish 하지만 `onInteractionEnd` 를 호출하지 않는다 (`useViewportControl.ts:275-285`).

### 실측 (§4-1, 2026-09-19 · headed · 1440×900 · 같은 세션)

| 항목                                                    | 22p · 줌 0.1 (V=22) |  200p · 줌 0.1 (V=60) | 50p · 줌 1 (V=1) |
| ------------------------------------------------------- | ------------------: | --------------------: | ---------------: |
| 하니스 pan — callback gap p95 / render.frame p95 / 할당 | 9.4 / 1.3 ms / 49.7 | 11.8 / 2.1 ms / 100.2 |        9.3 / 1.1 |
| 수평 휠 pan 3 s — 헤더 mount / unmount                  |             76 / 95 |             200 / 240 |        **4 / 4** |
| 합성 레이어 총 / 헤더 귀속 / 헤더 텍스처                |    47 / 21 / 1.2 MB |      73 / 47 / 2.7 MB |           27 / 1 |
| 드래그 — 헤더 style 쓰기 per move / placement self-time |         4.0 / 1.9 % |           4.0 / 0.7 % |              1.0 |

- V 는 문서 크기가 아니라 뷰포트 × 줌 하한이 정한다 — 이 창에서 상한 60. 4K 급 뷰포트면 V 가 N 에 닿는다 (미측정).
- 깨지는 시나리오는 없다 (25 ms 초과 프레임 0 · longtask 0 · 119 fps). 120 Hz 1 vsync (8.3 ms) 는 22p 에서도 p95 가 이미 넘으므로 회귀선이 아니라 누적선 — **MEDIUM**.
- 레이어 · GPU · 드래그 occlusion 은 착수 사유 없음 (연구 문서 4-3 · 4-4 기각).

### Hard constraints

- **프레임 예산**: visible headed · native refresh ≥ 60 Hz. 200p · 줌 0.1 pan 의 **제스처 창** callback gap p95 는 같은 세션 identity 원복 arm 보다 0.5 ms 넘게 나빠지면 안 되고, `cameraGestureActive=false` 부터 2 rAF 까지의 **settle 창** callback/RAF gap max 는 25 ms 이하여야 한다. 11.8 ms 는 2026-09-19의 120 Hz 역사 기준선이지 다른 refresh 환경의 절대 통과선이 아니다.
- **동작 보존 3종** (ADR-221): 헤더 drag 로 페이지 이동 · shift-클릭 body 토글 · dblclick 이름 편집 — 어느 티어에서도 같다.
- **제스처 중 시각 변화 0**: 층은 `data-hidden` 이므로 동결이 보이는 결과를 바꾸면 안 되고, settle 후 헤더 집합은 항상 "뷰포트 안 페이지" 와 같아야 한다 (동결이 풀리지 않는 경로가 있으면 헤더가 사라지거나 남는다).
- **역스케일 규약**: 헤더 높이 28 · 일반 타이틀 12px 600 · 이름 편집 input 700 은 티어 무관 (현행 `pageHeaderGeometry.ts` · `PageHeaderLayer.css`). ADR-221 breakdown 의 일반 타이틀 700 서술은 현행 코드와 다르므로 이 ADR 에서 암묵 복구하지 않는다.

### Soft constraints

- 액션 버튼의 의미가 확정되어 배선되면 compact 티어의 노출 방식을 그때 정한다 — 이 ADR 은 "버튼 없음" 만 정한다.
- 4K 급 뷰포트 (V ≥ 150) 는 미측정 — 이 ADR 은 그 환경의 정책 (개수 cap · hidden 티어) 을 결정하지 않고 재개 조건만 둔다.

## Alternatives Considered

### 대안 A: 줌 임계 미마운트 — `zoom < Z` 면 헤더 층을 비운다

- 설명: 연구 문서 §4-2 첫 문장. settle zoom 이 임계 (예: 0.25) 아래면 `frames = []`. V 가 커지는 저줌에서 노드 0.
- 근거: React Flow 공식 가이드는 빈번히 바뀌는 node 배열 구독 회피 · 큰 트리 hidden · 복잡한 style 단순화를 권하지만 **저줌 미마운트를 직접 규정하지 않는다**. tldraw 는 viewport 밖 shape 를 DOM 에 남긴 채 `display:none` 으로 컬링하고 선택/편집 shape 는 제외하며, zoom 중 안정값을 쓰는 `debouncedZoom` 과 `textShadowLod` 를 제공한다. 따라서 A 는 두 도구의 공식 계약을 그대로 옮긴 안이 아니라 이 캔버스에 대한 추론적 변형이다.
- 위험: 기술(L) / 성능(L) / 유지보수(L) / 마이그레이션(**H** — 저줌 = 페이지를 **재배치하는** 개요 모드인데 헤더가 없으면 페이지 drag · 이름 편집 · 어느 페이지인지 식별이 전부 사라진다. Figma 저줌 라벨/drag 는 2026-09-19 수동 관찰이며 공식 API 계약으로 인용하지 않는다. 실측이 가리키는 비용 (제스처 중 churn) 은 줌 1 에서도 나므로 (50p 4/4) 줌 임계는 원인을 겨누지 않는다)

### 대안 B: 제스처 중 프레임 집합 동결 — 층은 settle 값만 받는다

- 설명: `cameraGestureActive` 동안 층 컴포넌트가 `frames` 갱신을 무시하고 마지막 settle 집합을 유지한다. gate-off 구독 콜백은 층을 계속 숨기고, React 가 최신 집합을 커밋한 layoutEffect 에서 새 노드를 1회 배치한 뒤에만 `data-hidden` 을 제거한다. 배치 훅의 쓰기 게이트 (221 Decision 2) 를 mount 층까지 확장하는 것.
- 근거: 실측이 겨눈 비용 그 자체 (제스처 중 childList 200/240 → 0). Framer 관찰 (221 출처) — 제스처 중 헤더는 없고 종료 후 나타난다 — 와 같은 의미론.
- 위험: 기술(L — 신호는 이미 있고 소비자만 추가) / 성능(**M** — settle 에 mount/unmount 델타가 한 커밋에 몰린다: V=60 이면 최대 60 항목 × 6 노드. 제스처 중에 나눠 내던 비용을 한 프레임에 모으는 것이라 settle 프레임 스파이크 가능 → G2) / 유지보수(L) / 마이그레이션(L — 동결이 안 풀리는 경로 (interrupt) 는 221 게이트와 같은 신호라 같은 경로 수로 닫힌다)

### 대안 C: 헤더 폭 티어 — 화면 폭이 chrome 을 못 담으면 compact (타이틀 띠만)

- 설명: `frame.width × settleZoom < 96 px` 면 액션 버튼 2 를 렌더하지 않고 padding 을 줄인다 (`data-lod="compact"`). 노드는 유지 → drag · 이름 편집 · 식별 보존. 판정은 settle zoom 으로만 하므로 제스처 중 티어 전환 0.
- 근거: Figma 라벨 = 프레임 폭에 잘리는 텍스트, 폭이 없으면 텍스트만. 현행 mobile 390 × 0.1 = 39 px 는 chrome 64 px 보다 좁아 **지금도** 버튼이 타이틀을 밀어내는 상태 (실측 헤더 sample `w 240 / h 56` 은 desktop).
- 위험: 기술(L) / 성능(L — 노드 6 → 2, 저줌 좁은 페이지에서만) / 유지보수(L — 티어 1개 · 순수 함수 1개) / 마이그레이션(L — 버튼은 미배선이라 기능 손실 0)

### 대안 D: 개수 cap — V > K 면 페인트 순서 상위 K 개만 마운트

- 설명: 4K 뷰포트에서 V 가 수백이 되는 경우의 안전판. 활성/근접 K 개만 헤더.
- 위험: 기술(M — "어느 K" 의 규칙이 필요) / 성능(L) / 유지보수(M) / 마이그레이션(**H** — 측정된 환경이 없다 (이 창 상한 60). K 를 정할 근거가 없고, cap 밖 페이지는 헤더가 없어 A 와 같은 UX 손실을 부분적으로 낸다 — measurement-validity Q1)

### Risk Threshold Check

| 대안 | HIGH+                      | 판정                                             |
| ---- | -------------------------- | ------------------------------------------------ |
| A    | 마이그레이션 H (UX 손실)   | 기각 — 원인을 안 겨누고 개요 모드 동작을 지운다  |
| B    | 없음 (성능 M → G2)         | **채택**                                         |
| C    | 없음                       | **채택** (B 와 직교 — 노드 수 · 좁은 페이지 축)  |
| D    | 마이그레이션 H (근거 없음) | 유보 — 재개 조건 (V ≥ 150 실측) 을 Decision 3 에 |

루프 0회: HIGH 가 남는 대안은 기각/유보이고 채택 대안 B·C 에 HIGH 없음.

## Decision

**대안 B + C 채택, D 유보.** ADR-221 의 4 규칙은 그대로 두고 두 규칙을 더한다:

1. **제스처 중 프레임 집합 동결 + commit-before-reveal** — 층 컴포넌트는 `cameraGestureActive` 동안 `frames` 갱신을 무시하고 마지막 settle 집합을 유지한다. gate-off 구독 콜백은 `data-hidden` 을 제거하거나 구 노드를 배치하지 않는다. React 가 최신 집합을 커밋한 layoutEffect 가 새 노드를 1회 배치하고 최종 page id/transform 을 확인할 수 있는 상태에서 `data-hidden` 을 제거한다. 제스처 중 헤더 층 **mount/unmount 0**, settle reveal 전 최신 집합 배치 — 221 의 "DOM 쓰기 0" 이 "DOM 변경 0" 으로 완결된다. Skia 쪽 `visiblePageFrames` 소비는 무변경.
2. **헤더 폭 티어** — `resolvePageHeaderLod(frame.width × settleZoom)`: `< 96 px` 면 `compact` (액션 버튼 미렌더 · padding 축소 · 일반 타이틀 12px 600 유지), 아니면 `full`. 판정 입력은 settle zoom 미러와 동결된 frames 뿐이라 제스처 중 전환이 없다. 이름 편집 중인 헤더는 항상 `full` 이고 input 700 을 유지한다.
3. **유보 — 개수 cap · hidden 티어**: 현행 breakpoint × `minZoom` 0.1 에서 헤더 폭 최소 39 px 이라 hidden 티어 (< 24 px) 는 도달 불가, 개수 cap 은 측정 환경이 없다. 재개 조건: (a) `minZoom` 인하 또는 커스텀 폭 페이지 도입, (b) 2560 px 이상 뷰포트에서 V ≥ 150 실측 — 그때 같은 판정 함수에 티어를 더하거나 cap ADR 을 따로 쓴다.

**위험 수용 근거**: B 의 잔존 위험은 settle 프레임에 델타가 몰리는 것 하나이고, 상한은 이 창의 V=60 (최대 60 항목) 으로 닫혀 있다. 제스처 중 매 프레임 내던 비용을 사용자가 손을 뗀 settle 한 프레임으로 옮기는 것이라 (Framer 와 같은 배분), 그 프레임이 25 ms 를 넘지 않으면 (G2) 총비용은 줄고 체감은 개선된다. C 는 노드를 줄이기만 하고 미배선 버튼만 뺀다.

**기각 사유**: A — 원인 (제스처 중 churn) 이 줌 1 에서도 나므로 줌 임계는 원인을 겨누지 않고, 저줌 개요 모드에서 페이지 drag · 이름 편집 · 식별을 지운다. D — 측정된 환경이 없어 K 를 정할 근거가 없다 (measurement-validity Q1); 재개 조건으로 유보.

> 구현 상세: [226-page-header-zoom-lod-breakdown.md](design/226-page-header-zoom-lod-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                              | 심각도 | 대응                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | settle 스파이크 — gate-off 커밋에 mount/unmount 델타 (≤ V) + 최신 집합 `placeAll` 1회가 몰려 한 프레임이 길어진다                                                                 |  MED   | G2: gesture/settle 측정 창 분리 · identity 원복 A/B · settle max ≤ 25 ms. 초과 시 B 철회 또는 별도 점진 reveal 설계 재판정                |
| R2  | 동결 미해제 — pointercancel · blur/visibility hidden · pointer pan 중 control unmount 경로에서 `setCameraGestureActive(false)` 가 안 오면 헤더 집합과 숨김 상태가 stale 로 남는다 |  MED   | Phase 1 에 pointer cleanup 의 `onInteractionEnd` 누락 수리. G3 ② live/unit 으로 interrupt 4경로 뒤 store false · 최신 집합 · visible 확인 |
| R3  | compact 티어가 타이틀을 잘라 페이지 식별이 어렵다 (mobile 0.1 = 39 px, 글자 2~3)                                                                                                  |  LOW   | 현행도 같은 폭에 버튼 2 가 들어가 타이틀 0 글자 — compact 가 순개선. 툴팁 · hover 확장은 범위 밖                                          |
| R4  | 액션 버튼 배선 시 compact 노출 정책 부재                                                                                                                                          |  LOW   | Soft constraint — 배선 ADR 이 정한다. 이 ADR 은 "compact = 버튼 없음" 만                                                                  |
| R5  | gate-off 구독이 React 최신 집합 커밋보다 먼저 층을 표시하면 한 paint 동안 구 집합·무배치 새 노드가 보인다                                                                         |  MED   | Decision 1 의 commit-before-reveal. G1 은 최신 page id와 transform 설정 뒤 `data-hidden` 제거 순서를 MutationObserver + 2 rAF 로 판정     |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                | 실패 시 대안                                          |
| ---- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| G0   | Phase 0 종료 | breakdown §2 코드 사실 표 (F1~F12) 가 HEAD 와 일치 (라인 재확인) · 병행 세션과 파일 교집합 0                                                                                                                                                                                                                                                                                                                                             | 표를 고친다 · 교집합 있으면 해당 커밋 대기            |
| G1   | Phase 1 종료 | probe (제스처 창 / settle 창 분리): 200p · 줌 0.1 수평·수직 pan · 50p · 줌 1 수평 pan 각각 **제스처 창 헤더 childList 0**. settle 창은 child delta ≤ V, 최종 page id 집합 = 뷰포트 집합, 모든 transform 설정 뒤 `data-hidden` 제거, 이후 2 rAF 동안 추가 childList 0. identity 원복 및 premature-reveal 원복 시 RED                                                                                                                      | 동결/reveal handshake 수리                            |
| G2   | Phase 1 종료 | visible headed · native refresh/DPR/visibility 기록 · `--fixed-inputs`. 같은 기기·20분 안 identity 원복 A/B 각 3회: 200p · 줌 0.1 **gesture 창** callback gap p95 의 중앙값 B ≤ A + 0.5 ms, `cameraGestureActive=false` 부터 2 rAF 까지 **settle 창** callback/RAF gap max ≤ 25 ms · longtask 0. 22p A/B p95 차이 절댓값 ≤ 0.5 ms 를 환경 대조군으로 함께 저장. recorder 는 gate-off + 2 rAF 뒤 정지                                     | 25 ms 초과면 B 철회 또는 별도 점진 reveal 설계 재판정 |
| G3   | Phase 2 종료 | live (headed · 사용자 참관 1회): ① 휠 pan · 휠 zoom · 스페이스 pan settle 후 헤더 집합 = 뷰포트 안 페이지 ② pointercancel · blur · visibility hidden · pointer pan 중 control unmount/remount 뒤 store false, 헤더 visible·최신 집합 ③ mobile 페이지 줌 0.1 compact / 0.3 full ④ compact 에서 drag · shift 토글 · 이름 편집 (편집 중 full) ⑤ 편집 페이지가 200px 가시 마진 안에 남는 pan 은 편집기 유지, 마진 밖 settle 은 현행대로 닫힘 | 해당 경로 수리                                        |
| G4   | Phase 3 종료 | `overlay/pageHeader/*.test.*` · `viewport/useViewportControl*.test.*` · `BuilderCanvas.pageHeaderLayer.static.test.ts` · type-check PASS · 일반 타이틀 600/편집 input 700 정적 계약 · 원복 RED 매트릭스 (breakdown §7) 7/7                                                                                                                                                                                                               | 수리                                                  |

### Live Exercise

(Implemented 승격 시 기재 — G3 시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분)

## Consequences

### Positive

- 제스처 중 헤더 층은 DOM 변경 0 (쓰기 0 + mount/unmount 0) — 221 의 게이트 의미론이 완결된다. 200p · 줌 0.1 pan 의 childList 440/3 s 가 0 이 되고 할당·GC 의 헤더 귀속분이 사라진다.
- 좁은 페이지 (tablet · mobile 저줌) 헤더가 타이틀을 보여준다 — 현행은 39 px 에 버튼 2 가 들어가 타이틀이 0 글자다.
- 저줌 개요 모드의 페이지 drag · 이름 편집 · 식별이 그대로 남는다 (대안 A 와의 차이).
- 영향 파일: page header 층 4파일 + viewport cleanup 1파일/인접 테스트 + 성능 하니스/probe 2파일 + 문서 (총 ≤12, breakdown §6).

### Negative

- settle 프레임에 mount/unmount 델타가 몰린다 (R1) — gate-off 뒤 2 rAF 까지 포함하는 G2 가 상한을 잠근다.
- 티어 하나가 늘어 헤더 시각 상태 조합이 (active · highlighted · editing) × (full · compact) 가 된다 — CSS 규칙은 티어 무관하게 두어 조합 폭발을 막는다.
- 4K 급 뷰포트의 V 폭발은 이 ADR 이 닫지 않는다 (Decision 3 유보 · 재개 조건 명시).
