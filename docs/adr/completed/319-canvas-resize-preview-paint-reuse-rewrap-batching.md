# ADR-319: Canvas 크기 미리보기 비용 — 칠 해석 재사용 · 줄바꿈 계산 묶기 · 측정 문단 재사용

## Status

Implemented — 2026-11-26 (Phase 0 ~ 4 · 사용자 결정 1 = 「한계로 기록하고 닫기」). 이전: Accepted — 2026-11-26 (사용자 `/execute-adr 319` + [reviews/319.md](../reviews/319.md) round 3 설계 승인 가능 · pending 0 · HIGH 전부 fixed) · Proposed — 2026-11-26.

> **Phase 4 — 2026-11-26 (G4 · 사용자 결정 1)** ([breakdown §9](../design/319-canvas-resize-preview-paint-reuse-rewrap-batching-breakdown.md)): production A/B 교대 3 쌍 (dist `c0d76012d` ↔ 같은 HEAD + 이 변경, headed Chrome). **기술 판정**: 다른 문장 1,000 · 1x p95 60.1 ~ 75.1 → 17.1 ~ 21.1 ms · LoAF 309 → 1 (끌기 시작의 첫 측정 한 번 ≈ 100 ms) · 다른 문장 1,000 · 4x p95 300 ~ 321 → 81 ~ 84 · p99 359 → 81 ms (LoAF 309 그대로 — 매 프레임) · 같은 문장 1,000 · 4x p99 60 ~ 79 → 41 ~ 50 · LoAF 309 → 230 ~ 293 (pair 3 은 화면 cadence 가 8.3 ms 로 바뀐 뒤라 17) · 300 · 4x LoAF 3 ~ 4 → 0 ~ 2 (Publish DOM 쪽 4x 에도 ≈ 60 ms 한 번이 있다) · 0 글자 회귀 없음. CPU 프로필 (같은 dist, 교대 3 쌍): `paintedNodeData` 826 → 388 ms (G1 −53 %) · 측정 원천 17,500 → 2,450 ms (G3 −86 %) · `rewrap` 의 측정 · 엔진 밖 몫 같은 문장 771 → 404 (−48 %) · 다른 문장 1,412 → 862 ms (**G2 −39 % — 목표 40 % 미달 1 %p**, 남은 몫의 절반이 측정 캐시의 Map 연산 — 호출 60 만 번 × 약 0.6 µs, 키 문자열 재사용 시도는 브라우저에서 이득 0 이라 되돌림). Canvas 그림 = 같은 환경 base ↔ new 스크린샷 0 px. 번들 Builder initial gzip +1,250 B (1,637,725). **절대 기준 미달** — 1,000 · 4x (두 벌) 는 엔진 · Skia · 줄 나누기 몫이 남아 두 프레임 이상, 다른 문장 1,000 · 1x 는 첫 측정 LoAF 1. 사용자 결정 1 = **「한계로 기록하고 닫기」** (대안 C 는 열지 않음). 결정적 호출 수 ratchet (커밋 `39b277f95` 뒤): 판정 unmeasurable · 등급 A 초과 101 — 319 직전 `bdbf0a71a` 도 99 · block 이라 초과는 319 전부터의 상태이고, 시드별 원 측정값의 증감은 ±1 ~ 3 % (ratchet 시드에 무거운 크기 끌기가 없다). `--update` 는 하지 않음 (R5 — breakdown §9).

> **Phase 0 ~ 3 — 2026-11-26** ([breakdown §9](../design/319-canvas-resize-preview-paint-reuse-rewrap-batching-breakdown.md)): 문단 재사용 시제품 **go** (11,077 비교 불일치 0 · 폭 바뀜에 layout 만 = 새 문단의 13 ~ 15 %). 끌기 한 번 (글자 60 · 폭 10) 의 결정적 카운트 HEAD → 수정: 칠 해석 2,475 → 30 · wasm 조회 702 → 53 · applied style 파싱 682 → 190 · 측정 키 직렬화 1,440 → 120. 칠 oracle (등록 = 메모 우회 독립 계산) · 줄 oracle (HEAD 스냅샷 — 부모 줄 높이 미리보기 · 가상 격자 · 달력 · RichText) GREEN. 원복 RED 6/7 (메모 키 revision 은 재현 시나리오 없음 — 방어 키, LOW deferred). 측정 문단 보유: 글자 편집 512 회 보유 0 · 끌기 중 ≤ leaf 수 · 닫는 경우마다 보유 0 · 만든 = 지운.

- 사용자 요청 (2026-11-26): 「권장하는 개선 방안으로 1 · 2 를 별도 새ADR로 작업으로 진행.」 — 같은 대화의 측정 보고에서 제안한 세 방안 중 1 (칠 결과 재사용) · 2 (줄바꿈 계산 정리) 를 이 ADR 로 묶는다. 3 (끄는 동안 줄바꿈 미루기) 은 범위 밖이다.
- 방향을 정한 사용자 원문 (같은 날): 「내용이 많은 Panel 에서 끄는 느낌이 무거울지가 걱정이다. 측정후 문제가 된다면 개선 방안을 제시해줘」.
- ADR-318 (Resizable) 에서 시작한 측정이지만 원인은 모든 Canvas 크기 조절 미리보기가 지나는 공용 경로다 — 318 범위에 넣지 않고 새 ADR 로 둔다 (사용자 지시한 분리).

