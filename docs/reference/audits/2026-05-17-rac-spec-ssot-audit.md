# RAC 기반 spec 컴포넌트 SSOT 정합성 전수 재검사

> 작성: 2026-05-17 · 대상: `packages/specs/src/components/*.spec.ts` 119개
> 방식: 구조 grep audit (Phase 1) + 119개 전수 시각 cross-check (Phase 2)
> 참조 규칙: `.claude/rules/ssot-hierarchy.md` (3-domain) / ADR-907 / ADR-908 / ADR-909

## 요약

| Phase                      | 범위                                  | 상태                        |
| -------------------------- | ------------------------------------- | --------------------------- |
| Phase 1 — 구조 audit       | 119 spec — D1/D2/D3 + ADR-907/908/909 | 완료 — 클린 (F1 LOW 1건)    |
| Phase 2 — 시각 cross-check | 대표군 CSS↔Skia (전수 자동화 한계)    | 대표군 일치, 전수 미완 (F2) |

## Phase 1 — 구조 SSOT audit (전수 grep)

### 검사 항목 및 결과

| 항목                                   | 패턴                                       | 결과                                                                  |
| -------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| D1 침범 — spec이 DOM/ARIA 생성         | `render.react` 의 `role`/`aria-*`          | 위반 아님 (F1 참조 — dead path)                                       |
| D3 — `@sync` consumer-to-consumer 참조 | `@sync` 주석                               | 0건 (4건 전부 "formerly @sync", ADR-105-d/106-b 제거 완료)            |
| D3 — legacy fill 필드 (ADR-908)        | `backgroundHover` 등 VariantSpec 직접 필드 | 0건 (Card/DropZone는 local const 이름 — historical 허용)              |
| D3 — fill 직접 property access         | `variant.background` 등                    | 0건                                                                   |
| D3 — skipCSSGeneration ↔ CSS 페어링    | 27 spec                                    | 클린 (sub-part 부모 CSS / 합성 태그 / Skia-only / 스텁 — 전부 의도됨) |
| ADR-907 — ad-hoc parseFloat 파싱       | `parseFloat(String(` (spec)                | 0건                                                                   |
| ADR-909 — `style.gap` 단독 읽기        | spec 내 longhand 미경유                    | 0건 (2건은 주석)                                                      |

### 계약 테스트 (구조 SSOT gate)

| 테스트                                                                               | 결과                    |
| ------------------------------------------------------------------------------------ | ----------------------- |
| ADR-907 Layer C `rendererStyleContract.test.ts`                                      | 12/12 PASS              |
| `@composition/specs` 전체 (CSSGenerator snapshot · spec validate · spacing contract) | 326/326 PASS (23 files) |

### 발견 사항

#### F1 — dead consumer 체인: `renderToReact` / `ReactRenderer` / `spec.render.react`

- 심각도: **LOW** (dead code · 시각 영향 0 · 기능 버그 아님)
- `packages/specs/src/renderers/ReactRenderer.ts::renderToReact` 는 정의 + `index.ts`/`renderers/index.ts` 재export 만 존재, **호출처 0건** (`grep -rn renderToReact` 전수).
- `renderToReact` 내부 `ReactRenderer.ts:54-61` 는 `spec.render.react()` 반환값 중 **`data-*` 키만 소비** — `role`/`aria-*` 는 버려짐.
- 결과: 20+ spec 의 `render.react` 가 반환하는 `role: "grid"` / `aria-label` 등은 **어디에도 도달하지 않음**. Preview ARIA 는 RAC 컴포넌트(D1 권위)가 직접 제공 → SSOT 위반 아님, 단 spec 이 ARIA 를 제어하는 듯한 **오해 소지 dead code**.
- 권고: `render.react` 의 비-`data-*` 키 제거 또는 `renderToReact` 체인 제거 검토 (별도 작업 — 본 audit 범위에서 수정 안 함, 시각 무영향).

## Phase 2 — 시각 cross-check (대표군)

> CSS Preview(DOM) ↔ Skia Canvas 시각 대칭. Builder Compare Mode 사용.
> 사용자 결정 (2026-05-17): preview iframe 자동화 한계로 119 전수 → 대표군으로 전환.

