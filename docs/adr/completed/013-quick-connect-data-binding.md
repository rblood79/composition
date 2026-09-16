# ADR-013: Quick Connect — 기존 Data 생성 흐름의 생성 후 자동 연결

## Status

**Implemented — 2026-09-17** (Phase 0~~3 · G0~~G3 종결, `/execute-adr 013`). 2026-03-02 원문 / 2026-07-16 Risk-First 재작성 / 2026-09-16 현재 Builder 기준 설계 수정 / [리뷰 round 4](../reviews/013.md) pending 0 (전제 확정).

구현 정본: `apps/builder/src/builder/panels/datatable/utils/quickConnect.ts` (대상 캡처 · 실행 직전 검증 · `executeQuickConnect` · Table 컬럼 계획) · `DataTableCreator.tsx` 연결 모드 · `dataChange.ts` `expectBindings` / `DataBindingConsumer.read` · `historyActions.ts` canonicalEvents 동반 `data` entry. live 하니스 `apps/builder/scripts/adr013-quick-connect-live.mjs`. 상세 §Live Exercise.

## Context

현재 Properties의 Data 행에는 이미 `새 테이블 만들기` 액션이 있고, 기존 생성 패널은 preset·빈 테이블·붙여넣기·파일·API·AI 진입을 제공한다. 부족한 것은 별도 생성 UI가 아니라 **생성 결과를 작업하던 컴포넌트에 자동 연결하는 단계**다. 생성 액션은 projectId만 넘기고 생성 완료 후 테이블 편집기를 열기 때문에 사용자는 바인딩 대상을 다시 선택해야 한다.

또한 현재 Builder는 DataChange 공통 적용기, fieldId 기반 매핑, 텍스트 template, 공통 적용기의 `props.dataBinding` 저장, 정적 `props.items`를 사용한다. 기존 제안의 개별 생성/복구 hook, label/description fieldMap, 적용기 밖의 직접 저장, 기본 item child 제거는 이 구조에 맞지 않는다. Table의 Preview 자동 컬럼 ingress는 history를 기록하지 않으므로 생성·바인딩 묶음만으로 전체 Undo가 완결되지 않는다.

**Domain**: D2의 기존 데이터·바인딩 계약을 소비하는 Builder UX다. D1의 RAC 접근성/collection 의미론은 유지한다. D3는 연결 결과의 Canvas/Preview 정합성 검증 대상이며 factory 기본 시각과 empty state 전면 개편은 범위 밖이다.

**의존 관계**: [ADR-152](152-data-panel-collection-binding-integration.md)의 데이터 계약과 [ADR-159](159-collection-field-template-binding.md)의 텍스트 template 계약을 재사용한다. ADR-152는 Implemented이며 과거의 완료 대기는 해소됐다. ADR-013은 이 계약 위의 UX 자동화로 분리 유지한다. 코드 근거와 남은 확인 항목은 상세 설계 §1에 기록한다. 과거 외부 빌더 비교는 현재 검증하지 않았으며 이번 결정의 근거로 사용하지 않는다.

**Hard Constraints**:

1. **기존 UI 재사용** — Data 행 생성 액션과 Creator를 확장한다. 별도 preset 팝오버·중복 생성 UI를 추가하지 않는다. 일반 Data 패널 생성과 수동 바인딩/해제는 보존한다.
2. **대상 보존** — 시작한 project/page/element와 편집 문맥을 명시적으로 보관하고 commit 경계에서 검증한다. 선택이 바뀌어도 다른 요소에 쓰지 않는다. 삭제·문맥 이탈·중간 바인딩 변경을 무시하지 않는다.
3. **현재 계약 준수** — collectionId, fieldId, 텍스트 template을 사용하고 공통 적용기(`bind_element`)가 쓰는 현행 `props.dataBinding` 형태로 기록한다. 정상 쓰기는 `x-composition.dataBinding`을 비우며 extension은 legacy/import 스냅샷 restore에서 복원된다. 새 name-only 바인딩이나 적용기 밖의 직접 쓰기 경로를 만들지 않는다.
4. **실행 완결과 복구** — 생성 설정 후 한 번의 실행으로 생성·연결을 완료한다. 총 클릭 수를 1로 보장하는 의미가 아니다. 전체 실행은 Undo 1회로 복원되며 실패를 성공으로 알리지 않는다. 정상 복구 후 orphan collection/깨진 참조는 0건이어야 한다. 복구 저장 실패도 노출·복구 가능한 오류로 취급한다.
5. **데이터와 정적 편집 보존** — 재연결 시 이전 collection, 요소 삭제 시 연결 collection을 보존한다. factory 기본 items는 유지한다. 미연결과 연결된 0건을 구분하며 Canvas/Preview에서 정합성을 검증한다.
6. **Table 편집 보존** — 기존 컬럼 보존·재매핑이 기본이다. 전면 교체는 명시적으로 선택한다. 컬럼과 지연 ingress까지 포함한 복구·Undo를 통과하기 전 Table 지원 완료를 선언하지 않는다.

