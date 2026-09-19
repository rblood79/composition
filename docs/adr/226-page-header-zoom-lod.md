# ADR-226: 페이지 헤더 DOM 층 줌 LOD — 제스처 중 프레임 집합 동결 + 헤더 폭 티어

## Status

Proposed — 2026-09-19

설계 요청: 사용자 `/create-adr 4-2 줌 LOD` (2026-09-19). 발단은 연구 문서 [PAGE_HEADER_DOM_LAYER_SCALING_2026-09.md](../explanation/research/PAGE_HEADER_DOM_LAYER_SCALING_2026-09.md) §4-1 실측 (같은 날) — "제스처 중 헤더 mount/unmount 는 실제로 돈다 (줌 1 · 50p 수평 pan 4/4 · 줌 0.1 · 200p 3 s 에 200/240) · 레이어/GPU 와 드래그 occlusion 은 V=60 에서 병목 아님 · 4-2 줌 LOD 만 착수 사유 성립 (MEDIUM · 긴급 아님)".

## Context

**SSOT 3-domain 관계**: D1/D2/D3 어느 것도 아니다 (ADR-221 과 같다). 페이지 헤더는 산출물에 없는 빌더 workspace chrome 이라 Builder↔Preview 대칭 대상이 아니고, RAC DOM 도 컴포넌트 props 도 아니다. 이 ADR 이 정하는 것은 그 chrome 층의 **부하 정책** — 뷰포트 안 페이지 수 V 가 커질 때 무엇을 마운트하고 언제 갈아끼우는가 — 다.

### 문제

ADR-221 은 카메라 제스처 중 헤더 층의 **DOM 쓰기** 를 0 으로 게이트했다 (G2 ① 22 페이지 attribute 변경 0). 그러나 배치 훅의 게이트는 쓰기만 막고, 층 컴포넌트의 입력 `visiblePageFrames` 는 제스처 중에도 `transientVisiblePageIds` 재계산으로 매 프레임 바뀐다 — 뷰포트 마진 (200 px) 을 넘나드는 페이지마다 React 가 헤더 항목 (div + 버튼 2 + span + svg 2) 을 mount/unmount 한다. 훅 주석이 이 사실을 알고 있었고 (`usePageHeaderPlacement.ts:170-174`), §4-1 이 처음으로 그 크기를 쟀다.

### 코드 사실 (2026-09-19, main `1cb5c9b5b`)

요약 — 전문은 breakdown §2 (F1~F11, 경로:라인).

- 층 입력은 컬링 결과 `visiblePageFrames`; 제스처 중 매 프레임 참조가 바뀐다 (`BuilderCanvas.tsx:641-690 · 1648`).
- 훅 게이트는 쓰기만 막는다 — mount/unmount 는 게이트 밖 (`usePageHeaderPlacement.ts:170-177`).
- 게이트 신호 `useViewportSyncStore.cameraGestureActive` 는 소비자 1 (배치 훅). settle zoom 미러는 `useViewportSyncStore.zoom` (`viewportSync.ts:17 · BuilderCanvas.tsx:425`).
- 헤더 화면 폭 = 페이지 폭 × zoom, chrome ≈ 64 px (padding + 버튼 20 ×2 + gap). breakpoint 폭 desktop 1920 · tablet 768 · mobile 390 → `minZoom` 0.1 에서 192 · 76.8 · **39 px** (`canvasBreakpoints.ts:16-18` · `ViewportController.ts:72`).
- 액션 버튼 2 는 `onPress` 미배선 ("동작 보류", `PageHeaderLayer.tsx:254-275`).

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

- **프레임 예산**: native refresh · 60 Hz floor (p95). 200p · 줌 0.1 pan 의 callback gap p95 가 before (11.8 ms) 보다 나빠지면 안 되고, settle 시점의 일괄 mount 가 25 ms 프레임을 만들면 안 된다.
- **동작 보존 3종** (ADR-221): 헤더 drag 로 페이지 이동 · shift-클릭 body 토글 · dblclick 이름 편집 — 어느 티어에서도 같다.
- **제스처 중 시각 변화 0**: 층은 `data-hidden` 이므로 동결이 보이는 결과를 바꾸면 안 되고, settle 후 헤더 집합은 항상 "뷰포트 안 페이지" 와 같아야 한다 (동결이 풀리지 않는 경로가 있으면 헤더가 사라지거나 남는다).
- **역스케일 규약**: 헤더 높이 28 · 타이틀 12px 700 은 티어 무관 (ADR-221 기하 정본 `pageHeaderGeometry.ts`).

### Soft constraints

