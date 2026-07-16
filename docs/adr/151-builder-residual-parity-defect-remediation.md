# ADR-151: 빌더 잔여 CSS↔Skia 발산·잠재 결함 일소 전략

## Status

Proposed — 2026-07-16

> 사용자 지시: ADR 생성까지만 — 구현 착수 금지. Phase 실행은 사용자 승인 후 시작한다.

## Context

**해당 domain: D3 (시각 스타일)** — Builder(Skia)와 Preview/Publish(DOM+CSS)는 catalog SSOT 의 대등 symmetric consumer 이며, 본 ADR 은 두 consumer 의 시각 결과 발산(잔여 버그)을 일소하는 전략을 결정한다. D1(DOM/접근성)/D2(Props/API) 경계 교차 없음.

ADR-916(자체 레이아웃 엔진 전환) 완결 후 라이브 44종 battery sweep(2026-07-13/14)에서 21종 CSS↔Skia 발산이 실측 확정되어 2회 세션으로 대부분 수정됐다. 그러나 다음이 남아 있다 (전체 목록·실측 근거는 design breakdown §1):

1. **잔여 발산 13건 (B1~B13)**: Calendar dw+22/dh+18, RangeCalendar dw+40/dh+42 대형 2건 + Card/Link/Tree/Tabs/Menu 중형 5건 + Table/Badge/StatusLight/ToggleButton(Group)/Checkbox 소형(±2~3px) 6건
2. **fresh factory 기본 폭 분류 비대칭 4건 (B14~B17)**: Disclosure(Group)/Heading·Text/Separator/RadioGroup — 구 battery 의 수동 폭 튜닝에 가려져 있다가 재구축 battery 에서 노출
3. **코드 실측 확인 잠재 결함 3건 (B18~B20)**: fontVariant 가 Canvas 2D 측정 경로(`needsFallback()`)에서 무시됨, position:fixed 카메라 역보정 미활성, 스타일 소스 배지 부모 체크 미구현
4. **stale 진단 정정**: Button catalog height=0 sentinel 붕괴 진단(2026-07-06)은 현 코드에서 비활성 확인 — `deriveSizeConfig()` 가 height 를 매핑하지 않음

동일 유형(경로 간 메트릭 비대칭) 버그가 반복 발생해 왔다는 것이 핵심 문제다: 최근 30일 fix 집계에서 panel 26 / skia 16 / layout 11 / engine 8건이며, engine 은 회귀테스트 동반 0건이다. 개별 대증 수정만으로는 재발을 막지 못한다.

**Hard Constraints**:

1. Canvas 60fps / 초기 로드 < 3초 유지 — 수정이 렌더 hot path 비용을 늘리면 안 됨
2. D3 대칭 원칙: 수정은 SSOT(catalog + theme/tokens) 파생으로만 — 한쪽 consumer 를 다른 쪽 기준으로 맞추는 소비자 간 참조 금지 (ssot-hierarchy.md)
3. ADR-042 Implemented 전례(사용자 결정 2026-05-13): "Skia 와 HTML 의 1-2px 를 현실적으로 일치시킬 수 없음" — 텍스트 측정 기인 미세 오차는 수용이 확정된 관점
4. layout 경로 `+2/+4px` 보정 금지 (canvas-rendering.md §3 — Layout = Canvas 2D = CSS 정합 원칙)
5. Generator/catalog 확장 불요 — 본 ADR 은 기존 catalog 값·분기 정정 범위로, CSS Generator 의 신규 selector emit 지원이 필요한 항목 없음

**Soft Constraints**:

- 07-13/14 실측치는 2일 경과 — 이후 수정 commit (`a3656130a` 등) 반영 상태 재실측 필요
- Menu 표현(B7)은 기술 판정이 아닌 제품 표현 결정 — 사용자 확인 필요
- 착수 시점 미정 (본 ADR 은 전략 확정까지만)

## Alternatives Considered

### 대안 A: 개별 산발 수정 (현행 방식 지속)

- 설명: 발견 순서대로 버그별 fix commit 을 반복한다. 인벤토리 고정·허용 오차 기준·재발 방지 장치 없이 증상 단위로 처리.
- 근거: 지금까지의 기본 운영 방식. 소규모 수정의 즉시성은 검증된 장점.
- 위험:
  - 기술: LOW — 개별 수정 자체는 단순
  - 성능: LOW — 런타임 구조 변경 없음
  - 유지보수: **HIGH** — 원인 축을 공유하는 버그를 증상 단위로 수정하면 3경로(generated CSS / Skia shapes / layout `calculateContentHeight`) 동기화 누락이 반복된다. 실측 반복 사례 3곳: ① Card card-description — starter CSS 상속(16/24)과 catalog `Description.sizes`(md 12/16 · lg 14/20 — size 축별 상이) 이원화 (`packages/shared/src/catalog/generated/componentRulesTable.ts:4123` ↔ generated CSS), ② Disclosure 군 3겹 발산 — catalog `DisclosureHeader.sizes` / `extractSpecTextStyle`(specTextStyle.ts) / `renderDisclosureGroup` 이 각각 따로 수정됨 (5b51c90af), ③ Separator — CSS `.horizontal` 규칙과 catalog paddingY 가 독립 수정되다 기본 HR 미포착 (07-14). engine scope 는 fix 8건에 회귀테스트 동반 0건 — 동일 지점 재발산 무방비
  - 마이그레이션: LOW — 롤백 단위 작음
