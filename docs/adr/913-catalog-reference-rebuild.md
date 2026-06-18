# ADR-913: catalog 컴포넌트 레퍼런스 기준 재구축

## Status

Proposed — 2026-06-18

## Context

ADR-912 (Implemented 2026-06-18) 로 컴포넌트 시각 SSOT 가 `*.spec.ts` 에서 catalog `COMPONENT_RULES_TABLE` 단일 정본으로 전환됐다. 그러나 이 정본의 **값** 자체는 catalog/spec 이 없던 초기에 react-aria-starter 를 여러 번 **수동 가공**해 만든 누적분이다 ([[project-catalog-reference-rebuild-framing]]). RAC/RSC 라이브러리 업데이트 대응 개념 없이 누적된 수동 drift 라, ADR-912 완료 후에도 다음 문제가 남는다:

- catalog rule 값이 starter 구조 + design.md/token reference 대비 drift 되어 **레퍼런스 디자인 갭이 크다** (본 ADR 처방의 표적).
- CSS preview (Preview/Publish DOM) 와 Skia 렌더 (Builder canvas) 는 같은 `COMPONENT_RULES_TABLE` 을 읽는 **대등 consumer** 이므로, rule 값 재정렬 시 양쪽이 함께 이동해야 한다 (정합 불일치는 처방의 표적이 아니라 동반 결과). 잔여 consumer 해석 차이(token 환원·hover/pressed 색 모델)는 R1/R3 위험 + G1/G3 Gate 로 관리한다.
- 한 컴포넌트만 부분 패치하면 공유 토큰 scale·횡단 표준(field-height/group-seam) 연계성으로 **레퍼런스 갭이 오히려 증폭**된다.

본 ADR 은 catalog 컴포넌트 시각 값을 레퍼런스(starter 구조 + design.md/css-tokens 토큰값) 기준으로 **family 단위 재구축**하는 전략을 결정한다.

**3-Domain 분류 (ssot-hierarchy.md)**: 본 ADR 은 **D3 (시각 스타일)** 내부 작업. catalog rule = D3 SSOT 의 값 재정렬. D1(RAC DOM/ARIA) / D2(binding props) 미변경. starter = D3 저작의 입력 레퍼런스(정본 아님, design.md line 5 "reference baseline, not runtime SSOT" 자기 선언).

**Hard Constraints**:

1. `ComponentRule` schema (`composition-document.types.ts:98-381`) **변경 금지** — 값만 재작성 (schema 확장은 별도 ADR).
2. radius/typography/spacing 수치 토큰 정본 = composition primitives(Skia `primitives/*.ts`)/shared-tokens(CSS) **유지** — starter 값(radius sm 6 ≠ primitives 4)으로 re-scale 금지.
3. 공유 토큰 변경 시 blast radius 0 — slice 외 family 의 generated CSS byte diff 0 + Skia snapshot 불변.
4. 각 slice 는 CSS↔Skia 시각 대칭(/cross-check) 통과 필수 (D3 symmetric consumer 계약).
5. 현 catalog custom variant (premium/genai 등 S2 외) 소실 0건.

**Soft Constraints**:

- 자동화율 실측: 적대적 검증(Workflow wc24s1828) 결과 "결정론 변환" 영역이 color base 값 + 스칼라 추출까지로 축소 — 변환 도구 ROI 낮음.
- family 간 manual 비중 편차 큼 (Button 중 ~ Collection 최대).

## Alternatives Considered

### 대안 A: starter→catalog 반자동 변환기 신규 구축

- 설명: starter CSS + design.md Mapping 을 입력으로 rule(variants/sizes/fill)을 (반)자동 생성하는 스크립트 제작. RAC 업데이트 시 재실행.
- 근거: ADR-912 가 제거한 `generate-rules.ts`(spec→table) 의 자리를 starter→table 변환기로 대체하려는 발상. 체계적 RAC 대응이 동기.
- 위험:
  - 기술: **HIGH** — 적대적 검증 3렌즈 모두 `proof-overclaims`. "starter theme.css 값 → rule TokenRef 결정론 lookup" 변환 방향이 **존재하지 않음**: `{radius.sm}` 실제 정본은 starter 가 아니라 composition primitives(Skia sm 4)/shared-tokens(CSS var), starter 값(sm 6)은 양쪽 모두와 불일치. variant 축은 starter 와 **불일치**(starter Button = primary/secondary/quiet 3축 — `Button.tsx:12` `variant?` + `utilities.css:47-51` `[data-variant]`; Button.css 자체엔 data-variant 0) — 축 불일치라 1:1 결정론 변환 불가. 자동화 가능 영역이 color base + 스칼라로 축소.
  - 성능: LOW — build-time 도구, 런타임 영향 없음.
  - 유지보수: **HIGH** — 자동화율이 낮은 도구는 출력 검수 비용 + 도구 자체 유지 비용이 이중. variant 구조/size scale/state 파생/elevation 전부 수동 보정 필요 → 도구가 "md 1단 color 초안 생성기" 에 그침.
  - 마이그레이션: MEDIUM — 도구 출력을 신뢰했다가 정정 반복 시 rollback.

### 대안 B: 변환 체크리스트(문서) + family 단위 수동 재작성

