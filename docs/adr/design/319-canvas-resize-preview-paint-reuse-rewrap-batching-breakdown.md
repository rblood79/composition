# ADR-319 breakdown — Canvas 크기 미리보기 비용: 칠 해석 재사용 · 줄바꿈 계산 묶기 · 측정 문단 재사용

> 본문: [ADR-319](../completed/319-canvas-resize-preview-paint-reuse-rewrap-batching.md). 이 문서는 Phase · 파일 · 완료 기준 · 기록을 둔다.

## 1. 분리 점검 (adr-writing §ADR Fork)

1. **base / 응용**: 이 ADR 은 Canvas 공용 미리보기 경로 (base) 의 비용이다. ADR-318 (Resizable) 은 그 경로를 쓰는 응용 — 318 은 이 ADR 을 기다리지 않는다.
2. **schema 직교성**: 문서 · contract · 저장 형 변경 0. 318 의 몫 파생 값과 겹치는 필드 없음.
3. **선행 전제**: 318 HC5 (Publish 끌기 p95) 판정은 이 ADR 과 무관 — Canvas 미리보기는 318 Gate 대상이 아니었다.
4. 분리는 사용자 지시 (2026-11-26 「별도 새ADR로」) 로 확정. 측정 문단 재사용 (3) 은 같은 날 사용자 답 「319 에 문단 재사용 추가」 로 이 ADR 에 넣었다 (결정 지점 4).

## 2. 범위

| 포함                                                                                                                             | 제외                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `paintedNodeData` 안 rect 무관 해석의 record 단위 메모 (`canvasBinding.ts` · `libraryVisual.ts` 등)                              | 끄는 동안 줄바꿈 미루기 (본문 대안 C — 사용자 결정 1 로만 다시 연다)               |
| `rewrap` · `rewrapScope` 의 구간 layout 조회 · applied style 파싱 기억 · leaf 기억 (`compositionRoot.ts`)                        | 엔진 `computeLayout` · Skia `renderText` · 줄 나누기 자체                          |
| 측정 키 직렬화를 leaf 기억으로 줄이기 (`textMeasureCache.ts` 호출자 쪽)                                                          | Publish · Preview DOM 경로                                                         |
| 미리보기 동안 측정 문단 재사용 (`textMeasure.ts` `paragraphMetrics` — 본문 Decision 3) · 규칙 `canvas-rendering.md` §3 문구 고침 | 미리보기 밖 측정의 문단 보유 · 전역 LRU (대안 A′) · 렌더 쪽 retained 문단과 합치기 |
| 하니스 `adr318-heavy-panel-frame.mjs` 커밋 (기준선 · 전후 비교 도구)                                                             | rAF 합치기 (이미 프레임당 한 번 — Phase 0 에서 확인만)                             |

## 3. Phase

### Phase 0 — 기준선 · inventory · 독립 oracle (G0)