> **리뷰 round 1 반영 — 2026-11-26** ([reviews/319.md](../reviews/319.md), HIGH 3 · MEDIUM 3 — 사용자가 판독을 붙여 넣음):
> H1 줄 높이 상속 — leaf 기억의 키에 조상에서 온 계산된 줄 높이를 넣고, 칠 메모도 조상 입력을 키에 넣거나 record 고유 입력만 메모한다 · G2 에 부모 미리보기 · 원복 시나리오.
> H2 칠 비교 — G1 oracle 을 「메모를 우회한 독립 계산의 실제 칠 값 (`SkiaNodeData` 전체) 비교」 로 바꾸고 세 조건 (정상 메모 = GREEN · 키 하나 누락 = RED · 메모 끔 = 호출 수 상한 RED) 을 구분. 같은 root 를 쓰는 `rebuild` 서명은 oracle 에서 뺌.
> H3 Publish 표본 — 하니스가 매 표본 시작 크기를 되돌리고 (Canvas undo · Publish 다시 열기) 손잡이 좌표를 다시 구하며, 시작 크기가 다르거나 끝 크기가 같은 표본을 버린다. 기준선을 다시 쟀다 (아래 실측 — dist 식별자 포함).
> M1 측정 캐시 — 다른 문장 fixture (`TEXTS=distinct`) 를 더하고 키 직렬화와 측정 원천 호출을 따로 센다 (Phase 0).
> M2 묶음 조회량 — 다음 중간 `computeLayout` 전까지 소비할 구간만 읽는다 (후보마다 한 번 · wasm 호출 = 구간 수). G2 에 wasm 호출 수와 요청 handle 총합.
> M3 판정 — 어느 칸이든 p95 초과 **또는** LoAF 잔존이면 「절대 기준 미달」 로 기록하고 사용자 결정 1 로 연결. 기술 통과와 사용자 수용을 따로 적는다.

> **범위 넓힘 — 2026-11-26 (사용자 답, 결정 지점 4)**: 기준선을 다시 재니 글자마다 문장이 다른 경우 비용의 약 85 % 가 측정 원천 (문단 shaping) 이었다 (아래 실측). 질문 「범위를 어떻게 할까요?」 에 사용자 답 = 「319 에 문단 재사용 추가 (Recommended)」 — 측정할 때마다 새로 만들던 CanvasKit 문단을 글자마다 기억해 두고, 폭이 바뀌면 줄 나누기만 다시 한다 (결과 동일). 이 결정은 `.claude/rules/canvas-rendering.md` §3 의 「WASM Paragraph 객체 캐싱 금지는 측정 경로 한정」 (ADR-174 가 남긴 측정 경로 「결과값만」 계약) 을 좁게 고친다 — 조건은 Decision 3.

> **리뷰 round 2 반영 — 2026-11-26** ([reviews/319.md](../reviews/319.md), round 1 여섯 건 해소 확인 · 문단 재사용에 HIGH 2 · MEDIUM 1 — 사용자가 판독을 붙여 넣음):
> H4 편집 중 문단 누적 — `previewRecord` 는 글자 편집 (`CatalogTextEditor.tsx:253`) · Styles 칸 끌기 (`catalogStylesHost.ts:1065` 등) 도 부른다. 보유를 `previewRecord` 가 아니라 **크기 미리보기를 연 호출자**가 연다 (Canvas 크기 · 여백 손잡이 = `canvasGesture.showReflow`, Styles 의 크기 · 여백 · 간격 칸 끌기). 글자 편집 · 글꼴 크기 끌기 같은 다른 미리보기는 보유를 열지 않는다 (지금 그대로). 보유 표는 **글자 leaf 마다 한 칸** — 같은 leaf 의 글자 · 서체 · run 이 바뀌면 이전 문단을 그 자리에서 지운다. 그래서 보유 개수 ≤ 측정한 leaf 수이고, G3 이 끌기 중 최대 보유 개수를 기록한다.
> H5 화면 이탈 — 닫는 곳에 Canvas teardown (`CatalogCanvas` cleanup 이 진행 중 끌기를 `cancel`) 과 `workspace.dispose` 를 더한다 (둘 다 여러 번 불러도 한 번만 닫힘). 폐기는 지연 큐 대신 **즉시 `.delete()`** 로 바꾼다 — 측정 문단은 그리기 호출에 넘어가지 않아 ADR-174 의 사고 (그린 뒤 flush 전 삭제) 가 생길 수 없고, 지금도 측정 문단은 만든 자리에서 바로 지운다 (`textMeasure.ts:242`). 다음 프레임이 없어도 해제가 끝난다. G3 = 끌기 중 라우트 이탈 뒤 보유 0 · 만든 수 = 지운 수.
> M4 G3 원복 조건 — 문단 보유 키에는 폭이 없다 (폭마다 `layout(width)` 를 다시 부르면 결과가 맞다 — 리뷰 실측 95 → 400 → 95 px 에서 7 → 2 → 7 줄, 새 문단과 같음). 원복 RED 는 (i) 폭이 바뀌어도 `layout` 을 다시 부르지 않음 (ii) 수치 결과 캐시 (`textMeasureCache.ts:13`) 키에서 폭을 뺌 — 둘이다.

> **리뷰 round 3 — 2026-11-26** ([reviews/319.md](../reviews/319.md), 사용자가 결과를 전달): 설계 승인 가능. round 2 의 H4 · H5 · M4 fixed, 누적 9건 fixed · pending 0. M4 는 CanvasKit 0.42 · Pretendard 로 95 → 400 → 95 px 를 재어 정상 경로 7 → 2 → 7 줄 (새 문단과 같음), 두 원복 변형 (재배치 생략 · 수치 캐시 키에서 폭 뺌) 은 7 → 7 → 7 줄로 검출됨을 확인했다.

## Context

### 도메인

- **D1 · D2**: 해당 없음 — DOM · ARIA · prop 표면을 바꾸지 않는다.
- **D3 (시각 스타일)**: Canvas consumer 의 **내부 비용**만 다룬다. catalog rule · 토큰 · 해석 결과는 그대로이고, 바꾼 뒤의 Canvas 그림은 바꾸기 전과 같아야 한다 (Builder ↔ Preview 대칭 결과 불변).

### 문제

Canvas 에서 글자가 많은 상자의 크기를 끌면 (Resizable Panel 손잡이 · Frame 폭 손잡이 · Styles 숫자 칸 끌기 — 모두 같은 미리보기 경로) 4x CPU 에서 프레임이 두 배로 늘어난다. 고객은 대량 데이터 화면 (목록 · 표 · 상세) 을 만들므로 글자 수백 ~ 천 개를 담은 상자는 흔하다.

