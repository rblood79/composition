# EXTERNAL_PATTERN_DELTA §D 그룹 A — 순서 2·3 반영 증거 (2026-09-05)

정본 판정: [EXTERNAL_PATTERN_DELTA_2026-09.md](../../explanation/research/EXTERNAL_PATTERN_DELTA_2026-09.md) §D.
두 항목 모두 **기본 경로 동작 변경 0** — `.claude/rules/review-loop-closure.md` §3 의 축소 절차
(새 게이트가 반응하는 행만 원복 RED · 해당 패키지 스위트 · live 생략 가) 를 적용한다.
파일 집합이 분리돼 (builder 주석·문서 ↔ Rust 엔진·하니스) 한 phase 로 묶었다.

## 순서 2 — fulgur ⑤ Taffy 잔재 sweep + 매트릭스 생성 (`a34e1b66c`)

### 인벤토리 (착수 전)

| 대상                        | 건수                                    |
| --------------------------- | --------------------------------------- |
| builder 비테스트 소스       | 35 파일 · 약 135 줄                     |
| `docs/CSS_SUPPORT_MATRIX.md`| 71 건 (전부 ADR-916 에서 삭제된 파일 인용) |
| `docs/COMPONENT_SPEC.md`    | 30+ 건 (서술 26 · 변경 이력 4)          |

### 판정 기준

이름을 금지하지 않는다 — **제거·개명·계보를 명시적으로 말하는 문장**은 남는 편이 낫다.
표식 (`완전 제거` · `구 \`Taffy…\`` · `0.9 계보` · `개명` · `Taffy pkg` · `taffy-free` …) 없이
이름만 현재형으로 쓰는 줄만 바꿨다. 결과: src 25 줄이 역사 서술로 남고 나머지는 "엔진" 으로.
`COMPONENT_SPEC.md` 의 변경 이력 표 4 줄도 그대로 뒀다 (시점 기록).

### 게이트 2개 — 반응 확인

| 게이트                                    | RED probe                                                              | 결과 |
| ----------------------------------------- | ---------------------------------------------------------------------- | ---- |
| `staleDependencyNaming.static.test.ts`    | `layoutContext.ts` 에 `// RED probe: Taffy 가 자동 계산한다` 한 줄 추가 | 해당 줄을 파일:행과 함께 지목하며 FAIL → 원복 후 PASS |
| `codex:engine-matrix` (preflight)         | `layoutCapabilityMatrix.ts` 의 S7 gap `dy: 20 → 21`                    | `DRIFT` 로 exit 1 → 원복 후 `OK — 3 행 일치` |

### 매트릭스 생성

`scripts/generate-engine-matrix.mjs` 가 `layoutCapabilityMatrix.ts` (import 0 인 자족 모듈 —
builder 모듈 그래프를 끌어오지 않으려는 의도적 선택, §A5-5) 를 정규식으로 읽어
`docs/CSS_SUPPORT_MATRIX.md` 의 `<!-- engine-matrix:begin/end -->` 블록을 쓴다. 행 3개
(S4 `display:inline` · S7 `float` · S8 `subgrid`/`dense`) + Chrome 격차 실측치.

**정본 범위 확인 (문서가 요구한 선행 확인)**: `layoutCapabilityMatrix.ts` 는 **seed** 다 —
S4/S7/S8 만 선언하고 헤더가 "집행은 별도 결정" 이라고 말한다. 1,275 행 문서 전체의 정본이
아니므로 생성 범위를 §0 블록으로 한정하고, 손 편집 본문은 2026-04-06 스냅샷임을 머리말에
밝혔다. 삭제된 파일명만 현재 것으로 고쳤고 (`TaffyFlexEngine.ts` → `flexStyleAdapter.ts` 등)
검증 불가한 행 번호는 뗐다.

### 회귀

`canvas/layout` 482 PASS (58 파일) · `pnpm type-check` PASS.

## 순서 3 — fulgur ② wasm 입력 strict 모드 (`f40e40051`)

### 설계 — `deny_unknown_fields` 대신 이름 표

문서는 "`deny_unknown_fields` 변형 (별도 타입)" 을 제안했다. 그대로 하면 55 필드 구조체를
복제해야 하고 복제본은 조용히 드리프트한다. 대신:

- `NODESTYLE_FIELD_NAMES` (serde camelCase 이름 표) + `TS_OWNED_INPUT_KEYS` (통과 목록)
- `nodestyle_serde_names_match_field_table` 이 `Serialize` 로 직렬화한 **serde 실제 키 집합**과
  기계 대조 → 표가 드리프트하면 RED