**범위**: ListBox/GridList/Select/ComboBox/Menu/Table. 초기 자동 연결은 Creator 안에서 생성이 끝나는 empty/preset/paste/file 경로를 대상으로 한다. API/AI 인계의 자동 연결은 제외하며 연결 모드에서 지원 여부와 일반 생성 전환을 명시한다. 기존 API/AI 생성 기능은 유지한다.

## Alternatives Considered

| 대안 | 설명                                                | 기술                                     | 성능                     | 유지보수                                   | 마이그레이션                   |
| ---- | --------------------------------------------------- | ---------------------------------------- | ------------------------ | ------------------------------------------ | ------------------------------ |
| A    | 현재 생성 후 수동 연결 유지                         | LOW — 새 경로 없음                       | LOW                      | MED — 대상 재선택 부담 유지                | LOW                            |
| B    | 기존 생성 액션/Creator에 대상 문맥과 자동 연결 추가 | MED — 문맥·template·Table Undo 경계 필요 | LOW — 실행 시 처리       | LOW — 생성 UI/IR 공유                      | LOW — 기존 저장 문서 변경 없음 |
| C    | 별도 Quick Connect 팝오버와 개별 생성·복구 hook     | MED — 두 쓰기 경로의 복구 필요           | LOW                      | MED — preset 옵션·검증·번역·오류 처리 중복 | LOW                            |
| D    | factory에서 자동 데이터 생성                        | MED — 요소 생성과 데이터 쓰기 결합       | LOW — 생성마다 추가 작업 | MED — 정적 편집에도 데이터 수명 관리 개입  | MED — 생성·삭제·Undo 의미 변경 |

### Risk Threshold Check

HIGH+로 분류한 잔존 위험은 없으나 B의 기술 MED는 미검증이다. B가 기존 자산을 가장 많이 공유하면서 수동 연결 단계를 제거한다. 이는 코드 경로에 근거한 설계 선택이며 live PASS나 완전한 DB 원자성의 판정이 아니다. Table/복합 Undo 경계는 gate로 차단한다.

## Decision

**대안 B: 기존 Data 생성 흐름의 생성 후 자동 연결**을 선택한다.

Data 행에서 열린 Creator만 대상 문맥을 갖고 생성과 연결을 하나의 사용자 실행으로 처리한다. 일반 생성은 기존 동작을 유지한다. DataChange 공통 적용기와 canonical mutation/history 계약을 재사용하고, 텍스트 template과 Table 컬럼까지 포함한 실행 범위를 검증한다.

A는 대상 재선택 문제를 남기므로 기각한다. C는 이미 존재하는 생성 UI와 preset 옵션·검증을 중복하므로 기각한다. D는 정적 items 편집에도 불필요한 데이터 생성과 수명 관리를 추가하므로 기각한다. 기본 아이템 전면 제거 및 일괄 `데이터를 연결하세요` empty state는 본 기능에 필요하지 않아 제외한다.

> 구현 상세: [013-quick-connect-data-binding-breakdown.md](../design/013-quick-connect-data-binding-breakdown.md)

## Risks