- 액션 버튼의 의미가 확정되어 배선되면 compact 티어의 노출 방식을 그때 정한다 — 이 ADR 은 "버튼 없음" 만 정한다.
- 4K 급 뷰포트 (V ≥ 150) 는 미측정 — 이 ADR 은 그 환경의 정책 (개수 cap · hidden 티어) 을 결정하지 않고 재개 조건만 둔다.

## Alternatives Considered

### 대안 A: 줌 임계 미마운트 — `zoom < Z` 면 헤더 층을 비운다 (React Flow "zoom LOD" 그대로)

- 설명: 연구 문서 §4-2 첫 문장. settle zoom 이 임계 (예: 0.25) 아래면 `frames = []`. V 가 커지는 저줌에서 노드 0.
- 근거: React Flow `Performance` 가이드 — 저줌에서 노드 내용을 단순화/생략. tldraw — culled shape 는 placeholder.
- 위험: 기술(L) / 성능(L) / 유지보수(L) / 마이그레이션(**H** — 저줌 = 페이지를 **재배치하는** 개요 모드인데 헤더가 없으면 페이지 drag · 이름 편집 · 어느 페이지인지 식별이 전부 사라진다. Figma 는 저줌에서도 프레임 라벨과 라벨 drag 를 유지한다. 실측이 가리키는 비용 (제스처 중 churn) 은 줌 1 에서도 나므로 (50p 4/4) 줌 임계는 원인을 겨누지 않는다)

### 대안 B: 제스처 중 프레임 집합 동결 — 층은 settle 값만 받는다

- 설명: `cameraGestureActive` 동안 층 컴포넌트가 `frames` 갱신을 무시하고 마지막 settle 집합을 유지, gate-off 에 최신 집합을 1회 반영. 층은 그동안 `data-hidden` 이라 보이는 것이 없다. 배치 훅의 쓰기 게이트 (221 Decision 2) 를 mount 층까지 확장하는 것.
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

1. **제스처 중 프레임 집합 동결** — 층 컴포넌트는 `cameraGestureActive` 동안 `frames` 갱신을 무시하고 마지막 settle 집합을 유지한다. gate-off 에 최신 집합을 1회 반영하고, 그 커밋의 layoutEffect 가 새 노드를 paint 전에 배치한다 (기존 `[layerNode, frames]` 이펙트). 제스처 중 헤더 층 **mount/unmount 0** — 221 의 "DOM 쓰기 0" 이 "DOM 변경 0" 이 된다. Skia 쪽 `visiblePageFrames` 소비는 무변경.
2. **헤더 폭 티어** — `resolvePageHeaderLod(frame.width × settleZoom)`: `< 96 px` 면 `compact` (액션 버튼 미렌더 · padding 축소 · 타이틀 12px 700 유지), 아니면 `full`. 판정 입력은 settle zoom 미러와 동결된 frames 뿐이라 제스처 중 전환이 없다. 이름 편집 중인 헤더는 항상 `full`.
3. **유보 — 개수 cap · hidden 티어**: 현행 breakpoint × `minZoom` 0.1 에서 헤더 폭 최소 39 px 이라 hidden 티어 (< 24 px) 는 도달 불가, 개수 cap 은 측정 환경이 없다. 재개 조건: (a) `minZoom` 인하 또는 커스텀 폭 페이지 도입, (b) 2560 px 이상 뷰포트에서 V ≥ 150 실측 — 그때 같은 판정 함수에 티어를 더하거나 cap ADR 을 따로 쓴다.

**위험 수용 근거**: B 의 잔존 위험은 settle 프레임에 델타가 몰리는 것 하나이고, 상한은 이 창의 V=60 (최대 60 항목) 으로 닫혀 있다. 제스처 중 매 프레임 내던 비용을 사용자가 손을 뗀 settle 한 프레임으로 옮기는 것이라 (Framer 와 같은 배분), 그 프레임이 25 ms 를 넘지 않으면 (G2) 총비용은 줄고 체감은 개선된다. C 는 노드를 줄이기만 하고 미배선 버튼만 뺀다.

**기각 사유**: A — 원인 (제스처 중 churn) 이 줌 1 에서도 나므로 줌 임계는 원인을 겨누지 않고, 저줌 개요 모드에서 페이지 drag · 이름 편집 · 식별을 지운다. D — 측정된 환경이 없어 K 를 정할 근거가 없다 (measurement-validity Q1); 재개 조건으로 유보.