### 실측 (2026-11-26 다시 잼 — 리뷰 R1 H3 뒤, production dist = HEAD `63da87971` + 작업 트리 미커밋 (ADR-318 `/simplify` · 다른 세션 Table 정리) · headed Chrome · 보이는 탭 · 유효 표본 3 개 중앙값)

하니스 `apps/builder/scripts/adr318-heavy-panel-frame.mjs` (미커밋, R1 H3 수리): Panel · Frame 에 줄바꿈이 생기는 긴 글자 N 개, ±150 px 3 왕복 + 60 px. 매 표본은 같은 시작 크기 (Canvas undo · Publish 손잡이 키) 에서 시작하고 끝 크기가 바뀐 표본만 센다 — 이번 측정은 버린 표본 0 (Canvas 기본 → 43.4 % · Publish 50 → 45 · Frame 600 → 521 px). 이 기기의 idle rAF 간격은 20 ms (50 Hz) — 판정 p95 ≤ max(16.7, idle + 1.7) = 21.7 · LoAF 0. 글자 0 개 칸도 p95 21.0 ~ 21.8 이라 21.7 근처의 ±0.2 ms 는 잡음이다.

| 경우                                                    | 1x                                    | 4x                                                 |
| ------------------------------------------------------- | ------------------------------------- | -------------------------------------------------- |
| Canvas Panel, 같은 문장 300                             | p95 20.8 · LoAF 0                     | p95 21.9 · **LoAF 4** (최대 53 ms)                 |
| Canvas Panel, 같은 문장 1,000                           | p95 20.3 · LoAF 0                     | **p95 40.9 · p99 79.0 · LoAF 309** (최대 97 ms)    |
| Canvas Panel, **다른 문장 1,000**                       | **p95 60.1 · LoAF 309** (최대 104 ms) | **p95 360.7 · p99 380.6 · LoAF 309** (최대 502 ms) |
| Publish Panel, 같은 문장 1,000                          | p95 20.2                              | p95 20.9 · LoAF 2 (최대 58 ms)                     |
| Publish Panel, 다른 문장 1,000                          | p95 21.8                              | p95 21.9 · LoAF 4 (최대 63 ms)                     |
| 대조군 — 일반 Frame + 같은 문장 1,000, Canvas 폭 손잡이 | p95 21.2                              | **p95 41.9 · LoAF 309**                            |

대조군이 Panel 과 같으므로 Resizable 고유 비용이 아니다.

CPU 프로파일 (끌기 한 번, 포함 시간). 같은 문장은 dev 빌드 1x (함수 이름), 다른 문장은 production 1x (source map):

| 단계                                                   |           같은 문장 1,000 | 다른 문장 1,000 | 성격                                                                                                                                |
| ------------------------------------------------------ | ------------------------: | --------------: | ----------------------------------------------------------------------------------------------------------------------------------- |
| 미리보기 `previewRecord` 전체                          |                  1,431 ms |       20,177 ms |                                                                                                                                     |
| └ 줄바꿈 `rewrap`                                      |                    761 ms |       19,519 ms |                                                                                                                                     |
| └└ 측정 원천 `catalogTextMeasure` → `paragraphMetrics` | (캐시 적중 — 폭마다 1 회) |   **17,522 ms** | 측정마다 CanvasKit `ParagraphBuilder` 로 문단을 새로 만들고 shaping 한다 (`textMeasure.ts:51`) — 같은 글자를 폭만 바꿔 다시 shaping |
| └ 엔진 `computeLayout`                                 |                    624 ms |        1,121 ms | 필요한 일                                                                                                                           |
| Canvas `canvasBinding.update`                          |                  1,594 ms |        1,543 ms |                                                                                                                                     |
| └ `registerNode` → `paintedNodeData`                   |              905 / 803 ms |    923 / 835 ms | 상자 크기만 바뀌어도 칠을 처음부터 다시 해석                                                                                        |
| Skia `render` (그 중 `renderText`)                     |              811 (685) ms |  775 (1,411) ms | 필요한 일 (줄이 바뀜)                                                                                                               |

같은 문장 자체 시간 상위: `textMeasureCache` `measure` 204 · `libraryVisual` `apply` 158 · `resolveToken` 97 · `usedBorder` 92 · `catalogDerivedConditionalVisual` 83 · `catalogLibraryVisual` 63 · `catalogBoxModel` 59 · `getLayoutsForIds` 54 ms.

**뜻 (2026-11-26 재측정의 결론)**: 글자마다 문장이 다른 실제 화면에 가까운 경우, 비용의 약 85 % 가 측정 원천 (문단 shaping) 이고 이 ADR 의 1 · 2 가 줄이는 몫 (칠 재해석 · 조회 · 파싱 · 키 직렬화) 은 10 % 안팎이다. 같은 문장 fixture 는 측정 캐시가 공유돼 이 비용을 가렸다 (F4 · 리뷰 M1). 범위를 어떻게 할지는 사용자 확인 대기 (결정 지점 4 — Status 참조).

### 코드 사실 (HEAD `ddb1d307e` — 인용 줄 번호는 `63da87971` 에서도 같음)