- 하니스 커밋 (리뷰 R1 H3 수리 포함 — 매 표본 시작 크기 복원 · 손잡이 좌표 다시 구함 · 시작 크기가 다르거나 끝 크기가 같은 표본은 버림 · 유효 3 개까지 최대 6 회 · `TEXTS=distinct`).
- 기준선: production dist (`pnpm perf:build-dist -- --out <scratchpad>/dist-319-base`) — 0 / 300 / 1,000 글자 × 1x / 4x × Canvas · Publish, 1,000 글자는 같은 문장 · 다른 문장 두 벌, 대조군 Frame. 결과마다 dist 식별자 (HEAD + 미커밋 목록) 를 붙인다. dev 프로파일 3 회 (`PROFILE=1`, 두 벌).
- 결정적 카운트 (measurement-validity §5): 끌기 한 번 동안 `catalogLibraryVisual` · `paintedNodeData` · `getLayoutsForIds` (wasm 호출 수 · 요청 handle 총합) · `getAppliedStyle` 파싱 · 측정 키 직렬화 · 측정 원천 호출 수 — dev 전역 카운터 (`renderCounters` 와 같은 자리) 로 세고 같은 옵션 2 회가 같은 값인지 확인 (등급 A).
- 문단 재사용 시제품 (go/no-go): 다른 문장 1,000 개를 두 폭으로 — (a) 지금처럼 매번 새로 만들기 (b) 한 번 만들고 `layout(width)` 다시 부르기. 시간 · 결과 (높이 · 줄 수 · baseline · intrinsic 폭) 를 비교한다. RichText run · token chip · 자간 · 한글 포함. (b) 가 빠르고 결과가 같으면 go.
- inventory A — `paintedNodeData` (`canvasBinding.ts:1375`) 가 읽는 모든 입력을 함수별로 표로: record 필드 · 부모 record · 자식 record (`canvasInputs`) · `root.textWraps` · `root.labelSuffix` · `root.colorMode` · 그래프 정의 · 토큰 · 이미지 캐시 · rect · `layoutMap` (다른 id). 각 입력에 「rect 의존 / 키로 덮임 / 덮이지 않음 (메모 안 함)」.
- inventory B — `rewrap` (`compositionRoot.ts:6878`) 루프의 호출별 비용 · 조상에서 오는 입력 (`inheritedLineHeight` 외) · 중간 `computeLayout` 가지 (가상 격자 · 달력).
- 독립 oracle (HEAD 에서 GREEN 이어야 함 — 같은 root 의 `rebuild` 서명은 칠을 적지 않고 메모를 공유해 쓰지 않는다):
  - 칠: 글자 많은 Frame 을 미리보기로 N 단계 바꾸며 매 단계 등록된 `SkiaNodeData` 전체 (칠 색 · 글자 모양 · 상자) 를 메모 우회 함수 (`paintedNodeData` 를 메모 없이 직접 호출) 결과와 깊은 비교. Phase 0 에는 메모가 없으므로 이 비교가 「도구가 칠 차이를 잡는가」 의 확인이다 — Frame 배경을 바꾼 변이에서 RED 가 나는지 본다.
  - 줄: 같은 단계에서 `wrapHeights` · `wrapBaselines` · 모든 rect 스냅샷 (수정 전 코드 값을 fixture 로 고정 — 부모 줄 높이 미리보기 · 원복 · 가상 격자 여럿 · 달력 · RichText · 한 줄 유지 글자 포함).

### Phase 1 — rect 무관 칠 해석 재사용 (G1)

- inventory A 에서 「rect 무관 + 키로 덮임」 인 해석만 메모: 후보 `catalogLibraryVisual` · `catalogDerivedConditionalVisual` · `catalogDerivedRestVisual` · `catalogVisualWithBackground` 결과 · 토큰 색 (`resolveToken` 결과).
- 키: record 객체 (`WeakMap`) + `root.colorMode` + 그래프 `revision` + 그 해석이 읽는 조상 · 이웃 입력 (inventory 가 정함). 메모는 root 수명 (root 교체 때 같이 버림). 메모 우회 스위치 (테스트 전용 — 독립 oracle 이 부른다).
- 테스트 세 조건: (a) 정상 메모 = 메모 우회 계산과 `SkiaNodeData` 전체 같음 · (b) 키 하나씩 뺀 변이 = 시나리오 (색 모드 전환 · 토큰 값 편집 · 정의 visual 편집 · 부모 배경 편집 · prop 변경 · 이미지 도착 직후 크기 끌기) 가 RED · (c) 메모를 끈 변이 = 호출 수 상한 RED. 원복은 bash 스크립트 + trap + cmp.
- 규칙 한 줄: `.claude/rules/canvas-rendering.md` — 「`paintedNodeData` 에 새 입력을 넣으면 메모 키도」.

### Phase 2 — `rewrap` 묶기 (G2)

- 구간 조회: 후보를 순서대로 보며, 다음 중간 `computeLayout` 을 부를 수 있는 후보 (가상 격자 · 달력) 전까지의 구간 rect 를 한 번에 읽는다. 그 후보는 지금처럼 자기 rect 를 읽고, 그 뒤 구간은 새로 읽는다. 후보마다 rect 를 한 번만 요청 — wasm 호출 수 = 구간 수, 요청 handle 총합 = 후보 수 (격자 K 개여도 K(K+1)/2 가 되지 않는다).
- applied style 파싱 (`usedBorder` · `rewrapScope`) 을 엔진 `generation` 범위로 기억.
- leaf 기억: 키 = record 객체 + 상속 줄 높이 (`inheritedLineHeight` 값) + inventory B 가 찾은 다른 조상 입력. 값 = `textLeaf` 결과와 폭을 뺀 측정 키 — 측정 키 직렬화를 줄인다. 측정 원천은 그대로.
- 테스트: Phase 0 줄 oracle (부모 줄 높이 미리보기 · 원복 — 상속 줄 높이를 키에서 뺀 변이는 RED) · 가상 격자 K 개 fixture 의 wasm 호출 수 · handle 총합 상한 (남은 후보 전부 다시 읽기 변이는 RED).

