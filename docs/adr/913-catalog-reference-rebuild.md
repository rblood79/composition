# ADR-913: catalog 컴포넌트 레퍼런스 기준 재구축

## Status

Proposed — 2026-06-18

## Context

ADR-912 (Implemented 2026-06-18) 로 컴포넌트 시각 SSOT 가 `*.spec.ts` 에서 catalog `COMPONENT_RULES_TABLE` 단일 정본으로 전환됐다. 그러나 이 정본의 **값** 자체는 catalog/spec 이 없던 초기에 react-aria-starter 를 여러 번 **수동 가공**해 만든 누적분이다 ([[project-catalog-reference-rebuild-framing]]). RAC/RSC 라이브러리 업데이트 대응 개념 없이 누적된 수동 drift 라, ADR-912 완료 후에도 다음 문제가 남는다:

- CSS preview (Preview/Publish DOM) ↔ Skia 렌더 (Builder canvas) 시각 정합성 불일치가 크다.
- 레퍼런스(starter)와의 스타일 갭이 크다.
- 한 컴포넌트만 부분 패치하면 공유 토큰 scale·횡단 표준(field-height/group-seam) 연계성으로 **갭이 오히려 증폭**된다.

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
  - 기술: **HIGH** — 적대적 검증 3렌즈 모두 `proof-overclaims`. "starter theme.css 값 → rule TokenRef 결정론 lookup" 변환 방향이 **존재하지 않음**: `{radius.sm}` 실제 정본은 starter 가 아니라 composition primitives(Skia sm 4)/shared-tokens(CSS var), starter 값(sm 6)은 양쪽 모두와 불일치. variant 축은 starter 에 물리 부재(Button.css data-variant 0건). 자동화 가능 영역이 color base + 스칼라로 축소.
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

### 대안 C: 전체 113 컴포넌트 일괄 재작성 후 한 번에 교체

- 설명: family 분할 없이 전 rule 을 레퍼런스 기준으로 일괄 재작성 후 한 번에 교체.
- 근거: 연계성 갱장 제거가 확실 (모든 토큰이 동시 정렬).
- 위험:
  - 기술: MEDIUM — 변환 규칙 자체는 대안 B 와 동일.
  - 성능: LOW.
  - 유지보수: MEDIUM.
  - 마이그레이션: **HIGH** — 검증 표면이 113 컴포넌트 동시 → CSS↔Skia 대칭 회귀 시 원인 격리 불가. proof gate(작은 family 로 kill criteria 확인 후 확장) 부재 → ADR-144 revert(34 commit) 유형 재발 위험.

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
- **대안 C 기각**: proof gate 부재로 113 컴포넌트 동시 교체 시 CSS↔Skia 회귀 원인 격리 불가 (마이그레이션 HIGH).

토큰 정본 방향 결정 (사용자 confirm 2026-06-18): radius/typography/spacing 수치 토큰은 **composition primitives/shared-tokens 유지**. starter 는 variant 축·state·orientation **구조** 와 **누락 컴포넌트** 레퍼런스로만. custom variant(premium/genai)는 **보존** (S2 4 + catalog 2 = 6).

> 구현 상세: [913-catalog-reference-rebuild-breakdown.md](design/913-catalog-reference-rebuild-breakdown.md)

## Risks

| ID  | 위험                                                                                                             | 심각도 | 대응                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------- |
| R1  | 같은 TokenRef 가 Skia(primitives)/CSS(shared-tokens var) 어댑터별 다른 값으로 발산 (radius.sm Skia 4 vs CSS var) |  HIGH  | G1 토큰 환원 정합 Gate — 양 경로 시각값 동일 확인, 발산 시 slice 재보정                   |
| R2  | 공유 토큰(`{radius.md}` 69블록·`{typography.text-sm}` 119블록) 수정이 slice 밖 family 를 의도치 않게 re-scale    |  HIGH  | G4 cross-component 회귀 Gate — slice 외 byte diff 0 + Skia snapshot 불변                  |
| R3  | hover/pressed 색 모델 불일치 (starter OKLCH ↔ rule color-mix srgb) 로 state 시각 발산                            | MEDIUM | G3 CSS↔Skia 대칭에 state 셀 포함, 발산 시 수동 검수 격리. color-mix 모델 유지(현 D3 SSOT) |
| R4  | 수동 재작성이 "결정론 표기" 한 필드를 실제론 정정 필요 (overclaim 재발)                                          | MEDIUM | G5 자동화율 floor Gate — 결정론 표기 필드 정정 0 검증, 반복 시 체크리스트에서 영구 제외   |
| R5  | elevation(box-shadow) 단색 평탄화로 starter 입체감 손실                                                          |  LOW   | ADR-142 의도된 평탄화 유지. schema(boxShadow) 확장은 별도 ADR (본 scope 밖)               |

## Gates

| Gate                    | 시점          | 통과 조건                                                             | 실패 시 대안                                                                      |
| ----------------------- | ------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| G1 토큰 환원 정합       | slice 변환 시 | TokenRef 의 Skia 해석값 = CSS var 해석값 시각 동일                    | starter 값으로 닫아 한쪽 발산 시 slice 재보정, starter→catalog 자동 generate 폐기 |
| G2 variant 구조 보존    | slice 변환 후 | 출력 variant 집합 ⊇ 현 catalog (premium/genai 소실 0)                 | S2 derive 만으로 채워 custom 누락 시 구조 입력 = S2+catalog 병합 재설계           |
| G3 CSS↔Skia 시각 대칭   | slice 완료 시 | variant×size×state 매트릭스 전 셀 시각 일치 (Chrome MCP /cross-check) | hover/pressed 모델 치환 발산 시 state 파생 수동 검수 격리                         |
| G4 cross-component 회귀 | slice 완료 시 | slice 외 family generated CSS byte diff 0 + Skia snapshot 불변        | blast radius 초과 시 family 전역 회귀 검증 의무 편입                              |
| G5 자동화율 floor       | 각 slice      | '결정론 생성' 표기 필드 manual 정정 0                                 | 반복 정정 시 autoConvertible 영구 제외, scope 를 color base+스칼라 축소           |

## Consequences

### Positive

- catalog 시각 값이 레퍼런스(starter 구조 + composition 토큰 정본) 기준으로 정렬 → CSS preview ↔ Skia 정합성 불일치 해소.
- 변환 체크리스트로 변환 절차 고정 → RAC/RSC 업데이트 대응 시 누적 drift(현재 문제 근본 원인) 차단.
- 누락 컴포넌트 4 (ColorThumb/CommandPalette/InputGroup/Sheet) 신규 등록 + orientation/labelPosition containerVariants 비대칭 보정 (slice 진행 중 흡수).
- family slice + kill gate 로 회귀 표면 최소, 원인 격리 가능.

### Negative

- RAC 업데이트 시 자동 재실행 불가 — family 단위 수동 반복 (도구 미제작 trade-off).
- Collection family 는 manual 비중 최대(::after divider/grid-area/orientation 미표현 + STRUCTURE_META 손편집) → ROI 최저, 후순위.
- 전 family 재구축 완료까지 점진 진행 (6 slice 순차) — 단기 일괄 완결 아님.