- **F1** 미리보기 한 번 = `previewRecord` (`packages/shared/src/catalog/runtime/compositionRoot.ts:7438`) → `computeLayout` → `rewrap(rewrapScope([id]))` (`:7504`) → `settleOverlays`. 끌기 프레임마다 `canvasGesture.ts:1543` `showReflow` 가 부른다.
- **F2** `rewrap` (`compositionRoot.ts:6878`) 은 후보 글자마다 `getLayoutsForIds([id])` (`:6952` — wasm 왕복 1 회) · `catalogBoxModel(record)` (`:6954`) · `usedBorder(id)` (`:5980` — `getAppliedStyle` 문자열을 `JSON.parse`) · `textLeaf` · `textMeasure` 두 번 (한 줄 · 줄바꿈) 을 한다. 바뀐 높이가 있으면 끝에 `computeLayout` 한 번. 가상 격자 · 달력 가지는 루프 중간에 `computeLayout` 을 부른다 (`:6905` 부근).
- **F3** `rewrapScope` (`:7017`) 도 후보마다 `getAppliedStyle` 을 `JSON.parse` 한다.
- **F4** 측정 캐시 (`apps/builder/src/builder/catalogRuntime/textMeasureCache.ts:13`) 의 키는 호출마다 `JSON.stringify([text, font, maxWidth, runs])` 이고 캐시는 workspace 전체가 나눠 쓴다 (`workspace.ts:225`). 그래서 같은 문장 N 개는 폭마다 측정 원천을 한 번만 부르고, 다른 문장 N 개는 폭마다 N 번 부른다 (리뷰 실측 — 1,000 개 × 두 폭: 같은 문장 2 회 · 다른 문장 2,000 회). 키 직렬화 비용은 둘 다 호출마다 낸다. 같은 문장 fixture 의 프로파일은 측정 원천 비용을 과소평가한다 (M1).
- **F4a** `rewrap` 의 `textLeaf` 는 record 말고도 가장 가까운 조상의 계산된 줄 높이 (`inheritedLineHeight`) 를 받는다 (`compositionRoot.ts:6934` 부근). 부모 Frame 의 줄 높이를 1.5 → 3 으로 미리보기하면 자식 record 객체는 그대로인데 줄바꿈 높이가 72 → 144 px · baseline 9 → 18 px 로 바뀐다 (리뷰 실측 H1). record 객체만 키로 쓰는 기억은 틀린다.
- **F9** 측정 원천 `paragraphMetrics` (`apps/builder/src/builder/catalogRuntime/textMeasure.ts:51`) 는 호출마다 `ParagraphBuilder.MakeFromFontCollection` → `build()` 로 문단을 새로 만들고 (shaping), `layout(100000)` 으로 intrinsic 폭을 읽은 뒤 `maxWidth` 가 있으면 그 폭으로 다시 `layout` 하고, 끝에 `paragraph.delete()` · `builder.delete()` (`:242`) 한다. 같은 글자를 폭만 바꿔 재도 shaping 부터 다시 한다. SkParagraph 는 같은 문단의 `layout(width)` 를 다시 부르면 shaping 을 건너뛰고 줄 나누기만 한다 (CanvasKit 0.42 에서 실제로 그런지는 Phase 0 시제품이 잰다).
- **F10** 측정 경로의 문단 보유는 지금 규칙으로 금지다 (`.claude/rules/canvas-rendering.md` §3 — ADR-174 Implemented, 「측정기의 결과값만 LRU 계약 유지」). 그 계약의 원인은 렌더 쪽 사고 — 전역 LRU 가 **프레임 도중** 문단을 지워 같은 프레임의 새 문단이 그 WASM 주소를 재사용하자 글리프가 사라졌다. ADR-174 Phase 1 이 캐시 퇴거 · 교체의 WASM `.delete()` 를 지연 폐기 큐로 옮겼다 (`apps/builder/src/builder/workspace/canvas/skia/deferredDisposal.ts:32` `scheduleWasmDisposal`). 문단 단가는 수리 뒤 수 KB ~ 수십 KB (3,807 개 보유 = 힙 128 MB 에서 평탄 — ADR-174 G1). 측정 문단은 그리기 호출 (`drawParagraph`) 에 넘어가지 않는다 — `paragraphMetrics` 는 재고 바로 지운다 (`textMeasure.ts:242`). 지연 폐기 큐는 그린 문단의 규율이다.
- **F8a** 기존 서명 비교 (`canvasPageSplice.test.ts:77`) 는 명령 종류 · 기하만 적어, Frame 배경을 빨강 → 파랑으로 바꿔도 서명이 같다. `rebuild` (`canvasScene.ts:269` · `:345`) 도 같은 root 를 써서 root 수명 메모를 공유한다 (리뷰 실측 H2). 칠 메모의 oracle 로 쓸 수 없다.
- **F5** `canvasBinding.update` 는 rect 가 바뀐 노드를 `reRegister` 에 모아 (`apps/builder/src/builder/catalogRuntime/canvasBinding.ts:3179` ~ `:3482`) `registerNode` (`:2881`) 로 다시 등록한다. `registerNode` 는 `readImagesOf` (`:2258` `registerOwned`) 안에서 `paintedNodeData` (`:1375`) 를 처음부터 부른다 — `catalogDerivedRestVisual` · `catalogVisualWithBackground` · `withoutCoveredGradient` · `applyCatalogAuthoredPaint` · binding 함수.
- **F6** 그 가운데 `catalogLibraryVisual` (`packages/shared/src/catalog/runtime/libraryVisual.ts:19`) 은 정의 · props · 색 모드 · 토큰만 읽는다 (rect 를 읽지 않는다). Canvas 에서 5 곳이 부른다.
- **F7** 미리보기 중 바뀌지 않은 record 는 같은 객체로 남는다 — `previewRecord` 는 대상 id 의 record 만 새 객체로 바꾼다 (`:7480` 부근 `this.records.set(id, shown)`). 문서 그래프에는 `revision` 이 있다 (`packages/shared/src/catalog/document/graph.ts:643`).
- **F8** Canvas 증분 경로의 정합 검사 선례: 「`scene.sync()` 결과 = `scene.rebuild()` 결과」 서명 비교 (`apps/builder/src/builder/catalogRuntime/__tests__/canvasPageSplice.test.ts`).

### Hard constraints

- CLAUDE.md §성능 기준 — Canvas cadence p95 = native refresh target (60 Hz floor). 이 기기에서는 p95 ≤ 21.7 ms · LoAF 0.
- 그림 불변 — 바꾼 뒤의 Canvas 명령 · bounds 가 바꾸기 전과 같아야 한다 (D3 대칭).
- 번들: Builder initial 상한 1,650,000 B gzip (ADR-201 재승인, 만료 2026-12-25) — 이 ADR 은 코드 추가가 작아 Δ 수백 B 이하로 본다.

### Soft constraints