### Phase 3 — 측정 문단 재사용 (G3)

- `paragraphMetrics` 를 둘로: 문단 만들기 (shaping — `[text, font, runs]` 키) 와 폭에서 재기 (`layout(width)` · 줄 · 높이 · baseline). 보유 표가 열려 있고 그 leaf 칸의 키가 같으면 만들기를 건너뛴다. 보유 표 = 글자 leaf 마다 한 칸 (`Map<leafId, {key, paragraph}>`) — 키가 바뀌면 이전 문단을 바로 지우고 새로 만든다. 측정 함수에 leaf id 를 넘기는 인자를 더한다 (`rewrap` 이 leaf 마다 부르는 자리).
- 보유 주체 = 크기 미리보기 한 번 (R2 H4): `previewRecord` 가 아니라 호출자가 연다 — `canvasGesture.showReflow` 의 resize · spacing 과 `catalogStylesHost` 의 크기 · 여백 · 간격 칸 끌기. 글자 편집 (`CatalogTextEditor.tsx:253,268`) · 글꼴 크기 등 다른 칸 끌기는 열지 않는다 (호출 자리 목록은 Phase 3 착수 때 `previewRecord(` 전수로 확정).
- 닫는 곳 (R2 H5): commit · 취소 (`canvasGesture.endReflow`) · root 교체 · 글꼴 모음 변경 (`workspace.refreshFonts`) · Canvas teardown (`CatalogCanvas` cleanup 이 `gestures.cancel()` — 지금은 리스너만 떼고 끌기를 닫지 않는다) · `workspace.dispose`. 여러 번 불러도 한 번만 닫힌다. 닫을 때 전부 즉시 `.delete()` — 측정 문단은 그리기 호출에 넘기지 않으므로 지연 큐가 필요 없고, 다음 프레임 없이 해제가 끝난다. 미리보기 밖 측정은 지금 그대로 (만들고 바로 지움).
- 테스트: 재사용 측정 = 새로 만든 측정 (같은 문장 · 다른 문장 · RichText run · token chip · 자간 · 한글 — 한 문단을 좁은 폭 → 넓은 폭 → 좁은 폭으로). 원복 RED 두 가지 (R2 M4): 폭이 바뀌어도 `layout` 을 다시 부르지 않음 · 수치 결과 캐시 (`textMeasureCache.ts:13`) 키에서 폭을 뺌. 보유 키에 폭이 없는 것 자체는 GREEN. 정적 검사: 보유 문단이 측정 모듈 밖으로 나가지 않음 (export · 그리기 호출 없음). 보유 수: 글자 편집 512 회 입력에 보유 0 · 끌기 중 최대 보유 ≤ 측정 leaf 수 · 같은 leaf 의 키 변경 뒤 이전 문단 삭제 · 닫는 여섯 경우 (commit · 취소 · root 교체 · 글꼴 변경 · Canvas teardown · `workspace.dispose`) 마다 보유 0 · 만든 수 = 지운 수.
- live (Phase 4 와 함께): production dist 에서 Panel 손잡이를 누른 채 브라우저 뒤로가기 → 대시보드. 다음 프레임 없이 보유 0 · 만든 수 = 지운 수 (진단 카운터).
- 규칙 고침: `.claude/rules/canvas-rendering.md` §3 「WASM Paragraph 객체 캐싱 금지는 측정 경로 한정」 → 「측정 경로는 크기 미리보기 한 번 동안 leaf 마다 한 문단만 보유 (ADR-319 Decision 3 — 호출자가 여는 주체 · 그리기에 넘기지 않으므로 즉시 삭제 · 여섯 닫는 곳 · 글꼴 변경 시 버림 · 결과 동일), 그 밖은 결과값만」.