- 설명: 별도 도구 없이, starter 구조 → rule 변환 규칙을 체크리스트로 문서화하고 family 단위로 사람이 수동 재작성. 결정론 영역(color base/스칼라)은 체크리스트 기계 적용, 수동 영역(variant 구조/size scale/state)은 표기 후 판단. CSS↔Skia Gate 는 도구 유무와 무관하게 동일 적용.
- 근거: 자동화율 실측 gap (design 추정 vs 적대 검증 후 축소) 이 도구 ROI 를 무너뜨림. composition 의 family vertical slice + proof gate 선례 ([[feedback-proof-gate-seam-removal-kill-criteria]]) 와 정합.
- 위험:
  - 기술: LOW — 수동이라 변환 방향 오류(대안 A 의 starter 값 오채택) 자체가 발생 안 함. 체크리스트가 결정론 영역만 기계화.
  - 성능: LOW — 런타임 영향 없음.
  - 유지보수: MEDIUM — RAC 업데이트 시 자동 재실행 불가, 수동 반복. 단 체크리스트가 절차를 고정해 누적 drift(현재 문제의 근본 원인)는 차단.
  - 마이그레이션: LOW — family 단위 점진, slice 별 kill gate 로 회귀 표면 최소.

### 대안 C: 전체 118 ComponentRule entry 일괄 재작성 후 한 번에 교체

- 설명: family 분할 없이 전 rule 을 레퍼런스 기준으로 일괄 재작성 후 한 번에 교체. **대상 단위 = `COMPONENT_RULES_TABLE` ComponentRule entry 118개** (componentCatalog 112개와 별개 — rule-only 6개 Group/Header/Image/MenuItem/TabPanel/TabPanels 포함). 본 ADR 의 시각 정본은 ComponentRule entry 이므로 재구축 대상은 118.
- 근거: 연계성 갱장 제거가 확실 (모든 토큰이 동시 정렬).
- 위험:
  - 기술: MEDIUM — 변환 규칙 자체는 대안 B 와 동일.
  - 성능: LOW.
  - 유지보수: MEDIUM.
  - 마이그레이션: **HIGH** — 검증 표면이 118 entry 동시 → CSS↔Skia 대칭 회귀 시 원인 격리 불가. proof gate(작은 family 로 kill criteria 확인 후 확장) 부재 → ADR-144 revert(34 commit) 유형 재발 위험.

### Risk Threshold Check

| 대안                |  기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ------------------- | :----: | :--: | :------: | :----------: | :--------: |
| A (변환기)          |  HIGH  | LOW  |   HIGH   |    MEDIUM    |     2      |
| B (체크리스트+수동) |  LOW   | LOW  |  MEDIUM  |     LOW      |     0      |
| C (일괄 교체)       | MEDIUM | LOW  |  MEDIUM  |     HIGH     |     1      |

루프 판정: 대안 B 가 HIGH+ 0개로 threshold 통과. 대안 A 의 기술 HIGH 는 "존재하지 않는 변환 방향" 이라 새 대안으로 회피 불가능(입력 부재가 근본). 대안 C 의 마이그레이션 HIGH 는 family slice(대안 B)로 회피됨. 추가 루프 불필요.

## Decision

**대안 B: 변환 체크리스트(문서) + family 단위 수동 재작성**을 선택한다.

선택 근거:

1. 적대적 검증(Workflow wc24s1828) 실측으로 대안 A 의 자동화 전제가 무너졌다 — "starter 값 → rule 결정론 변환" 방향은 존재하지 않고(토큰 정본이 composition primitives 이지 starter 아님), 자동화 가능 영역이 color base+스칼라로 축소돼 도구 ROI 가 없다. 수동 재작성이 오히려 변환 방향 오류를 원천 차단한다.
2. 잔존 위험은 "RAC 업데이트 시 수동 반복"(유지보수 MEDIUM) 뿐이고, 체크리스트가 변환 절차를 고정해 현재 문제의 근본 원인(절차 없는 누적 drift)을 차단하므로 수용 가능하다.
3. family vertical slice + kill gate 는 composition 의 검증된 패턴([[feedback-proof-gate-seam-removal-kill-criteria]])이고, 대안 C 의 마이그레이션 HIGH(원인 격리 불가)를 회피한다.

기각 사유:

- **대안 A 기각**: 자동화율이 도구 제작·유지 비용을 정당화하지 못함. 변환 방향(starter→토큰값) 자체가 존재하지 않아 도구가 틀린 값을 산출할 위험(토큰 정본은 composition primitives).
- **대안 C 기각**: proof gate 부재로 118 entry 동시 교체 시 CSS↔Skia 회귀 원인 격리 불가 (마이그레이션 HIGH).

토큰 정본 방향 결정 (사용자 confirm 2026-06-18): radius/typography/spacing 수치 토큰은 **composition primitives/shared-tokens 유지**. starter 는 variant 축·state·orientation **구조** 와 **누락 컴포넌트** 레퍼런스로만. custom variant(premium/genai)는 **보존** (S2 4 + catalog 2 = 6).