- 엔진 레이아웃 · Skia 글자 그리기 · 줄 나누기 자체는 이 ADR 에서 줄이지 않는다. 같은 문장 1,000 글자 · 4x 에서 그 몫만 프레임당 약 18 ms (1x 4.6 ms × 4) 이고, 다른 문장 1,000 글자에서 shaping 을 빼도 줄 나누기 · 엔진 · Skia 가 남는다. 그래서 1,000 · 4x 가 한 프레임 (20 ms) 안에 들어온다고 기대하지 않는다 (Risks R3).

## Alternatives Considered

### 대안 A: rect 와 무관한 칠 해석을 record 별로 재사용 + `rewrap` 묶기 + 측정 문단 재사용 (사용자 지시 1 · 2 + 범위 넓힘 3)

- **1 — 칠 해석 재사용**: `paintedNodeData` 안에서 rect 를 읽지 않는 해석 (정의 시각 값 · 상태 조건 시각 값 · 파생 휴지 시각 값 · 토큰 해석) 을 record 객체를 키로 한 `WeakMap` 에 둔다. 무효화 키 = 색 모드 + 문서 그래프 `revision` + 그 해석이 읽는 조상 · 이웃 입력 (부모 record 객체 등 — Phase 0 inventory 가 정한다). 조상 입력을 키로 덮을 수 없는 해석은 메모하지 않는다. rect 에 따라 바뀌는 조립 (상자 · 글자 줄 · 그림자 · 스크롤 막대) 은 지금처럼 매번 한다.
- **2 — 줄바꿈 계산 묶기**: `rewrap` 이 다음 중간 `computeLayout` (가상 격자 · 달력 가지) 전까지 소비할 후보 구간의 layout 을 한 번에 읽는다 — 후보마다 한 번, wasm 호출은 구간 수. `usedBorder` · applied style 파싱을 엔진 세대 (`generation`) 범위로 기억하고, 글자 leaf (`textLeaf` 결과와 폭을 뺀 측정 키) 를 「record 객체 + 상속 줄 높이」 키로 기억한다.
- **3 — 측정 문단 재사용 (범위 넓힘)**: `paragraphMetrics` 가 만든 문단을 미리보기 동안 기억하고, 같은 글자 · 서체 · run 을 다른 폭으로 잴 때 `layout(width)` 만 다시 부른다. 키 = 측정 키에서 폭을 뺀 것 (`[text, font, runs]`). 보유 주체 = 크기 미리보기 한 번 — Canvas 크기 · 여백 손잡이 끌기와 Styles 의 크기 · 여백 · 간격 칸 끌기가 열고, commit · 취소 · root 교체 · 글꼴 변경 · Canvas teardown · `workspace.dispose` 에서 닫는다 (R2 H4 · H5). 전역 LRU 가 아니다. 보유 표는 글자 leaf 마다 한 칸 — 같은 leaf 의 키가 바뀌면 이전 문단을 바로 지운다. 닫을 때 모두 바로 `.delete()` (측정 문단은 그려지지 않는다 — F10). 글자 편집 등 다른 미리보기와 미리보기 밖 측정은 지금 그대로 (만들고 바로 지움).
- 위험: 기술 **MEDIUM** (숨은 입력을 놓치면 낡은 칠 — 서명 비교로 막음) / 성능 LOW (메모리는 record 수에 비례, record 와 함께 놓임) / 유지보수 MEDIUM (칠 함수에 새 입력을 넣을 때 무효화 키도 봐야 함) / 마이그레이션 LOW (문서 · contract 무변경, 되돌리기 = 메모 끄기)

### 대안 A′: 측정 문단을 전역 LRU 로 보유

- 설명: 문단을 `[text, font, runs]` 키의 전역 LRU (상한 N) 로 계속 보유한다 — 미리보기 밖에서도 맞는다.
- 위험: 기술 **HIGH** (ADR-174 가 걷어낸 모양 그대로 — 상한 → 퇴거 → 폐기 시점 관리, 규칙이 금지) / 성능 MEDIUM (상한 밖 문서에서 스래싱) / 유지보수 MEDIUM / 마이그레이션 LOW

### 대안 B: 노드 전체 `SkiaNodeData` 캐시 + 위치만 옮기기

- 설명: (record, rect 크기, 글자 줄, 부모) 가 같으면 등록 데이터 전체를 재사용하고 x · y 만 고친다.
- 위험: 기술 LOW / 성능 **HIGH** (측정한 경우는 끄는 동안 모든 글자의 **폭**이 바뀌어 캐시가 한 번도 맞지 않는다 — 이득 0) / 유지보수 MEDIUM / 마이그레이션 LOW

### 대안 C: 끄는 동안 줄바꿈을 미루고 놓을 때 계산 (보고의 방안 3)

- 설명: 미리보기 중에는 이전 줄 높이를 쓰고, 놓을 때 `rewrap`.
- 위험: 기술 LOW / 성능 LOW (가장 큰 이득) / 유지보수 LOW / 마이그레이션 LOW — 다만 **끄는 동안 글자가 상자 밖으로 넘쳐 보이는 화면 변화**가 있어 사용자 결정 사항이다 (이번 요청에서 제외).

### 대안 D: 미리보기 레이아웃 · 칠을 Worker 또는 Rust 로 옮기기

- 설명: 메인 스레드 밖에서 미리보기를 계산.
- 위험: 기술 **HIGH** (record · 해석기 · 측정기 전체를 옮겨야 함, CanvasKit 측정은 메인 스레드) / 성능 MEDIUM / 유지보수 **HIGH** / 마이그레이션 MEDIUM — Rust 이관 근거가 없다는 10 ~ 11 월 측정 결론과도 맞지 않는다.

### Risk Threshold Check

| 대안 | HIGH+                                  | 판정                                                        |
| ---- | -------------------------------------- | ----------------------------------------------------------- |
| A    | 없음 (MEDIUM 2)                        | 채택 가능                                                   |
| B    | 성능 HIGH (측정 경우 이득 0)           | 기각                                                        |
| A′   | 기술 HIGH (ADR-174 가 걷어낸 전역 LRU) | 기각 — 보유 주체를 미리보기 한 번으로 묶은 A-3 이 같은 이득 |
| C    | 없음 — 화면 동작 변경이라 사용자 결정  | 이번 범위 밖 (사용자 지시)                                  |
| D    | 기술 · 유지보수 HIGH                   | 기각                                                        |