### Phase 4 — 최종 측정 · 확인 (G4)

- production A/B 교대 3 쌍 (기준선 dist ↔ 수정 dist, 유효 표본만 — 같은 문장 · 다른 문장 두 벌). 카운트 상한 내리기 (`perf-ratchet-gate.mjs --update`, 같은 커밋). `pnpm gate:perf-ratchet` 결과 기록. 번들 Δ (일반 `vite build`).
- `/cross-check` — 글자 많은 Frame · Resizable 의 Canvas 그림이 수정 전과 같음.
- live Chrome 1 회 — Canvas 에서 글자 많은 Panel · Frame 끌기, 테마 전환 뒤 끌기, 끌기 중 글꼴 도착.
- 판정 두 줄: 기술 통과 (줄어든 양 — G4) 와 절대 기준 (모든 칸 p95 ≤ max(16.7, idle + 1.7) 그리고 LoAF 0). 한 칸이라도 p95 초과 또는 LoAF 잔존이면 사용자 결정 1.
- 문서: 본문 Live Exercise · README · CHANGELOG (성능 개선 — 트리거 해당).

## 4. 파일 추정

shared 2 ~ 3 (`compositionRoot.ts` · `libraryVisual.ts` · 메모 모듈) · builder 3 ~ 4 (`canvasBinding.ts` · `textMeasure.ts` · `textMeasureCache.ts` 호출자 · 하니스) + 테스트 3 ~ 4 · 규칙 1 (`canvas-rendering.md`). contract · 번들 상한 변경 없음.

## 5. 예상 효과 (프로파일 기준 — 확정 아님)

| 몫                              | 같은 문장 1,000 (dev 1x) | 다른 문장 1,000 (production 1x) | 줄일 수 있는 부분 (추정)                                     |
| ------------------------------- | -----------------------: | ------------------------------: | ------------------------------------------------------------ |
| 측정 원천 (shaping + 줄 나누기) |                캐시 적중 |                       17,522 ms | shaping 몫 (Phase 0 시제품이 비율을 잰다) — 줄 나누기는 남음 |
| `paintedNodeData`               |                   803 ms |                          835 ms | rect 무관 해석 (같은 문장 자체 시간 합 약 400 ms)            |
| `rewrap` 의 측정 밖 몫          |                약 760 ms |                     약 2,000 ms | 조회 · 파싱 · 키 직렬화                                      |
| 엔진 · Skia                     |              약 1,430 ms |                     약 1,900 ms | 0 (범위 밖)                                                  |

같은 문장 경우는 1 · 2 가 약 18 % 를 줄여 1,000 · 4x p95 가 두 프레임 (≈ 40 ms) 에 남을 가능성이 크다. 다른 문장 경우는 3 의 효과가 shaping 비율에 달려 있다 — Phase 0 시제품 뒤 이 표를 고친다.

## 9. 기록

### Phase 0 — 2026-11-26 (G0)