- 외부 참조: 시각 회귀를 개별 대응만으로 관리한 프로젝트의 공통 실패 패턴 — 기준선(golden) 부재 시 수정과 회귀가 교대로 누적 (Chromium layout test 가 fuzzy-match 기준선을 두는 이유)

### 대안 B: 원인 축 그룹 일괄 수정 + 허용 오차 기준 명문화 + 독립 oracle golden 확장

- 설명: (1) Phase 0 에서 battery 재실측으로 인벤토리를 freeze 하고, (2) 버그를 원인 축(셀 메트릭 / 텍스트 메트릭 / 폭 분류 / 소형 오차 / 잠재 결함) 그룹으로 묶어 그룹당 1 Phase 로 수정하며, (3) ADR-042 전례를 판정 기준으로 명문화(±2px 이내 + 텍스트 측정 기인 규명 시 수용, 원인 미상은 크기 무관 수용 금지)하고, (4) 수정 컴포넌트를 Chrome 실측 golden(tree_golden battery)에 편입해 재발을 감시한다.
- 근거: 업계 표준 시각 회귀 관리 패턴 — 스크린샷/레이아웃 diff 는 허용 오차(threshold)와 golden 기준선을 함께 운용 (Chromium layout tests fuzzy matching, pixelmatch threshold, Flutter 의 HTML↔CanvasKit 렌더러 간 미세 발산 수용 정책). 내부 전례 — tree_golden 독립 oracle (`project-adr916-tree-golden-independent-oracle`) + ADR-907 Layer D 동일 resolver 심볼 패턴이 이미 확립되어 신규 메커니즘 도입 없이 적용 가능.
- 위험:
  - 기술: MEDIUM — 허용 오차 판정선 설계 오류 시 실버그를 "수용" 으로 은폐할 수 있음 (원인 미상 수용 금지 조항으로 완화)
  - 성능: LOW — 런타임 변경 없음 (테스트·기준선·기존 분기 값 정정)
  - 유지보수: LOW — 그룹 단위 수정 + golden 편입으로 재발 감시가 자동화. 기존 패턴(Layer D resolver 공유, catalog read-through) 재사용
  - 마이그레이션: LOW — factory 기본값 변경은 신규 생성 요소에만 적용 (기존 저장 요소는 props.style 직렬화 완료 상태라 무영향 — 기존 프로젝트 BC 0%)
- 외부 참조: 위 근거 항목과 동일

### 대안 C: 전량 0px 완전 일치 (허용 오차 없음)

- 설명: 소형 오차 포함 전 항목을 0px 까지 수정. 필요 시 렌더/측정 경로에 보정 레이어 추가.
- 근거: "대칭 = 시각 결과 동일성" 원칙의 문자적 극단 해석.
- 위험:
  - 기술: **HIGH** — Canvas 2D↔CanvasKit↔브라우저 텍스트 측정의 sub-pixel 차이는 엔진 구조적 차이로, 0px 일치가 불가능한 지점이 존재. 해당 코드 경로 3곳: ① `canvas2dSegmentCache.ts` Canvas 2D `measureText` 세그먼트 측정 vs ② `canvaskitTextMeasurer.ts` CanvasKit Paragraph 측정 (`getMaxIntrinsicWidth`) vs ③ `nodeRendererText.ts` 렌더 단 교정 2곳 (:449 Canvas 2D 측정 gate + `+1` sub-pixel 보정 / :574 CanvasKit `getMaxIntrinsicWidth` 재layout) — 세 지점이 각기 다른 폭을 산출하는 것이 전제된 설계 (ADR-042 에서 사용자가 이미 "불가" 판정)
  - 성능: MEDIUM — 0px 수렴을 위한 이중 측정/보정 패스는 렌더 hot path 비용 증가
  - 유지보수: **HIGH** — 경험적 보정 상수(`+2/+4px`)의 재도입 압력. canvas-rendering.md 금지 패턴 (`calculateContentWidth` 보정 금지, `enrichWithIntrinsicSize` 보정 금지) 과 정면 충돌 — 보정 상수는 폰트/브라우저/엔진 버전 변경마다 재튜닝 필요
  - 마이그레이션: LOW
- 외부 참조: Flutter 가 HTML↔CanvasKit 렌더러 간 픽셀 완전 일치를 목표로 하지 않는 것과 동일한 구조적 제약

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ----- | ---- | -------- | ------------ | :--------: |
| A    | L     | L    | **H**    | L            |     1      |
| B    | M     | L    | L        | L            |     0      |
| C    | **H** | M    | **H**    | L            |     2      |

루프 판정: 대안 B 가 HIGH 0 으로 임계 통과 — 추가 대안 루프 불필요.

## Decision

**대안 B: 원인 축 그룹 일괄 수정 + 허용 오차 기준 명문화 + 독립 oracle golden 확장**을 선택한다.