HIGH 없는 대안 (A) 이 있어 루프는 한 번으로 끝난다.

## Decision

**대안 A 를 채택한다** — rect 와 무관한 칠 해석을 record 객체 단위로 재사용하고, `rewrap` 의 글자마다 반복하던 layout 조회 · style 파싱 · leaf 계산을 묶고, 미리보기 동안 측정 문단을 재사용해 shaping 을 한 번으로 줄인다. 그림 · 줄 높이 · rect 는 바뀌지 않는다.

**Decision 3 — 측정 경로 문단 보유 조건 (규칙 `canvas-rendering.md` §3 를 고치는 범위)**: (a) 보유 주체는 크기 미리보기 한 번 — 크기 · 여백 · 간격을 바꾸는 미리보기의 호출자가 열고 (글자 편집 등 다른 미리보기는 열지 않는다), 전역 표 · 퇴거 없음. 보유 표는 글자 leaf 마다 한 칸이라 보유 개수 ≤ 측정한 leaf 수 — 같은 leaf 의 글자 · 서체 · run 이 바뀌면 이전 문단을 그 자리에서 지운다. (b) 닫는 곳 = commit · 취소 · root 교체 · 글꼴 모음 변경 · Canvas teardown · `workspace.dispose` — 여러 번 불러도 한 번만 닫힌다. 폐기는 즉시 `.delete()` 다: 측정 문단은 그리기 호출에 넘기지 않으므로 (보유 표는 측정 모듈 밖으로 문단을 내지 않는다 — 정적 검사) 프레임 도중 삭제의 사고가 생길 수 없고, 다음 프레임 없이 해제가 끝난다. (c) 글꼴 모음이 바뀌면 (측정 캐시 `clear` 와 같은 자리, `workspace.refreshFonts`) 미리보기 중이라도 보유분을 버린다. (d) 결과는 새로 만든 문단과 같아야 한다 — Phase 0 시제품 · G3 oracle. 보유 키에는 폭이 없고 폭마다 `layout(width)` 를 다시 부른다. 폭이 든 수치 결과 캐시 (`textMeasureCache`) 는 지금 그대로다. 렌더 쪽 문단 (노드 소유 retained) 과는 섞지 않는다 (측정 문단과 그리기 문단은 줄바꿈 힌트가 다르다 — 규칙 §3). 이 네 조건 밖의 측정 경로 보유는 여전히 금지다.

위험 수용 근거: 남는 MEDIUM 은 「숨은 입력을 놓친 낡은 칠 · 낡은 줄 높이」 다. 메모는 record 객체 identity 에 묶여 문서 · 미리보기 변경이 새 객체를 만들면 저절로 빗나가고, 색 모드 · 그래프 revision · 조상 입력 (상속 줄 높이 · 부모 record) 은 키에 들어간다. 나머지 입력은 Phase 0 inventory 로 찾고, 메모를 우회한 독립 계산과 실제 칠 값 · 줄 높이를 비교하는 oracle (F8a 때문에 `rebuild` 서명은 쓰지 않음) 과 편집 · 테마 · 토큰 · 부모 미리보기 시나리오로 막는다 (G1 · G2).

기각 사유:

- **B**: 측정한 경우 (상자 폭이 바뀌는 끌기) 에 캐시가 맞지 않아 이득이 없다. 위치만 바뀌는 노드는 이미 `registerMovedSkiaNode` 경로가 있다.
- **C**: 효과는 가장 크지만 끄는 동안 화면이 달라진다 — 사용자가 이번 범위에서 뺐다. A 뒤에도 기준에 못 미치면 사용자 결정 1 로 다시 묻는다.
- **A′**: ADR-174 가 걷어낸 전역 LRU 를 측정 경로에 다시 들인다 — 미리보기 한 번으로 묶은 A-3 이 끌기 중 이득을 같이 얻는다.
- **D**: 범위 · 위험이 이 문제에 비해 지나치게 크다.

> 구현 상세: [319-canvas-resize-preview-paint-reuse-rewrap-batching-breakdown.md](../design/319-canvas-resize-preview-paint-reuse-rewrap-batching-breakdown.md)

### 사용자 결정 (execute 중 해당 Phase 에서 묻는다)

1. **최종 판정 기준** (Phase 4): 1 · 2 · 3 뒤에도 측정한 어느 칸이든 절대 기준 (p95 ≤ max(16.7, idle + 1.7) ms **그리고** LoAF 0) 에 못 미치면 — p95 초과 또는 LoAF 잔존 어느 하나라도 (예상 — R3) — 「한계로 기록하고 닫기」 와 「대안 C (끄는 동안 줄바꿈 미루기) 를 새 결정으로 열기」 중 무엇으로 할지.

## Risks