- **문단 재사용 시제품 = go** (`.agent/runs/adr319-phase0/paragraphReuse.cjs`, Node CanvasKit 0.42 + Pretendard, `paragraphMetrics` 와 같은 문단 — font feature · wght/wdth/opsz · strut · halfLeading · run `pushStyle` · chip placeholder): 다른 문장 1,000 + 특수 7 (같은 문장 · 한글 · 자간 · 700 · 행간 없음 · RichText run · token chip) × 폭 11 (95 → 400 → 95 → 250 → 600 → 120 → 95 → 333.3 → 47 → 1000 → 95) = **11,077 비교 불일치 0** (줄 끝 index · 줄 수 · 높이 · 첫 baseline · intrinsic 두 폭). 시간 (다른 문장 1,000 × 끌기 폭 30, 3 회): 새 문단 2,076 ~ 2,129 ms · 재사용 만들기 59 ~ 67 + layout 273 ~ 312 ms → **13.2 ~ 14.6 %**.
- **결정적 카운트** (dev 게이트 `docCounters` — `libraryVisualCalls` · `paintedNodeCalls` · `layoutQueryCalls` · `layoutQueryHandles` · `appliedStyleParses` · `measureKeySerializations` · `measureSourceCalls` · `paragraphBuilds`): `adr319PreviewCost.test.ts` — Frame + 글자 60 개 · 폭 10 단계 + 놓기, 새 workspace 두 번이 같은 값 (등급 A). HEAD `c0d76012d` 값 (같은 문장 / 다른 문장): 칠 해석 2,465 / 2,475 · 칠 등록 613 / 615 · wasm 조회 702 · handle 1,292 · applied style 파싱 682 · 측정 키 직렬화 1,440 · 측정 원천 5 / 300. 가상 격자 3 + 달력 fixture 의 폭 5 단계: wasm 조회 350 · handle 1,435.
- **inventory A** (`paintedNodeData` 입력 — 탐색 결과를 파일:줄로 대조): rect 없이 남는 건 「무엇을 칠할지 정하는 값」 (record 변형 · 분기 · 색 · 불투명도 · 테두리 값) 뿐이고, leaf 출력은 모두 rect 를 펼치거나 폭 · 높이로 계산한다 → 메모 단위는 `SkiaNodeData` 가 아니라 정의 값 층. `catalogLibraryVisual` · `catalogAuthoredVisual` · `catalogDerivedConditionalVisual` 은 record · 정의 · 토큰 (revision) · root 색 모드 (root 상수) 만 읽는다 — 예외는 rule 에 `localeTypography` 가 있는 Label · SegmentedControlItem 의 **조상 locale** (`catalogTypographyLocale` — 조상 record 를 올라간다). 메모하지 않는 것: 조상 · 형제 · 자식 record 를 읽는 분기 (`catalogFieldBox` · `ownerDrawnPartNodeData` · `ownerPartShadow` · `tokenInputChips` · SideNav chevron), 레이아웃 상태 (`textWraps` · `textKeptOnOneLine` · `dateSegmentPaint`), 이미지 캐시 (`readImagesOf` 가 build 중 URL 을 기록 — 메모 적중이면 소유 기록이 빠진다). 이 층 호출은 노드당 5 ~ 6 회였다.
- **inventory B** (`rewrap` 루프): 후보마다 `getLayoutsForIds([id])` 1 회 (wasm) · `usedBorder` 의 `JSON.parse` · `textLeaf` (+ 조상 줄 높이 walk) · 측정 두 번 (한 줄 — 캐시 적중, 줄바꿈 — 폭이 새로우면 원천). 중간 `computeLayout` 은 가상 격자 가지뿐 (달력은 `changed` 만 표시). `rewrapScope` 는 후보마다 parse 2 회. `textLeaf` 의 record 밖 입력 = 상속 줄 높이 · 설치된 기본 서체 (테마 → 새 root).
- **독립 oracle** (HEAD 에서 GREEN): 칠 = 매 단계 등록된 `SkiaNodeData` 전체 ↔ `catalogCanvasNodeData` (Phase 1 부터 메모 우회) 깊은 비교 + 배경 미리보기에서 값이 갈리는 것을 확인 (F8a 의 서명은 같았다). 줄 = 모든 글자의 줄바꿈 높이 · 첫 baseline · rect 를 HEAD 코드로 스냅샷 (`__snapshots__/adr319PreviewCost.test.ts.snap` — 부모 줄 높이 1.5 → 3 미리보기 · 원복, RichText, nowrap, 가상 격자 3 + 달력). 스냅샷은 작업 트리를 HEAD + 카운터로 되돌려 만들고 13 파일 바이트 복원을 확인했다.
- **기준선 production** (dist = HEAD `c0d76012d`, dirty = 다른 세션 문서 5 · 이 dist 에 소스 차이 없음, headed Chrome · idle 20.0 ms): 같은 문장 — 0 · 300 · 1,000 × 1x · 4x 가 기존 표와 같은 모양 (1,000 · 4x p95 41.0 · p99 61.0 · LoAF 309, 300 · 4x LoAF 4, Publish 1,000 · 4x LoAF 1). 버린 표본 0. 다른 문장 · 대조군은 Stop hook 의 type-check 와 겹쳐 버리고 Phase 4 A/B 의 기준 arm 으로 다시 잰다.