- strict 검증은 `strict_input` 이 true 일 때만 실행 — 기본 경로가 지나는 것은 분기 하나

### 첫 strict run = 인벤토리 (문서 §A4-2 "첫 run" 그대로)

parity `pipelineLeg` (production 파이프라인이 만든 payload) 에 strict 를 켠 첫 실행:

- 새 실패 **1건**, 키는 `style.whiteSpace` 하나뿐
- 코드 대조로 `style.order` 도 같은 부류임을 확인 (`utils.ts:5872` 가 싣고 `NodeStyle` 미선언)

둘 다 **TS 소유**라 엔진이 안 읽어도 결과가 맞다 — `whiteSpace` 는 텍스트 줄바꿈을 TS 측정이
소유해 `contentMinWidth`/`contentMaxWidth` 스칼라로 환원해 보내고 (ADR-165), `order` 는
`fullTreeLayout.ts` 가 TS 에서 미리 정렬해 batch 배열 순서로 넘긴다. 사유와 함께
`TS_OWNED_INPUT_KEYS` 에 등재했다. 새 무음 드롭은 strict 실패로 남는다.

### strict 를 `engineLeg` 이 아니라 `pipelineLeg` 에 둔 이유

`engineLeg` 에 켠 첫 시도는 **77건이 실패**했다 — 키는 `style.left` · `style.top` ·
`style.borderTopStyle` 류. `engineLeg` 이 받는 케이스 `style` 은 두 leg 이 공유하는
**DOM ∪ 엔진 키의 합집합**이다 (`borderTopStyle` 이 없으면 DOM leg 이 테두리를 안 그린다).
엔진이 안 읽는 것이 정상이라 그 자리의 strict 는 가짜 실패다. "파이프라인이 보냈는데 엔진이
버렸다" 가 성립하는 곳은 production payload 를 만드는 `pipelineLeg` 뿐이다.

### 원복 RED (게이트가 반응하는 행)

- `strict_input_rejects_unknown_keys_default_path_accepts` — 같은 payload 가 기본 경로는 Ok,
  strict 는 Err 이고 오류 문자열이 `style.gap` 을 지목
- `strict_input_allows_ts_owned_keys` — 등재 키는 strict 통과, 진단(`collect_unknown_keys`)은
  여전히 전부 보여준다 (버려지는 사실 자체는 숨기지 않는다)
- `nodestyle_serde_names_match_field_table` — 표와 serde 키 집합 대조

### 부수 정정 — 상수 드리프트

`NODESTYLE_FIELD_COUNT = 54` 인데 `NodeStyle` 은 **55 필드**였다. ADR-204 Phase 2 가
`contentMinHeight` 를 더하며 상수를 안 올렸고, 기존 "산술 계약" 단언은
`CONSUMED_COUNT(54) + UNCONSUMED(0) == NODESTYLE_FIELD_COUNT(54)` 로 **상수끼리만** 비교해
GREEN 이었다 (전수 구조분해는 exhaustiveness 만 증명하고 개수는 못 본다). 둘 다 55 로 고치고,
새 이름 표 대조가 앞으로 이 드리프트를 잡는다.

### 회귀

- Rust 417 PASS (`cargo test`) · clippy 경고 9 = baseline 9 (증가 0)
- `pnpm wasm:build:engine` 성공 (wasm.rs 는 `cfg(target_arch = "wasm32")` 라 native 빌드로는
  검증되지 않는다 — wasm-pack 빌드가 유일한 확인)
- `pnpm type-check` PASS
- `test:parity` 1056 PASS — **baseline 과 동일**

### 이번 변경과 무관한 기존 실패 (baseline 대조로 확인)

- 파일 13개 수집 실패: `canonicalElementsView.ts` 가 `getCanonicalDocumentElementsView` 를
  export 하지 않는다 (테스트가 그 이름을 import). `git stash` 대조에서 동일 재현
- 테스트 2건: `catalogComponentBox.browser.test.ts` 의 GridListItem · Tooltip (ADR-171 Phase 5)

## 범위 밖 (§D 순서대로 후속)

순서 4 (pretext ③ letterSpacing — grapheme 수 캐시가 착수 조건) · 순서 5 (pretext ② 이모지 보정
— DPR 2 헤드 환경 재현 확인 후). fulgur ③·④·① 은 C 등급으로 트리거 전 보류.