| ID  | 위험                                                                                                                                                                             | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 칠 메모가 키 밖의 입력 (부모 record · 글자 줄 · 이미지 준비 · 테마 토큰 편집 · 정의 편집) 을 놓쳐 낡은 칠을 그림                                                                 |  HIGH  | Phase 0 에서 `paintedNodeData` 가 읽는 입력 전수 inventory → rect 무관 + 키로 덮이는 부분만 메모. G1 oracle = 메모를 우회한 독립 계산의 `SkiaNodeData` 전체 (칠 색 · 글자 모양 포함) 와 비교 — 같은 root 의 `rebuild` 서명은 칠을 적지 않아 쓰지 않음 (F8a). 테마 전환 · 토큰 값 편집 · 정의 visual 편집 · 부모 배경 편집 · 이미지 도착 시나리오 |
| R2  | `rewrap` 기억이 조상 입력 (상속 줄 높이) 을 놓치거나, 묶음 조회가 중간 `computeLayout` 뒤 낡은 rect 를 쓰거나, 구간을 다시 읽으며 조회량이 격자 수의 제곱으로 늘어남             |  HIGH  | leaf 기억 키 = record 객체 + 상속 줄 높이 (F4a). 조회는 다음 `computeLayout` 전 구간만 — 후보마다 한 번. G2 = 줄 높이 · baseline · rect 가 메모 우회 계산과 같음 (부모 줄 높이 미리보기 · 원복 · 가상 격자 여럿 · 달력 · RichText · 한 줄 유지 글자) + wasm 호출 수 · 요청 handle 총합 상한                                                      |
| R3  | 1 · 2 · 3 뒤에도 1,000 · 4x 가 기준에 들지 않음 (남는 줄 나누기 · 엔진 · Skia)                                                                                                   |  HIGH  | 기대치를 문서에 미리 적고 (§Soft constraints), G4 는 기술 통과 (줄어든 양) 와 절대 기준 (p95 · LoAF 0) 을 따로 기록. 절대 기준 미달 (p95 초과 또는 LoAF 잔존) 이면 사용자 결정 1                                                                                                                                                                 |
| R4  | 메모리 — record 마다 메모 객체                                                                                                                                                   |  LOW   | `WeakMap` (record 와 함께 놓임). Phase 4 에서 힙 증가 기록                                                                                                                                                                                                                                                                                       |
| R5  | 결정적 호출 수 ratchet 의 기준 이동                                                                                                                                              |  LOW   | 줄어드는 방향이라 block 아님. 커밋 뒤 `pnpm gate:perf-ratchet` 결과를 기록                                                                                                                                                                                                                                                                       |
| R6  | 측정 문단 보유가 ADR-174 의 사고를 다시 부름 (그린 문단 삭제 → 글리프 소실) 이나 보유가 쌓임 — 글자 편집 · 글꼴 크기 끌기 같은 다른 미리보기 (R2 H4) · 끌기 중 화면 이탈 (R2 H5) |  HIGH  | Decision 3 의 네 조건. G3 = 보유 문단이 측정 모듈 밖으로 나가지 않음 (정적 검사 — 그리기 호출 · export 없음) · 글자 편집 512 회 입력에 보유 0 · 끌기 중 최대 보유 ≤ 측정 leaf 수 · 닫는 여섯 경우 (commit · 취소 · root 교체 · 글꼴 변경 · Canvas teardown · 끌기 중 라우트 이탈) 마다 보유 0 · 만든 수 = 지운 수 · 끌기 중 힙 증가 기록         |
| R7  | 재사용한 문단의 줄 나누기 결과가 새로 만든 문단과 다름 (CanvasKit 의 re-layout 상태 · run · chip placeholder · 자간 · CJK)                                                       |  HIGH  | Phase 0 시제품으로 같음을 먼저 확인 (no-go 면 3 을 빼고 보고). G3 oracle = 같은 글자 · 폭 묶음에서 재사용 측정 결과 (높이 · 줄 수 · baseline · intrinsic 폭) 가 새로 만든 문단 결과와 같음 — 같은 문장 · 다른 문장 · RichText run · token chip · 자간 · 한글                                                                                     |

## Gates

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 실패 시 대안                                                                                                                                       |
| ---- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 끝 | 유효 표본만 (시작 크기 복원 · 끝 크기 변화 확인 — 하니스가 버린 표본 수 기록) 으로 기준선: production 4x · 1x, 글자 0 / 300 / 1,000 (같은 문장 · 다른 문장) · 대조군, dist 식별자 (HEAD + 미커밋 목록) 를 결과에 붙임 · dev 프로파일 3 회 · 결정적 카운트 (아래 측정 조건 Q4 — 키 직렬화와 측정 원천 호출을 따로) · `paintedNodeData` 입력 inventory · `rewrap` 루프 inventory · 독립 oracle (메모 우회 계산 비교 · 줄 높이 스냅샷) 이 HEAD 에서 GREEN · **문단 재사용 시제품 go/no-go** (CanvasKit 0.42 에서 같은 문단 `layout(width)` 재호출 비용이 새로 만들기보다 작고 결과가 같음) | inventory 에서 rect 무관 부분이 작으면 (프로파일 포함 시간 < 200 ms) Phase 1 을 줄이고 보고 · 문단 시제품 no-go 면 Phase 3 을 빼고 사용자에게 보고 |
| G1   | Phase 1 끝 | 세 조건 구분 — (a) 정상 메모: 메모 우회 계산과 `SkiaNodeData` 전체 같음 (GREEN) · (b) 무효화 키 하나를 뺀 변이: 시나리오 (테마 · 토큰 · 정의 · 부모 배경 · 이미지) 가 낡은 칠로 RED · (c) 메모를 끈 변이: 호출 수 상한이 RED · dev 프로파일 `paintedNodeData` 포함 시간이 기준선보다 40 % 이상 줄어듦                                                                                                                                                                                                                                                                                   | 키 입력을 넓히거나 메모 범위를 좁힌다                                                                                                              |
| G2   | Phase 2 끝 | 줄 높이 · baseline · rect 가 기억 우회 계산과 같음 — 부모 줄 높이 미리보기 · 원복 포함 (상속 줄 높이를 키에서 뺀 변이는 RED) · 가상 격자 K 개 fixture 에서 wasm 호출 수 ≤ 구간 수 · 요청 handle 총합 = 후보 수 (다시 읽기 변이는 RED) · dev 프로파일 `rewrap` 포함 시간에서 측정 원천을 뺀 몫이 40 % 이상 줄어듦 (같은 문장 · 다른 문장 두 fixture)                                                                                                                                                                                                                                     | 묶음 범위를 좁힌다                                                                                                                                 |
| G3   | Phase 3 끝 | 재사용 측정 = 새로 만든 문단 측정 (R7 의 fixture 전부 — 한 문단을 좁은 폭 → 넓은 폭 → 좁은 폭으로 · 원복 RED 두 가지: 폭이 바뀌어도 `layout` 을 다시 부르지 않음 · 수치 결과 캐시 키에서 폭을 뺌. 보유 키에 폭이 없는 것은 GREEN) · 보유 문단이 측정 모듈 밖으로 나가지 않음 (정적 검사) · 글자 편집 512 회에 보유 0 · 끌기 중 최대 보유 ≤ 측정 leaf 수 · 닫는 여섯 경우 (끌기 중 라우트 이탈 포함, 다음 프레임 없이) 보유 0 · 만든 수 = 지운 수 · 다른 문장 fixture 의 dev 프로파일 측정 원천 포함 시간이 기준선보다 50 % 이상 줄어듦 · 끌기 중 힙 증가 기록                           | 문단 보유를 빼고 1 · 2 로 닫음 (사용자 보고)                                                                                                       |
| G4   | Phase 4 끝 | production A/B 교대 3 쌍 (유효 표본만): 기술 통과 = 300 글자 · 4x LoAF 0 · 1,000 글자 · 4x (같은 문장 · 다른 문장) 에서 LoAF 수와 p99 가 기준선보다 줄어듦 · 다른 문장 1,000 · 1x 의 p95 가 기준선보다 줄어듦 · 0 글자 회귀 없음 · `/cross-check` (그림 불변) · live Chrome 1 회 · 번들 Δ · ratchet 결과. 절대 기준 (모든 칸 p95 ≤ max(16.7, idle + 1.7) **그리고** LoAF 0) 은 따로 기록 — 한 칸이라도 미달이면 사용자 결정 1                                                                                                                                                           | 사용자 결정 1                                                                                                                                      |