### Phase 1 ~ 3 — 2026-11-26 (G1 · G2 · G3 단위 부분)

- **Phase 1 (칠 메모)**: `libraryVisual.ts` — root 마다 `WeakMap<record, …>` 에 `catalogLibraryVisual` (휴지 · 조건) · `catalogAuthoredVisual` (휴지 · 조건) · `catalogDerivedConditionalVisual` 결과를 둔다. 키 = 그래프 revision + (locale typography rule 이면) 해석된 locale. 결과는 freeze. 우회 = `catalogWithoutPaintMemo` (`catalogCanvasNodeData` 가 쓴다). 규칙 `canvas-rendering.md` 에 「이 세 함수에 record 밖 입력을 넣으면 키에도」 한 줄.
- **Phase 2 (`rewrap` 묶기)**: 후보를 구간으로 모아 rect 를 한 번에 읽는다 — 구간 = 다음 가상 격자까지 (그 격자가 중간 `computeLayout` 을 부른다), 후보마다 한 번 (wasm 호출 = 구간 수, handle 합 = rect 를 읽는 후보 수). applied style 은 `PersistentLayoutTree.getAppliedStyleObject` — 노드의 입력 JSON 이 바뀌는 자리 (set · delete · clear) 에서 지우는 parse 결과 (엔진 generation 범위보다 좁다: 다른 노드의 쓰기가 무효화하지 않는다). leaf = `rewrapLeaf` (record 객체 + 상속 줄 높이 + revision). 측정 키 = font 객체마다 폭 없는 키를 한 번 직렬화하고 폭을 뒤에 붙인다 (`textMeasureCache` — 키에 폭은 그대로).
- **Phase 3 (문단 보유)**: `CatalogTextMeasure` 에 5 번째 인자 `leaf` · `hold()`. `textMeasure.ts` 가 보유 중이면 leaf 마다 한 문단 (`font` 객체 · 글자 · run 이 같을 때 재사용, 다르면 그 자리에서 지우고 새로), 마지막 release 에서 전부 `.delete()`. 여는 곳 = `workspace.holdMeasureParagraphs()` — `canvasGesture.showReflow` (host `holdMeasure`) · `catalogStylesHost.previewStyle` 의 크기 · 여백 · 간격 · 테두리 폭 · inset 칸 (`SIZE_PREVIEW_PROPERTIES`). 닫는 곳 = `endReflow` (finish · cancel) · Styles `endPreviews` (미리보기가 하나도 없을 때) · `createRoot` (root 교체) · `refreshFonts` · `dispose` · `CatalogCanvas` cleanup 의 `gestures.cancel()`. 한 hard break 글자 (`pre` 의 여러 줄) 는 보유하지 않는다 (한 leaf 한 문단).
- **카운트 (같은 fixture, HEAD → 수정)**: 칠 해석 2,465 / 2,475 → **30** · wasm 조회 702 → **53** · applied style 파싱 682 → **190** · 측정 키 직렬화 1,440 → **120**. 그대로인 것: 칠 등록 613 / 615 (rect 가 바뀐 노드는 다시 등록), handle 1,292 (후보마다 한 번은 이미 그랬다), 측정 원천 5 / 300 (새 폭은 새로 잰다 — Phase 3 은 그 호출을 layout 만으로 만든다). 가상 격자 fixture: wasm 조회 350 → **225**, handle 1,435 그대로 (격자 수의 제곱으로 늘지 않음 — R1 M2).
- **원복 RED** (`.agent/runs/adr319-phase0/red-matrix.log` — 변이마다 파일 백업 · 복원 · 바이트 비교): 메모 키에서 locale 뺌 = RED (조상 frame 의 `locale` 미리보기 — Label record 는 같은 객체인데 행간 1.5 가 그대로) · 메모 끔 = RED (칠 해석 상한) · leaf 키에서 상속 줄 높이 뺌 = RED (줄 oracle) · 후보마다 조회 = RED (wasm 조회 상한) · 재사용 문단을 폭이 바뀌어도 다시 layout 하지 않음 = RED · 수치 캐시 키에서 폭 뺌 = RED. **메모 키에서 revision 뺌 = GREEN** — 가설 「commit 이 record 객체를 그대로 둔 채 정의 · 토큰 값을 바꾼다」 의 반증 시도 (다른 노드 편집 뒤 그대로 둔 record) 가 같은 값. 재현 시나리오를 찾지 못한 방어 키로 두고 LOW deferred (review-loop-closure §2).
- **보유 수 (실제 CanvasKit + Pretendard, `adr319ParagraphHold.test.ts`)**: 보유 측정 = 새 문단 측정 (fixture 26 × 폭 12, 수치 캐시를 거쳐도 같음) · 글자 편집 미리보기 512 회 보유 0 · 만든 0 · 끌기 중 최대 보유 ≤ 측정 leaf 수 (24) · 같은 leaf 의 글자가 바뀌면 이전 문단 삭제 · 닫는 경우 (release 두 번 · root 교체 · 글꼴 변경 · dispose) 마다 보유 0 · 만든 수 = 지운 수. 제스처: 끌기 한 번에 hold 1, finish · cancel (두 번) 에 release 1 (`phase4eCanvasGesture.test.ts`). 정적: 측정 모듈 밖으로 보유 문단 · 표를 내보내지 않음 · Canvas cleanup 이 `gestures.cancel()`.
- 회귀: builder unit 9,942 통과 (1 expected fail · 9 skip) · shared 2,814 통과 · `pnpm type-check` PASS.