| ID  | 위험                                                 | 심각도 | 대응                                                         |
| --- | ---------------------------------------------------- | ------ | ------------------------------------------------------------ |
| R1  | 비동기 생성 도중 대상/문맥 변경으로 다른 요소에 연결 | MED    | 대상 명시·commit 경계 검증·요청 수명 확인; G1/G3             |
| R2  | template 변경이 생성·바인딩 history에서 분리         | MED    | 공통 draft·canonical/history 조합 경로 확정; G0/G3           |
| R3  | Table 컬럼 보존 실패, 중복/지연 ingress로 부분 Undo  | MED    | 보존·재매핑 기본, 명시적 교체, 전체 복구·Undo 검증; G2/G3    |
| R4  | 생성 또는 복구 저장 실패 후 orphan/거짓 성공         | MED    | 공통 역연산·오류 노출·read-back·중복 실행 방지; G3           |
| R5  | 일반 생성·정적 items·연결된 0건의 의미가 뒤섞임      | MED    | 진입 모드 구분, factory 유지, 6종 Canvas/Preview 확인; G1/G2 |

## Gates

| Gate | 통과 조건                                                                                  | 미충족 시                                           | 결과 (2026-09-17)                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | 최신 코드 inventory와 template/history·Table 컬럼/ingress 경계 확정                        | 설계 보강 후 구현 착수                              | **PASS** — template 은 자동 연결이 쓰지 않는다 (`getItemLabel` 휴리스틱이 텍스트 해소, 바인딩 후 컬럼 피커 자동 노출 → DataChange entry 1 로 완결) · 사전 UUID create+bind 는 현행 reducer 로 성립 (id 주석 정정) · Table 은 Builder 가 컬럼을 먼저 넣고 data entry 에 canonicalEvents 동반 |
| G1   | 대상 보존·중복 제출 방지·read-back과 기존 일반 생성/수동 바인딩 회귀 검사 통과             | 결선/문맥 검증 수정                                 | **PASS** — 실행 직전 precheck (missing / context / binding-changed) + commit 경계 `expectBindings` (rollback 검증 unit) · `isSubmitting` + mounted ref · read-back 뒤에만 status · Creator/PropertyDataBinding/dataChange/history 인접 100+ 테스트 PASS                                     |
| G2   | 6종의 생성 후 연결·0건·재연결·Canvas/Preview 표시 확인, Table 컬럼 정책과 Undo 실기동 통과 | 해당 컴포넌트 지원 미완으로 명시; 전체 완료 보류    | **PASS** — live 31/31 (§Live Exercise). 0건 은 DOM 5종 (ListBox/GridList/Select/ComboBox/Menu) 이 정적 children 으로 되돌아가던 결함을 수리한 뒤 통과                                                                                                                                       |
| G3   | 실패 주입·Undo/Redo·refresh hydration·늦은 ingress·요소 삭제 후 데이터 보존 통과           | 복구/수명 경계 수정; 오류 안내만으로 gate 대체 금지 | **PASS** — 실패 주입 unit (binding 변경 → DataChangeError + collection rollback · applyDataChange 실패 → 삽입 컬럼 제거 · History 0) · live 새로고침 hydration · 요소 삭제 뒤 collection 보존 · Preview 열어 둔 채 늦은 ingress 중복 0 (messenger 가드 + 컬럼 선삽입)                       |

### Live Exercise

2026-09-17 · **headed Playwright** (dev 5173 · `.auth-session.json`, Chrome MCP 는 hidden 탭 RAF 정지로 부팅 95% 정체 → 대체). 하니스 `apps/builder/scripts/adr013-quick-connect-live.mjs` (`--types=ListBox,GridList,Select,ComboBox,Menu,Table`) · 결과 `/private/tmp/adr013-quick-connect-live/findings.json` (로컬) · run ledger `20260917-025303-adr-013-*`.

