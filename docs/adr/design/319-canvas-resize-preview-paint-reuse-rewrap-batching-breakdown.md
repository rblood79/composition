# ADR-319 breakdown — Canvas 크기 미리보기 비용: 칠 해석 재사용 · 줄바꿈 계산 묶기 · 측정 문단 재사용

> 본문: [ADR-319](../319-canvas-resize-preview-paint-reuse-rewrap-batching.md). 이 문서는 Phase · 파일 · 완료 기준 · 기록을 둔다.

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

(Phase 를 닫을 때 추가)