### Phase 4 — 2026-11-26 (G4 · 사용자 결정 1 = 「한계로 기록하고 닫기」)

- **production A/B 교대 3 쌍** (`.agent/runs/adr319-phase4/ab/summary.txt`): base dist = HEAD `c0d76012d`, new dist = HEAD `0ea8c33d8` (그 사이 커밋은 문서뿐) + 이 변경. headed Chrome, 보이는 탭, 1600 × 1000. 순서 = pair 마다 base → new, 같은 문장 (0 · 300 · 1,000 × 1x · 4x × Canvas · Publish) → 다른 문장 (1,000) → 끝에 대조군 Frame. **측정 조건 변화**: pair 3 의 new 같은 문장부터 화면 cadence 가 idle 20.0 → 8.3 ms 로 바뀌었다 (pair 3 다른 문장 · 대조군은 base · new 모두 8.3). 같은 환경 짝만 비교했고, 판정 문턱은 칸마다 그 idle 로 계산했다.
  - 다른 문장 1,000 · 1x — p95 base 60.8 · 60.1 · 75.1 → new 21.1 · 20.6 · 17.1 ms, LoAF 309 → 1 (최대 94 ~ 101 ms — 끌기 시작의 첫 측정이 문단 1,000 개를 만든다).
  - 다른 문장 1,000 · 4x — p95 321 · 300 · 317 → 81 · 81 · 84 ms, p99 359 → 81, LoAF 309 ~ 314 → 309 (매 프레임).
  - 같은 문장 1,000 · 4x — p95 41.9 · 40.9 · 40.9 → 40.7 · 40.0 · 35.5, p99 79.1 · 79.2 · 60.1 → 41.1 · 41.8 · 50.0, LoAF 309 → 293 · 230 · 17 (17 = pair 3 의 바뀐 cadence).
  - 300 · 4x Canvas — LoAF 4 · 3 · 4 (최대 ≈ 54 ms) → 2 · 1 · 0. Publish (DOM — 이 변경이 닿지 않음) 4x 에도 LoAF 1 ~ 4 (≈ 60 ms) 가 있다.
  - 0 글자 · Publish 전 칸 — 차이 없음. 대조군 Frame 1,000 · 4x p95 50.5 → 41.3 (한 번씩).