측정 조건 (measurement-validity §1): Q1 — fixture 는 합성 (같은 긴 글자 N 개 · 다른 글자 N 개 두 벌) 이라 **규모 전용**, 분포 주장 없음 — 같은 문장 벌은 측정 캐시가 공유돼 측정 원천 비용을 과소평가하고 (F4), 다른 문장 벌이 그 반대 끝이다 · Q2 — 측정한 끌기는 모든 글자의 폭이 바뀌는 불리한 경우다. 메모가 빗나가는 경우 (테마 전환 · 토큰 편집 직후 끌기) 를 G1 에 하나 더 잰다 · Q3 — 변경 전 dist 와 교대 3 쌍 · Q4 — 메모 · 묶음이 실제 끌기 경로에서 맞는지 호출 수 카운트로 확인 (§5 — 끌기 한 번의 `catalogLibraryVisual` · `getLayoutsForIds` (wasm 호출 수와 요청 handle 총합) · `JSON.parse` · 측정 키 직렬화 · 측정 원천 호출 수를 Phase 0 에 RED 로 고정하고 수정 뒤 낮춘다) · Q5 — 그림 불변의 oracle 은 메모 · 기억을 우회한 독립 계산 (같은 root 의 `rebuild` 는 메모를 공유해 독립이 아님 — F8a) 과 수정 전 코드의 줄 높이 스냅샷, 체감은 production rAF (유효 표본만). 조건 기록: 기기 · DPR · 보이는 탭 · idle rAF 간격 · CPU 배율.

집행 수단: 테스트는 `pnpm -F @composition/builder exec vitest run` (커밋 전 · `/verify`), 성능은 하니스 수동 실행 + `pnpm gate:perf-ratchet` (push 전 수동, `PERF_RATCHET=1 git push` 가능). PR · status check 는 쓰지 않는다.

### Live Exercise

2026-11-26 — Playwright 로 headed Chrome 을 몰아 dev 서버 (5173 — 작업 트리) 에서 실행했다. 글자 300 개는 각기 다른 문장이고 한글이 섞여 있다. 보유 수는 앱과 같은 측정 모듈 인스턴스의 진단 카운터 (`catalogMeasureParagraphHoldStats`) 로 읽었다. 사용자 confirm 이 아니라 브라우저 도구로 확인했다.

- **Resizable Panel 손잡이 끌기** (폭 599.5 → 559.9): 끌기 중 최대 보유 300 (= 글자 leaf 수) → 놓은 뒤 보유 0 · 만든 300 = 지운 300. GC 뒤 JS heap 125.7 → 128.7 MB · CanvasKit heap 128 MB 그대로.
- **테마 전환 (다크) 뒤 같은 끌기**: 새 root (색 모드 dark) 에서도 보유 ≤ 300 → 0 · 만든 = 지운. 화면은 다크 바탕 · 흰 글자 · 520 폭 줄바꿈.
- **끌기 중 글꼴 모음 변경** (`workspace.refreshFonts`): 그 자리에서 보유 300 → 0, 나머지 끌기는 보유 없이 진행되고 놓은 뒤에도 0 · 만든 = 지운.
- **끌기 중 브라우저 뒤로가기** (→ 대시보드): 보유 300 → 0 · 만든 300 = 지운 300.
- **Frame 폭 손잡이 끌기** (600 → 560): 보유 ≤ 300 → 0 · 만든 = 지운.
- 다섯 경우 모두 page error · console error 0.

production dist A/B (교대 3 쌍 · 대조군) 와 같은 환경 스크린샷 대조 (Canvas 그림 0 px 차이) 는 Phase 4 블록과 breakdown §9 에 있다.

## Consequences

### Positive

- 글자가 많은 상자의 Canvas 크기 끌기 · Styles 숫자 끌기 · Resizable Panel 끌기가 같이 가벼워진다 (공용 경로).
- 칠 해석 재사용은 크기 미리보기 밖의 다시 등록 (스크롤 막대 · 이웃 rect 변화) 에도 효과가 난다.
- 줄바꿈 측정 · 엔진 · Skia 의 남은 비용이 분리돼, 다음 결정 (대안 C) 의 근거가 분명해진다.

### Negative

- `paintedNodeData` 에 새 입력을 추가할 때 메모 키를 같이 봐야 한다 (R1 — 규칙 문서 `canvas-rendering.md` 에 한 줄 추가).
- 측정 경로가 미리보기 동안 WASM 문단을 든다 — `canvas-rendering.md` §3 의 금지 문구를 Decision 3 의 조건으로 고친다 (R6).
- 1,000 글자 · 4x 의 p95 는 그대로 두 프레임일 수 있다 (R3).