> 구현 상세: [226-page-header-zoom-lod-breakdown.md](design/226-page-header-zoom-lod-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                     | 심각도 | 대응                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | settle 스파이크 — gate-off 커밋에 mount/unmount 델타 (≤ V) + placeAll 2회 (구독 콜백 1 + layoutEffect 1) 가 몰려 한 프레임이 길어진다                                    |  MED   | G2: 200p · 줌 0.1 pan max ≤ 25 ms · p95 before 대비 악화 없음. 초과 시 델타를 두 커밋으로 나누지 않고 (깜빡임) 구독 콜백의 첫 placeAll 을 동결 해제 직후 skip |
| R2  | 동결 미해제 — interrupt (pointercancel · blur · 키 취소) 경로에서 `setCameraGestureActive(false)` 가 안 오면 헤더 집합이 stale 로 남는다 (221 게이트 6 지점과 같은 신호) |  MED   | G3 ①② live — 3 제스처 + interrupt 2. 신호를 새로 만들지 않고 221 게이트 신호만 읽으므로 stale 이 나면 221 게이트도 같이 stale (이미 관찰되는 결함) 이다       |
| R3  | compact 티어가 타이틀을 잘라 페이지 식별이 어렵다 (mobile 0.1 = 39 px, 글자 2~3)                                                                                         |  LOW   | 현행도 같은 폭에 버튼 2 가 들어가 타이틀 0 글자 — compact 가 순개선. 툴팁 · hover 확장은 범위 밖                                                              |
| R4  | 액션 버튼 배선 시 compact 노출 정책 부재                                                                                                                                 |  LOW   | Soft constraint — 배선 ADR 이 정한다. 이 ADR 은 "compact = 버튼 없음" 만                                                                                      |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                   | 실패 시 대안                                                          |
| ---- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| G0   | Phase 0 종료 | breakdown §2 코드 사실 표 (F1~F11) 가 HEAD 와 일치 (라인 재확인) · 병행 세션과 파일 교집합 0                                                                                                                                                                                | 표를 고친다 · 교집합 있으면 해당 커밋 대기                            |
| G1   | Phase 1 종료 | probe (제스처 창 / settle 창 분리): 200p · 줌 0.1 수평·수직 pan · 50p · 줌 1 수평 pan 각각 **제스처 창 헤더 childList 0**, settle 창 ≤ V. 원복 (identity) 시 RED                                                                                                            | 동결 경로 수리                                                        |
| G2   | Phase 1 종료 | 하니스 `--pages 200 --zoom 0.1` pan callback gap **p95 ≤ 11.8 ms (before) · max ≤ 25 ms** · 같은 세션 `--pages 22` p95 9.4 ± 0.5 (환경 대조군). 원본 JSON evidence                                                                                                          | R1 대응 (구독 콜백 첫 placeAll skip) 후 재측정 · 그래도 초과면 B 철회 |
| G3   | Phase 2 종료 | live (headed · 사용자 참관 1회): ① 휠 pan · 휠 zoom · 스페이스 pan settle 후 헤더 집합 = 뷰포트 안 페이지 ② interrupt 2 경로 뒤 헤더 복귀 ③ mobile 페이지 줌 0.1 compact / 0.3 full ④ compact 에서 drag · shift 토글 · 이름 편집 (편집 중 full) ⑤ 편집 중 pan → 편집기 유지 | 해당 경로 수리                                                        |
| G4   | Phase 3 종료 | `overlay/pageHeader/*.test.*` · `BuilderCanvas.pageHeaderLayer.static.test.ts` · type-check PASS · 원복 RED 매트릭스 (breakdown §7) 4/4                                                                                                                                     | 수리                                                                  |

### Live Exercise

(Implemented 승격 시 기재 — G3 시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분)

## Consequences

### Positive

- 제스처 중 헤더 층은 DOM 변경 0 (쓰기 0 + mount/unmount 0) — 221 의 게이트 의미론이 완결된다. 200p · 줌 0.1 pan 의 childList 440/3 s 가 0 이 되고 할당·GC 의 헤더 귀속분이 사라진다.
- 좁은 페이지 (tablet · mobile 저줌) 헤더가 타이틀을 보여준다 — 현행은 39 px 에 버튼 2 가 들어가 타이틀이 0 글자다.
- 저줌 개요 모드의 페이지 drag · 이름 편집 · 식별이 그대로 남는다 (대안 A 와의 차이).
- 영향 파일: `overlay/pageHeader/PageHeaderLayer.tsx` · `pageHeaderGeometry.ts` · `PageHeaderLayer.css` · 테스트 2 · probe 스크립트 1 (breakdown §6).

### Negative

- settle 프레임에 mount/unmount 델타가 몰린다 (R1) — G2 가 상한을 잠근다.
- 티어 하나가 늘어 헤더 시각 상태 조합이 (active · highlighted · editing) × (full · compact) 가 된다 — CSS 규칙은 티어 무관하게 두어 조합 폭발을 막는다.
- 4K 급 뷰포트의 V 폭발은 이 ADR 이 닫지 않는다 (Decision 3 유보 · 재개 조건 명시).