- **G4 기술 판정**: 1,000 · 4x 두 벌의 p99 · LoAF 수 감소 ✓ · 다른 문장 1,000 · 1x p95 감소 ✓ · 0 글자 회귀 없음 ✓ · 300 · 4x LoAF 0 ✗ (4 → 0 ~ 2). **절대 기준 미달** (모든 칸 p95 ≤ max(16.7, idle + 1.7) 그리고 LoAF 0): 1,000 · 4x 두 벌 · 다른 문장 1,000 · 1x (LoAF 1) · 300 · 4x. → 사용자 결정 1 = 「한계로 기록하고 닫기」 (2026-11-26).
- **CPU 프로필** (같은 dist 로 교대 3 쌍 · `PROFILE=1` 1,000 · 1x, `.agent/runs/adr319-phase4/profile/summary.txt` — 포함 시간 ms): `paintedNodeData` 826 · 832 · 825 → 384 · 388 · 392 (**G1 −53 %**). 다른 문장 `catalogTextMeasure` 17,602 · 17,458 · 17,418 → 2,458 · 2,486 · 2,498 (**G3 −86 %**). `rewrap` 같은 문장 771 · 773 · 783 → 404 · 399 · 405 (측정이 캐시 적중이라 거의 전부 측정 밖 몫 — **G2 −48 %**). 다른 문장의 측정 밖 몫 — 하니스가 원본 프로필을 저장하도록 고친 뒤 (`profile-*.cpuprofile`) 한 쌍을 다시 재어 나눔 (`profile-raw/`): `rewrap` 19,286 = 측정 17,380 + 엔진 `computeLayout` 494 + 나머지 1,412 → 3,821 = 2,463 + 496 + 862 (**G2 −39 % — 목표 40 % 에 1 %p 미달**). 나머지 862 의 절반 (≈ 400 ms) 이 측정 캐시 감싸개 (`textMeasureCache` `measure`) 자체 시간이다 — 끌기 300 걸음 × 글자 1,000 × 측정 2 = 60 만 호출 × ≈ 0.6 µs 의 Map 연산 (키 직렬화는 Phase 2 가 1,440 → 120 으로 줄였다). 폭 키 문자열 재사용을 시도해 Node 에서는 −35 % 였으나 브라우저 프로필에서 감싸개 + 키 함수 합이 그대로라 (402 → 370 + 49 ms) 되돌렸다.
- **`/cross-check` (그림 불변)**: 하니스가 끌기 뒤 찍은 Canvas 스크린샷을 같은 환경 base ↔ new 로 픽셀 비교 — 같은 문장 0 · 300 · 1,000, 다른 문장 1,000, 대조군 모두 0 px (오른쪽 위 chrome 의 1 px Δ9 깜빡임은 new ↔ new 에도 있다). pair 3 의 51,499 px 차이는 cadence 가 바뀐 환경 차이로 base ↔ base 에도 같다.
- **live** (dev 5173, `.agent/runs/adr319-phase4/live/live.log`): Panel · 다크 테마 뒤 · 끌기 중 글꼴 변경 · 끌기 중 뒤로가기 · Frame — 보유 ≤ 300 (leaf 수) → 0, 만든 = 지운, 오류 0. 힙: GC 뒤 JS 125.7 → 128.7 MB · CanvasKit 128 MB 그대로.
- **번들 Δ** (일반 `vite build` — 작업 트리 ↔ 소스 11 파일을 HEAD 로 바꾼 빌드, 백업 · trap · 바이트 복원 확인): Builder initial JS gzip 1,636,475 → 1,637,725 (+1,250 B, 상한 1,650,000 안) · CSS · Chart lazy 0.
- **ratchet**: `pnpm gate:perf-ratchet` 은 push 대상 커밋 (HEAD) 을 전용 worktree 에서 잰다 — 이 변경은 미커밋이라 측정 대상이 아니다 (실행 결과 「런타임 경로에 미커밋 변경 13」 + 5179 포트를 옛 ratchet 서버가 쓰고 있어 중단). 커밋 뒤 실행하고, 카운트가 줄어든 seed 는 같은 커밋의 `--update` 로 상한을 내린다 (R5 — 줄어드는 방향이라 block 아님).
- **정적 판독** (`/review`, 1 회): merge 를 막을 문제 0. LOW deferred 1 — Styles 칸 끌기 도중 패널이 사라지면 그 보유는 다음 Styles commit · root 교체 · 글꼴 변경 · dispose 까지 남는다 (leaf 수 이하 · 결과 동일 — production 에서 깨지는 시나리오 없음).
- **하니스**: `adr318-heavy-panel-frame.mjs` 의 `PROFILE=1` 이 원본 CPU 프로필 (`profile-<N>.cpuprofile`) 도 저장한다 — 상위 40 줄 밖 호출 나눔 · DevTools 용.