선택 근거:

1. 잔존 위험이 MEDIUM 1건(허용 오차 판정선 오류)뿐이며, "원인 미상 오차는 크기 무관 수용 금지" 조항 + Gate G2(그룹별 live 실측) 로 관리 가능
2. 판정 기준이 ADR-042 의 사용자 확정 관점을 그대로 승계 — 새 관점 도입 없음
3. 재발 방지 장치(tree_golden, Layer D resolver 공유)가 모두 기존 확립 패턴이라 신규 메커니즘 위험 0

허용 오차 판정 기준 (요지 — 상세는 breakdown §2):

- ±2px 이내 **그리고** 원인이 텍스트 측정 엔진 차이로 규명된 경우: 수용 (golden 기대값에 고정)
- 원인 미상 오차: 크기 무관 수용 금지 — 규명 후 판정
- ±3px 초과 또는 폭 분류(카테고리성) 발산: 무조건 수정

기각 사유:

- **대안 A 기각**: 3경로 동기화 누락 재발이 실측으로 반복 확인된 방식 — 유지보수 HIGH 를 완화할 장치가 없음. sweep 으로 21종을 찾아 수정한 직후에도 13건이 남았다는 사실 자체가 개별 대응의 한계 증거
- **대안 C 기각**: ADR-042 에서 사용자가 이미 기각한 목표의 재도입 — 기술·유지보수 HIGH 2건에 대한 수용 근거를 만들 수 없고, layout 보정 금지 규칙과 충돌

> 구현 상세: [151-builder-residual-parity-defect-remediation-breakdown.md](design/151-builder-residual-parity-defect-remediation-breakdown.md)

## Risks

| ID  | 위험                                                                     | 심각도 | 대응                                                                                        |
| --- | ------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------- |
| R1  | 허용 오차 판정이 실버그를 수용으로 은폐                                  |  MED   | 원인 미상 수용 금지 조항 + 수용 항목별 판정 근거 1줄 기록 의무 (breakdown §2, Phase 4)      |
| R2  | 07-14 실측치 stale — 이미 수정된 항목(B12 Badge 등)을 재수정하는 낭비    |  MED   | Phase 0 재실측 인벤토리 freeze 를 모든 수정 Phase 의 선행 조건으로 강제 (Gate G1)           |
| R3  | fresh factory 폭 분류 수정(B14~B17)이 기존 프로젝트 저장 요소와 상호작용 |  MED   | factory 기본값은 신규 생성만 영향 — Phase 3 에서 기존 요소 로드 1건으로 무영향 확증 후 진행 |
| R4  | Menu 표현(B7) 을 기술 판정으로 오처리 — 사용자 제품 결정 지점 침범       |  MED   | B7 은 Phase 밖 사용자 결정 대기 항목으로 격리 — AskUserQuestion 후에만 처리                 |
| R5  | 잠재 결함(B18~B20) 수정이 노출 경로 없는 코드를 건드려 과잉 변경         |  LOW   | Phase 5 는 "전 항목 수정 없이 보류 종결 가능" 명시 — 노출 조건 확인이 수정보다 선행         |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점                     | 통과 조건                                                                                                         | 실패 시 대안                                          |
| ---- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| G1   | Phase 0 종료             | B1~B17 전 항목 dw/dh 재실측 완료 + 수정/수용/보류 1차 분류가 breakdown §1 에 기록                                 | 재실측 불가 항목은 인벤토리에서 제외 (수정 대상 아님) |
| G2   | Phase 1~4 각 종료        | 해당 그룹 컴포넌트 Chrome MCP 라이브 재실측 — 수정 항목 오차 소멸, 수용 항목 판정 근거 기록                       | 해당 Phase 재작업 (다음 그룹 진행 차단)               |
| G3   | Phase 6 (Implemented 전) | tree_golden/sweep 하니스 최종 실행 — 수정 컴포넌트 golden 편입 + 잔여 오차 전수 기록. type-check/cross-check PASS | Implemented 승격 보류                                 |

## Consequences

### Positive

- CSS↔Skia 잔여 발산 13건 + 폭 분류 4건이 원인 축 단위로 정리되고, 수용/수정 판정 기준이 문서화되어 이후 sweep 의 판정 재현성 확보
- 수정 컴포넌트가 golden battery 에 편입되어 engine/layout scope 의 회귀테스트 공백(30일 집계 engine 테스트 동반 0건) 해소
- stale 진단(Button height=0 sentinel) 정정으로 메모리·인벤토리 정확도 회복

### Negative

- Phase 0 재실측(battery 재구축 + 44종 측정) 비용 선지불 — 수정 자체보다 측정에 초기 시간 소요
- 허용 오차 수용 항목은 "알려진 오차" 로 영구 기록 유지 필요 — golden 기대값과 실측 문서의 이중 관리 부담 (breakdown §2 수용 목록이 단일 기록처)
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` 의 컴포넌트 분기·catalog sizes·factory 기본값에 걸친 다면 수정 — Phase 분할로 commit 단위는 관리되나 리뷰 표면적은 큼