### 검증 환경

- **도구**: Builder `Compare Mode` — `.workspace--compare-mode` 가 좌 "CSS"(`#previewFrame` = `/preview.html` iframe) / 우 "Canvas"(Skia) 분할 렌더.
- **컴포넌트 투입**: `window.__composition_STORE__` 의 `addElement` (store API). 기존 프로젝트(11 element)에 임시 추가 후 `removeElement` 정리 — 검증 후 원상 복원 확인.

### 검증 결과

| Batch    | 컴포넌트                                                                         | CSS↔Skia 판정                                                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — leaf | Button / Badge / Checkbox                                                        | ✅ 일치 — 검정 Button(둥근 모서리), 파란 pill Badge, 사각 Checkbox 양 패널 동일                                                                                                                    |
| 2 — form | Switch / Slider                                                                  | ✅ 일치 (가시 범위) — Switch 토글·Slider 파란 트랙+thumb 양 패널 동일. TextField/NumberField/SearchField 는 store-API bare add 로 factory child(Label+Input) 미포함 → label-only 렌더, 비교 부적합 |
| 3 — leaf | StatusLight / ProgressBar / ProgressCircle / Meter / ToggleButton / Avatar / Tag | ⚠️ 미확정 — Skia 패널은 전부 정상 렌더, 그러나 CSS preview 패널이 blank 렌더 (preview iframe 간헐 실패)                                                                                            |

### 발견 사항

#### F2 — preview iframe 자동화 불안정 (방법론 한계, 코드 결함 아님)

- 심각도: **N/A** (검증 인프라 제약 — 컴포넌트 SSOT 결함 아님)
- Builder `Compare Mode` 의 `#previewFrame`(`/preview.html`)은 postMessage 로 구동되는 thin renderer. store API 직접 mutation 시 (a) iframe 이 간헐적으로 blank/stale 렌더 (batch 3), (b) cross-iframe `contentDocument` 폴링이 렌더러 freeze 유발 (45s timeout), (c) compare-mode 레이아웃이 mutation 시 재마운트.
- 결과: Chrome MCP 로 119/30 컴포넌트를 스크립트 일괄 cross-check 하는 자동화는 현 환경에서 신뢰 불가.
- store-API bare add 는 factory child 구조를 생성하지 않음 → container/composite/form 컴포넌트는 정상 초기화 cross-check 불가 (UI 팔레트 경로 필요, 이 역시 검색창 입력 미반영 등 자동화 friction).

### 시각 SSOT 의 대체 보증

자동 시각 cross-check 의 공백은 아래 **기존 build-time gate** 가 보전한다:

- `CSSGenerator` snapshot 테스트 — Spec → CSS 출력이 byte-stable (Phase 1 에서 specs 326/326 PASS 확인). Skia 렌더는 동일 Spec 소비 → 두 consumer 가 같은 D3 소스에서 파생.
- ADR-907 Layer C `rendererStyleContract.test.ts` 12/12 — renderer root style 계약.
- 검증된 대표군(Button/Badge/Checkbox/Switch/Slider)은 CSS↔Skia 시각 일치.

### 권고

엔진-레벨 픽셀 drift 의 엄밀한 전수 시각 검증은 안정적 harness (Storybook 시각 회귀 또는 전용 dual-render 테스트 페이지)가 필요 — 별도 인프라 작업으로 분리 권고. 현 시점 SSOT 정합성은 구조 audit(Phase 1) + 위 build-time gate + 대표군 시각 확인으로 확보.

## 종합 판정

- **구조 SSOT (Phase 1)**: 클린 — D1/D2/D3 위반 0, ADR-907/908/909 계약 테스트 전부 통과. 발견 F1(dead `renderToReact` 체인, LOW).
- **시각 SSOT (Phase 2)**: 대표군 일치 확인. 전수 자동 시각 검증은 preview iframe 자동화 한계(F2)로 미완 — 기존 snapshot gate 가 Spec→CSS byte-stability 보증.
- **즉시 수정 필요 CRITICAL/HIGH**: 0건.