| 시나리오 (breakdown §6)                                                                                                                                                                                                                             | 결과                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 2 · 4 — 6종: Data 행 「New table」 → Creator note "connected to {customId}" + 「Create & connect」 → 선택을 Button 으로 옮긴 뒤 preset 생성 → **원래 대상** `props.dataBinding.collectionId` = 새 collection · `x-composition` 없음 · Button 무변경 | 6/6 PASS (팔레트가 놓는 `ref` 인스턴스 4종 + 직접 노드 Select/ComboBox/Table)                                                    |
| 2 — Preview 가 연결 데이터를 그린다                                                                                                                                                                                                                 | ListBox 15 option · GridList 30 gridcell · Table 14 row + columnheader 13 · Select/ComboBox/Menu 는 팝오버라 존재만 (PASS)       |
| 9 — undo 1회 = collection 삭제 (IndexedDB) + 바인딩 해제 (+ Table 컬럼 제거) · redo = 같은 id 복원                                                                                                                                                  | 6/6 PASS                                                                                                                         |
| 7 — Table: schema 컬럼 13 이 TableHeader 에 생성 (key = field key) · Preview 열어도 중복 0 · 재연결 기본 보존 (unmatched 11 표시) · 명시적 교체 → 컬럼 = 새 schema 18 · undo 로 이전 컬럼 **순서까지** 복원                                         | PASS (remove 이벤트 index 내림차순 정렬로 순서 복원 — 첫 실측에서 순서가 뒤섞여 수리)                                            |
| 3 — 연결된 0건 ≠ 미연결: 빈 테이블로 연결한 ListBox 가 Preview 에서 option 0                                                                                                                                                                        | 첫 실측 FAIL (origin 정적 3행 잔존) → `packages/shared` 5 컴포넌트 수리 (`boundEmptyCollectionNoStaticFallback.test.tsx`) → PASS |
| 4 · 8 — 대상 삭제 뒤 「Create & connect」 → collection 수 동일 + 토스트 "The target element is gone — nothing was created."                                                                                                                         | PASS                                                                                                                             |
| 9 · 10 — 새로고침 hydration (바인딩 3 · 컬럼 13 · collection 4 그대로) · 연결 요소 삭제 뒤 collection 보존                                                                                                                                          | PASS                                                                                                                             |
| 1 — 일반 Data 패널 Add Table: note 0 · 「Create」                                                                                                                                                                                                   | PASS · page error 0 · dialog 0                                                                                                   |

- **범위 밖 (문서대로)**: API/AI 인계는 연결 모드에서 사유 note + 「Continue without connecting」 로만 일반 생성 전환 (unit). `ref` 인스턴스 Table 의 컬럼은 공유 origin 소유라 바인딩만 쓴다 (§3). 5 (연속 클릭 · 재열기) 는 unit (`isSubmitting` · mounted ref) — live 재현 없음. 6 (field rename 뒤 template 유지) 은 자동 연결이 template 을 쓰지 않아 대상 없음.
- **부수 발견**: (a) DOM 5종의 "바인딩 + 0행 → 정적 children" 은 ADR-013 이전부터 있던 D3 비대칭 (Skia 는 `[]`) — 이번에 수리. (b) 팔레트가 Components 페이지 origin 이 있는 타입은 `ref` 를 놓는다 — 하니스가 `componentName` 으로도 대상을 찾는다. (c) Compare Mode 토글마다 iframe 이 교체되고 새 iframe 이 다음 canonical 변경까지 문서를 못 받는 경우가 있어 하니스는 한 번만 켜고 반영을 기다린다.

## Consequences

### Positive

- 기존 생성 방법과 옵션을 유지하면서 생성 후 대상 재선택을 없앤다.
- 동일 IR/저장/Undo 경로를 재사용해 별도 hook의 복구 규칙 중복을 줄인다.
- 정적 collection 편집과 데이터 독립성을 보존한다.

### Negative

- 단순 UI 결선 외에 대상 수명, template 저장, Table 컬럼의 복합 Undo 구현이 필요하다.
- API/AI 인계는 초기 자동 연결 범위에 포함되지 않는다.
- Table의 비동기 생성 경계가 해결되지 않으면 일부 컴포넌트 전달 후에도 ADR 전체는 완료할 수 없다.