> 구현 상세: [913-catalog-reference-rebuild-breakdown.md](design/913-catalog-reference-rebuild-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                   | 심각도 | 대응                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------- |
| R1  | slice 작업자가 토큰 정본을 starter 값으로 닫아(radius starter 6 ≠ primitives 4) Skia/CSS 어느 한쪽이 primitives 정본과 발산 (현 composition 은 양 어댑터 모두 `{radius.sm}`=4 로 일치 — starter 값 채택 시에만 발산)                                                                                                   |  HIGH  | G1 토큰 환원 정합 Gate — 양 경로 시각값 동일 확인, 발산 시 slice 재보정                                          |
| R2  | 공유 토큰(`{radius.md}` 69블록·`{typography.text-sm}` 119블록) 수정이 slice 밖 family 를 의도치 않게 re-scale                                                                                                                                                                                                          |  HIGH  | G4 cross-component 회귀 Gate — slice 외 byte diff 0 + Skia snapshot 불변                                         |
| R3  | hover/pressed 색 모델 불일치 (starter OKLCH ↔ rule color-mix srgb) 로 state 시각 발산                                                                                                                                                                                                                                  | MEDIUM | G3 CSS↔Skia 대칭에 state 셀 포함, 발산 시 수동 검수 격리. color-mix 모델 유지(현 D3 SSOT)                        |
| R4  | 수동 재작성이 "결정론 표기" 한 필드를 실제론 정정 필요 (overclaim 재발)                                                                                                                                                                                                                                                | MEDIUM | G5 자동화율 floor Gate — 결정론 표기 필드 정정 0 검증, 반복 시 체크리스트에서 영구 제외                          |
| R5  | elevation(box-shadow) 단색 평탄화로 starter 입체감 손실                                                                                                                                                                                                                                                                |  LOW   | ADR-142 의도된 평탄화 유지. schema(boxShadow) 확장은 별도 ADR (본 scope 밖)                                      |
| R6  | rule table 편집 후 generated CSS 재생성 누락 시 Skia(런타임 직독)만 갱신되고 CSS(커밋 빌드 산출물)는 stale → preview↔Skia 발산 (= 본 ADR 이 해소하려는 문제의 재발 경로). rule table 은 `packages/shared/` 경로라 `spec-rebuild-flag.sh`(packages/specs 만 매칭)·turbo build 가 `generate:css` 를 자동 트리거하지 않음 |  HIGH  | G6 CSS 재생성 정합 Gate — slice 변환 시 `pnpm generate:css` 재실행 + CSS diff 커밋 + `validate:sync` PASS 의무화 |

## Gates

| Gate                    | 시점          | 통과 조건                                                                                                                     | 실패 시 대안                                                                                                                                    |
| ----------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 토큰 환원 정합       | slice 변환 시 | TokenRef 의 Skia 해석값 = CSS var 해석값 시각 동일                                                                            | starter 값으로 닫아 한쪽 발산 시 slice 재보정, starter→catalog 자동 generate 폐기                                                               |
| G2 variant 구조 보존    | slice 변환 후 | 출력 variant 집합 ⊇ 현 catalog (premium/genai 소실 0)                                                                         | S2 derive 만으로 채워 custom 누락 시 구조 입력 = S2+catalog 병합 재설계                                                                         |
| G3 CSS↔Skia 시각 대칭   | slice 완료 시 | variant×size×state 매트릭스 전 셀 시각 일치 (Chrome MCP /cross-check)                                                         | hover/pressed 모델 치환 발산 시 state 파생 수동 검수 격리                                                                                       |
| G4 cross-component 회귀 | slice 완료 시 | slice 외 family generated CSS byte diff 0 + Skia snapshot 불변                                                                | blast radius 초과 시 family 전역 회귀 검증 의무 편입                                                                                            |
| G5 자동화율 floor       | 각 slice      | '결정론 생성' 표기 필드 manual 정정 0                                                                                         | 반복 정정 시 autoConvertible 영구 제외, scope 를 color base+스칼라 축소                                                                         |
| G6 CSS 재생성 정합      | slice 변환 시 | rule 편집 후 `pnpm generate:css` 재실행 + 산출 CSS diff 커밋 + `validate:sync` PASS (Skia 런타임 직독 ↔ CSS 빌드 산출물 동기) | CSS 재생성 누락으로 G4 byte-diff 입력 미정의 시 slice 차단 — `validate:sync` 를 slice 완료 게이트로 강제, hook 매칭 경로에 rule table 편입 검토 |

## Consequences

### Positive

- catalog 시각 값이 레퍼런스(starter 구조 + composition 토큰 정본) 기준으로 정렬 → 레퍼런스 디자인 갭 해소. CSS preview ↔ Skia 는 대등 consumer 라 rule 정렬이 양쪽에 동반 반영 (정합은 처방 표적이 아닌 부수 결과, 잔여는 G1/G3 Gate 관리).
- 변환 체크리스트로 변환 절차 고정 → RAC/RSC 업데이트 대응 시 누적 drift(현재 문제 근본 원인) 차단.
- 누락 컴포넌트 4 (ColorThumb/CommandPalette/InputGroup/Sheet) 신규 등록 + orientation/labelPosition containerVariants 비대칭 보정 (slice 진행 중 흡수).
- family slice + kill gate 로 회귀 표면 최소, 원인 격리 가능.

### Negative

- RAC 업데이트 시 자동 재실행 불가 — family 단위 수동 반복 (도구 미제작 trade-off).
- Collection family 는 manual 비중 최대(::after divider/grid-area/orientation 미표현 + STRUCTURE_META 손편집) → ROI 최저, 후순위.
- 전 family 재구축 완료까지 점진 진행 (6 slice 순차) — 단기 일괄 완결 아님.
- slice 간 catalog 가 부분 재구축된 hybrid 상태로 체류 — 이 기간 공유 토큰(R2) 수정 시 미재구축 family 에 영향 가능. G4 byte-diff-0 + Skia snapshot 불변 Gate 로 차단하되, slice 경계마다 검증 필수.

## 진행 로그

### slice 1 — Button family (proof slice) — 2026-06-18

> **선행 거짓 통과 정정**: 최초 slice 1 시도(commit `8ee4f9da5`)는 starter 레퍼런스와 대조하지 않고 catalog 내부 lineHeight 표기(숫자→TokenRef)만 정리한 뒤 "Button family 는 이미 정렬됨, 변경 0"이라 결론지었다. 이는 본 ADR Context("catalog rule 값이 starter 구조 대비 drift 크다") 전제와 정면 모순이며, kill criteria F5("작동≠정렬")를 스스로 위반한 거짓 통과였다. 사용자 지적(CSS↔Skia 정합 실패 2건)으로 `8ee4f9da5` revert(`9235c68cb`) 후 starter 기준 재구축으로 재실행.

**root cause — starter 정본 미반영 2건 (사용자 보고)**:

1. **ToggleButtonGroup Skia 세로 배치**: starter `ToggleButtonGroup.css` line 4 `display:flex` 정본이 catalog rule entry 에 미반영. ADR-912 cutover 가 `display:flex` 를 `generate-css.ts` STRUCTURE_META(DOM CSS 생성 전용)에만 넣고 `COMPONENT_RULES_TABLE.ToggleButtonGroup` entry 에는 누락 → spec 삭제 후 Skia layout fallback(`resolveContainerStylesFallback` → `LOWERCASE_COMPONENT_RULE_CONTAINER`)이 빈 객체 반환 → display 미주입 → Taffy block 처리 → 자식 ToggleButton 세로. DOM 은 STRUCTURE_META 기반 generated CSS 로 정상(가로) → **CSS↔Skia 비대칭(D3 G3 위반)**.
2. **Button primary 배경 회색(DOM)**: starter `.button-base` utility(`utilities.css`) 색 모델 — generated CSS 는 `--button-color` 변수만 emit(`cssEmitMode:"button-base"`)하고 `background: var(--button-color)` 는 `.button-base` 클래스가 적용. publish shared `Button.tsx:75` 는 `react-aria-Button button-base` 2 클래스를 붙이나, **빌더 Preview 렌더 경로(CanonicalNodeRenderer RAC-direct + generic fallback + App.tsx fallback)가 `button-base` 를 누락** → `--button-color`(#171717) 설정되나 background 미적용(기본 회색 `rgb(239,239,239)`). Skia 는 rule `fill.default.base`({color.neutral}) 직독 → 검은색 → **CSS↔Skia 비대칭**.

**수정**:

- **#1**: `COMPONENT_RULES_TABLE.ToggleButtonGroup` 에 `containerStyles: { display:"flex", alignItems:"center", width:"fit-content" }` 추가(STRUCTURE_META 와 동일 값, starter 정본 반영). flexDirection 은 `implicitStyles` togglebuttongroup 분기가 orientation(row/column)으로 처리하므로 base 에 미포함. 위치: `componentRulesTable.ts` ToggleButtonGroup entry.
- **#2**: `usesButtonBaseUtility(type)` 헬퍼(`specCatalogBacked.ts`, SSOT=STRUCTURE_META `cssEmitMode:"button-base"` 3 type Button/ToggleButton/ToggleButtonGroup) 추가 + 빌더 Preview 3 렌더 경로(CanonicalNodeRenderer RAC-direct `toRacProps` 경로 + generic fallback + App.tsx fallback)가 해당 type 에 `react-aria-{Type} button-base` 부여. publish 경로(shared `Button.tsx`)와 정합.

**검증 (live behavior — Chrome MCP)**:

- **G3 CSS↔Skia 대칭 복구**: Preview DOM 측정 — Button[data-variant=primary] `background: rgb(23,23,23)`(검은) + `color: rgb(255,255,255)`(흰), `button-base` 클래스 부여 확인. ToggleButtonGroup 자식 ToggleButton 가로 배치(DOM `flex-direction:row` + Skia 캔버스 스크린샷 "Toggle 1 / Toggle 2" 가로 인접). Skia 캔버스 스크린샷 — Button 검은 배경/흰 텍스트, ToggleButton 가로. 양 렌더 타겟 시각 일치.
- **회귀 0**: ToggleButtonGroup 컨테이너 자체 `background: rgba(0,0,0,0)`(transparent fill rule 유지, button-base 가 칠할 색 없음). preview 테스트 23 passed / CanonicalNodeRenderer.button.test 3 passed.
- **G4 byte-diff 격리**: generated CSS byte diff **0**(catalog rule containerStyles 는 Skia 런타임 fallback 전용 — DOM CSS 는 STRUCTURE_META 가 이미 생성). slice 외 family 영향 0.
- **G6**: `pnpm generate:css` 재실행(88 files) — diff 0(STRUCTURE_META 불변).
- type-check PASS (builder baseline 71, new 0).

**proof gate 결과**: kill criteria 통과(S1 starter 정본 대조 / S4 G3 대칭 복구 / S5 G4 격리 / S7 live 1:1). proof slice 가치 입증 — 작은 family 범위에서 "catalog 내부 표기 정리 = 정렬" 거짓 결론을 starter 대조가 적발(F5 작동≠정렬). slice 2(Field) 확장 자격 확립.

**slice 1 미해소(별도 slice)**: indicator(`.indicator` utility — Switch=slice 3) / inset(`.inset` utility — Field/DateField/TimeField=slice 2)도 동일 패턴(빌더 Preview generic 렌더가 utility 클래스 누락)으로 추정 — family slice 규율(§3)에 따라 해당 slice 에서 `usesButtonBaseUtility` 동형 처리. breakdown §5 "Toolbar orientation Skia 미표현" 서술 검증은 미해소(별도 grep).

> **slice 3 정정 (2026-06-18)**: 위 "utility 클래스 누락 추정" 은 slice 3 정찰에서 정밀 진단 — Switch/Checkbox 는 utility 클래스 누락이 아니라 **`.indicator`/`.checkbox` DOM 자식 노드 자체 누락**(RAC 직접 렌더가 wrapper self-compose 안 함)이었음. `usesButtonBaseUtility`(className 부여) 동형이 아니라 `DELEGATING_RAC_RENDERERS` 등록(renderSwitch/renderCheckbox 위임) 으로 해소. Radio 는 `::before` pseudo 라 누락 없음(등록 제외). slice 3 entry 참조.

### slice 2 — Field family — 2026-06-18

> **정찰 우선 실행**: slice 1 거짓 통과 교훈(추측 금지, starter 대조 evidence 동반) 반영 — Field family 11 멤버를 starter 레퍼런스와 1:1 병렬 정밀 측정(Workflow wmatqm50o, 22 agent measure→적대적 verify→synthesize). **8 overclaim 제거 + 12 실재 갭 확정**. TextField(4)/Select(4) 는 갭 0 — 추측이 적대적 verify 로 걸러져 "변경 0 = 정렬" 을 starter/code evidence 로 확증(slice 1 cosmetic-match 거짓 통과 유형 회피).

**실재 갭 → slice 2 실행 분류(7건 실행 / Input·stepper·quiet 보류)**:

1. **missing-containerVariants (5건)** — SearchField/ColorField(grid형) + ComboBox/TimeField/DateRangePicker(flex-row형) catalog rule entry 에 `containerVariants["label-position"].side` 누락. ADR-912 단계5 step4(2026-06-17)가 TextField/TextArea/NumberField/DateField/DatePicker 만 복구하고 5 멤버 누락 → Skia sideMode fallback 미적용 → labelPosition="side" 가 DOM 에만 적용·Skia 미표현(비대칭). breakdown §5 lock-in(TimeField/SearchField/ColorField labelPosition) 정합.
2. **css-skia-asymmetry — TextArea flex-direction (HIGH)** — `archetype:"input-base"`(input ELEMENT 아키타입) + `composition.layout` 부재 → generated CSS 가 flex-direction 미emit → DOM row. Skia 는 `implicitStyles` textfield||textarea 분기 column 하드코딩 → 비대칭. 수정: `composition.layout="flex-column"` 추가(generateBaseStyles 가 archetype 무시, TextField 동형) + `alignItems:"center"` 제거(column 폼 필드 좌측정렬 표준) + `width:fit-content`.
3. **css-skia-asymmetry — DateInput 배경 (2건)** — DateField/TimeField 의 `.react-aria-DateInput` box 를 Skia 는 `{color.layer-2}` 채우나 DOM generated CSS 는 background 미emit(transparent) → 비대칭. 수정: df-input/time-field-input STRUCTURE_META bridges 에 `background:"var(--bg-inset)"` 추가(`--bg-inset`={color.layer-2}, css-tokens.md field 입력 배경 통일 정책).
4. **missing-binding-accepts — DatePicker labelPosition (D2)** — DatePicker.tsx 가 이미 prop 수용 + data-label-position emit, DatePicker entry 는 containerVariants 보유하나 binding accepts 미노출 → Inspector 설정 불가. 수정: `DatePicker.binding.ts` accepts 에 labelPosition(enum top/side). **isQuiet 노출 보류** — Skia buildDatePickerShapes quiet 미구현(gap[10]/R5)이라 노출 시 Skia 평면 box ↔ CSS bottom-border 즉시 비대칭(surface minimization).

**보류(사용자 confirm 2026-06-18 / R5)**:

- **Input orphan CSS(gap[0] MEDIUM)** — Input.spec.ts 삭제(2026-06-17) 후 Input.css 가 STRUCTURE_META 미등재 frozen orphan(generate:css 재작성 안 함). 현재 rule 값과 일치해 **사용자-가시 비대칭 0**, 구조적 위험(향후 rule 변경 시 CSS 미전파)만 존재. STRUCTURE_META Input virtual wiring 은 byte-identical 강제 + 회귀 위험 동반 → surface minimization 우선, **별도 작업/후속 slice 로 분리**(사용자 결정).
- **NumberField stepper(gap[2])** — 돌출 박스 표현에 ComponentRule schema boxShadow 필드 필요 = schema 확장(R5, 별도 ADR).
- **DatePicker quiet Skia(gap[10])** — Skia buildDatePickerShapes quiet 분기 미구현. isQuiet D2 노출과 짝 → 노출 보류 시 latent 유지(R5).
- **DateField gap size-aware(gap[6] LOW)** — containerStyles 단일값이라 size-aware gap(4/6/8/10) 표현 불가, intrinsicHeight pre-bake 로 외곽 영향 0 → 후속 흡수.

**slice 1 동형 패턴(preview-utility-omit) 불필요 확인**: 적대적 verify 로 TextField/Select 의 utility-omit 가설 반증 — generated Input/SearchField/Select CSS 가 `background:var(--bg-inset)` 직접 emit(utility 위임 아님). composition 은 `.inset` utility 미채택(ADR-022 S2+RAC 직접 emit 설계) → `usesButtonBaseUtility` 동형(`usesInsetUtility`) 신설 불요. slice 1 의 inset 추정(미해소 항목)은 **반증으로 해소**(별도 slice 처리 불필요).

**검증 (live behavior — Chrome MCP, dev 서버 live 모듈 직접 측정)**:

- **Skia containerVariants 직독(`resolveComponentRule`)**: SearchField/ColorField=grid 6키(display,grid-template-columns,column-gap,row-gap,align-items,width) / ComboBox/TimeField/DateRangePicker=flex-row 2키(flex-direction,align-items). TextField/DatePicker(기존 보유) 대조군 일치.
- **Skia side 배치 실효(`applyImplicitStyles`)**: TextField labelPosition="side" → effectiveParent.style `flex-direction:row` / "top" → `column`. side=가로/top=세로 결정론 분기 확증(Skia/Taffy 직독).
- **G1 토큰 환원 정합**: DateInput 배경 — DOM `--bg-inset`(#fafafa light) = Skia `{color.layer-2}`(#fafafa light / #262626 dark) 동일 환원.
- **generated CSS dev 서버 반영**: DateField/TimeField.css `.react-aria-DateInput { background:var(--bg-inset) }` + TextArea.css `flex-direction:column`+`align-items:flex-start`+`align-items:center` 제거.
- **G4 byte-diff 격리**: generated CSS diff = DateField/TimeField(DateInput bg) + TextArea(flex-column) 3 파일만. **containerVariants 5건은 byte-diff 0**(side 블록 이미 CSS 존재, rule 은 Skia 런타임 fallback 전용). slice 외 family(Selection/Collection/Overlay/Color) byte-diff 0.
- **G6**: `pnpm generate:css`(88 files) + `validate:sync` slice 전후 동일(1 ok / 2 errors / 93 warnings — 모두 baseline, slice 2 무관). type-check PASS(builder baseline 71, new 0).

**proof gate 결과**: kill criteria 통과(S1 starter 대조 8 overclaim 제거 / S4 G3 대칭 — side 배치 + DateInput bg + TextArea column / S5 G4 격리 3 파일 / S7 live 1:1). slice 3(Selection-control) 확장 자격 확립. surface minimization 적용(Input wiring 사용자 결정으로 분리, isQuiet 보류).

### slice 3 — Selection-control family — 2026-06-18

> **정찰 우선 실행**: slice 1/2 교훈(추측 금지, starter 대조 evidence 동반) 반영 — Checkbox/CheckboxGroup/Radio/RadioGroup/Switch 5 멤버를 starter 레퍼런스 + primitives 토큰 + Skia primitive + DELEGATING 등록과 4 각도 병렬 정밀 대조(Workflow wkut6giu7, 4 recon→synthesize). **8 overclaim 제거 + 1 실재 갭(G3-1) 확정**. color/size/radius/typography 축은 5 멤버 전부 정합(변경 0) — primitives 토큰 정의 + generated CSS = catalog rule 일치 + Skia primitive(checkbox/radio/switch_toggle) 실재로 closure.

**검증-우선 좁은 slice (실질 재구축 아님)**:

- **color/size/radius 정렬 closure (변경 0)**: 5 멤버의 모든 `{color.*}`(base/layer-1/layer-2/neutral/accent/accent-subtle/negative-subtle/border/border-hover/transparent) + `{typography.text-*}` + `{radius.none/full}` TokenRef 가 primitives 에 정의 + css-tokens.md 매핑 일치 + generated CSS gap(Checkbox 6/8/10, CheckboxGroup 8/12/16, Radio 6/8/10/12, RadioGroup 8/12/16/20, Switch 8/10/12/14)이 catalog rule sizes 와 정확 일치. "변경 0 = 정렬" 을 starter/code evidence 로 확증(slice 1 cosmetic false-pass 회피).
- **8 overclaim 기각 (잘못된 baseline 대조)**: recon 일부가 "indicator/state CSS 누락" 을 high severity 로 올렸으나 — generated CSS=container-only(indicator 는 cutover 설계상 Skia switch_toggle/checkbox/radio skiaPrimitive + 수동 `::before`/`.indicator` CSS 담당, componentRulesTable indicator 미emit 주석 3곳 명시) vs starter CSS=DOM-full 의 비대칭 비교가 원인. skiaPrimitives.ts:658/744/798 draw 함수 실재 확인으로 전량 기각.

**실재 갭 G3-1 — Switch/Checkbox indicator DOM 자식 누락 회귀 (slice 1 §157 'Switch=slice 3' 항목)**:

- **근본 원인**: composition 의 Switch/Checkbox 시각 모델은 indicator 를 그릴 **DOM 자식 노드**가 CSS selector 타겟. Switch.css `.react-aria-Switch .indicator`(track) + 그 안 `::before`(thumb) / Checkbox.css `.react-aria-Checkbox .checkbox`(box) + svg(checkmark). shared Switch.tsx/Checkbox.tsx 가 `<div className="indicator">`/`<div className="checkbox">` 를 자기완결 합성하는데, preview CanonicalNodeRenderer 의 `binding && PrimitiveComponent` 경로(toRacProps→RAC `<Switch>`/`<Checkbox>` 직접)는 그 자식 div 를 안 만든다 → indicator 시각 완전 누락(track/handle/checkmark 미렌더). live DOM 측정으로 확인(자식 `.indicator`/`.checkbox` 0개).
- **수정**: `DELEGATING_RAC_RENDERERS` 에 Switch/Checkbox 등록 → rendererMap.Switch=renderSwitch / .Checkbox=renderCheckbox(shared wrapper self-compose)로 위임. DateField/TimeField 동형(정적 자식 div 라는 점만 render function 과 다름). **Radio 제외** — `.react-aria-Radio::before` pseudo-element ring 모델이라 DOM 자식 불요, RAC `<Radio>` 직접 렌더로도 indicator 정상(live 확인). RadioGroup 은 그룹 위임에 이미 포함.
- **Skia 불변**: switch_toggle/checkbox/radio skiaPrimitive 가 track+thumb/box+checkmark/ring+dot 를 직접 그림(DOM 경로와 독립) → 본 수정은 DOM/CSS 경로 단독, Skia byte 불변. CSS↔Skia 대칭 = DOM indicator 복원으로 Skia 가 이미 그리던 것과 일치.

**live behavior 검증 (CLAUDE.md §완료 기준)**: builder 에서 Switch/Checkbox(body 직속) + RadioGroup(자식 Radio 2) 실제 추가 → 새로고침 후 IndexedDB hydrate 상태에서 preview DOM 측정 — Switch `.indicator`(36×20 캡슐 track, br:20px) / Checkbox `.checkbox`(20×20 box, selected → neutral bg + svg checkmark) / Radio `::before`(20px ring) 전부 정상 렌더. 수정 전 indicator 전량 누락(빈 라벨만) → 수정 후 시각 복원 확증(zoom 스크린샷).

**proof gate 결과**: kill criteria 통과(S1 starter 대조 8 overclaim 제거 / S5 G4 격리 1 파일 + 테스트 1 — generated CSS·Skia byte 불변 / S7 live 1:1 — Switch/Checkbox indicator div 복원·Radio ::before 정상). slice 4(Collection) 확장 자격 확립. surface minimization 적용(Radio 위임 제외 — DOM 자식 불요).

### slice 4 — Collection family — 2026-06-19

> **정찰 우선 실행**: slice 1~3 교훈(추측 금지, starter 대조 evidence 동반) 반영 — ListBox/GridList/Menu/Table/Tree/TagGroup/Breadcrumbs 7 멤버를 starter 레퍼런스 + generated/manual CSS + catalog rule + STRUCTURE_META + Skia primitive(skiaPrimitives/buildCatalogShapes/projection) + DELEGATING 등록 6 각도로 병렬 정밀 측정(Workflow w1k52z630, 42 agent measure→적대적 verify→synthesize). **실재 갭 10건 확정 + overclaim 기각 24건**(slice 3 의 8 overclaim 차단 패턴 강하게 작동 — measure 의 fix-in-slice4 과대 권고 3건도 synthesize 가 defer 로 정정). color/size/radius 축은 7 멤버 generated CSS = catalog rule sizes 일치로 정렬 closure(변경 0).

**fix-in-slice4 (2건, 사용자 confirm 2026-06-19 — "fix 2건 진행 + 8건 defer")**:

1. **Tree containerStyles 누락 (HIGH, missing-containerVariants)** — `componentRulesTable.ts` Tree entry 에 `containerStyles` 부재. ListBox/Menu/TagGroup 동형 collection cutover 멤버인데 ADR-912 단계5 step4 배치에서 containerStyles 이관 누락 → spec 삭제 후 Skia layout fallback(`resolveContainerStylesFallback("tree")` → `LOWERCASE_COMPONENT_RULE_CONTAINER`)이 빈 객체 반환 → display 미주입 → Taffy block 처리 → TreeItem 세로 배치 안 됨. DOM 은 starter Tree.css(flex column) 적용 → CSS↔Skia 비대칭(D3 G3). **ToggleButtonGroup slice 0 / ListBox 선례 동형**(spec 삭제 시 fallback 빈 객체 → 세로). 수정: Tree entry 에 `containerStyles: { display:flex, flexDirection:column, gap:{spacing.2xs}, padding:{spacing.xs}, width:100%, maxHeight:300px, overflow:auto, outline:none }` 추가(ListBox/Menu 정합, starter Tree.css:3-15 값). 위치: `componentRulesTable.ts` Tree entry.

2. **GridListItem selected accent border Skia 미적용 (LOW, css-skia-asymmetry)** — `gridListCard`(skiaPrimitives, replace 모드 → buildCatalogShapes 우회)에 `props.isSelected` 분기 부재 → selected 카드도 default border({color.border}) 1px. DOM(builder GridList.css `[data-selected]{border-color:var(--accent);border-width:2px}`)은 accent 2px → 비대칭. 형제 listbox_item 은 isSelected → accent-subtle row-bg honor(구현 불일치). 수정: (a) GridListItem rule colors 에 `selectedBorder: "{color.accent}"` 추가(schema 기존 보유 — `ComponentRuleVariantColors.selectedBorder`) (b) gridListCard borderColor = `isSelected ? (visual.selectedBorder ?? {color.accent}) : visual.border`, borderWidth = `isSelected ? 2 : size.borderWidth`(buildCatalogShapes selected 정본 패턴, style.borderColor/borderWidth 사용자 편집 우선). 위치: `componentRulesTable.ts` GridListItem + `skiaPrimitives.ts` gridListCard.

**defer (8건, 사용자 confirm — Table 5건 별도 ADR / ListBox 3건 defer-separate-slice)**:

- **Table 5건 → 별도 ADR 통째 분리**: variant taxonomy split-brain(CRITICAL — Inspector default/striped/bordered vs DOM 수동 CSS primary/...) / striped DOM 미렌더 / selected 행 색 family 상이 / header bg 토큰 비대칭 / 세로 셀 구분선. 모두 같은 Table 렌더 아키텍처(@tanstack/react-table custom + projection rowBg + 수동 Table.css + ADR-912 cutover 미완)에 얽혀 header bg 1줄 정렬조차 striped/selected/variant 일관성 종속. 차단 메모리 `feedback-execute-adr-surface-minimization` 우선 평가 — slice 4 흡수 시 검증 표면 Table 전체 확대(ADR-144 revert 유형). 메모리 `feedback-table-selection-sort-not-delegating-sweep`(selection/sort 미구현)과 동일 영역. 별도 ADR 에서 variant 모델 정리 + TanStack↔catalog 화해.
- **ListBox layout(stack/grid)+orientation 미노출 (HIGH) → defer-separate-slice**: binding accepts 누락(toRacProps drop) + Skia projection 하드코딩 column. DOM/Skia 모두 vertical 수렴(내부 비대칭 0, starter 4조합 대비 feature 부재). D2 accepts 확장 + D3 projection 변경 양쪽 = surface 큼.
- **ListBox ::after 항목 divider (LOW) → defer-separate-slice**: DOM/Skia symmetric absence(둘 다 미렌더) = slice 4 G3 대상 아님. divider 도입은 DOM ::after + Skia 신규 listbox_divider append primitive(table_row_divider 동형) coordinated 추가 필요. catalog cutover flat-list 의도(isDesignedAsymmetry).
- **ListBox Section Header bg DOM↔Skia 비대칭 (MEDIUM) → defer-separate-slice**: DOM 은 Header `--bg-raised` 그림, Skia 는 Header rule `variants:{}` → hasVisibleBg=false. Header rule fill 추가만으로 해소 불가 — ListBox data-bound projection 이 section header 를 projected node 로 안 만듦 → Skia 해소 = projection 모델에 section header node 추가 = ADR-135/136 render-space interaction boundary 계약 변경(surface 큼).

**검증 (live behavior — Chrome MCP, 앱 인스턴스 src 모듈 직독)**:

- **A-1 Tree fallback**: `resolveContainerStylesFallback("tree")` 앱 인스턴스 = `{display:flex, flexDirection:column, gap:2, padding:4, width:100%, maxHeight:300px, overflow:auto, outline:none}` — ListBox 대조군 완전 일치(이전 `{}` → flex column 주입). 단위 테스트 11 PASS.
- **A-2 gridListCard**: 앱 인스턴스 draw — selected → border `{color.accent}` 2px / unselected → `{color.border}` 1px(회귀 0). DOM `[data-selected]` accent 2px 정합. 회귀 테스트 4건(gridListCardSelected) + buildCatalogShapes.selection 49 = 53 PASS.
- **G4 byte-diff 격리**: `pnpm generate:css`(88 files) 후 generated CSS byte-diff **0** — Tree/GridList 는 DELEGATING manual-only(generated CSS 부재), containerStyles/selectedBorder 는 Skia 런타임 직독 전용. slice 외 family 영향 0. R2 공유 토큰 정의 불변(참조만 추가).
- type-check: builder 0(baseline 0), specs 신규 0(baseline 60 = 기존 테스트 ComponentVisualRule import/캐스팅, 내 변경 무관).

**proof gate 결과**: kill criteria 통과(S1 starter 대조 24 overclaim 제거 / S4 G3 대칭 — Tree flex column + GridList selected accent / S5 G4 격리 byte-diff 0 / S7 live 1:1 — 앱 인스턴스 fallback·draw 직독). Collection family slice 완료. surface minimization 강하게 적용(Table 5 별도 ADR / ListBox 3 defer — projection·binding·divider 계약 얽힘으로 narrow 보정 범위 초과). ADR-913 family slice(1~4) 의 Collection 정찰·fix 완결. Overlay/Color family 는 후속.
