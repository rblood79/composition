# ADR-013 구현 상세 — 기존 Data 생성 흐름의 생성 후 자동 연결

> [ADR-013](../013-quick-connect-data-binding.md)의 상세 설계. 2026-09-16 사용자 요청에 따라 현재 Builder 구현 기준으로 수정했다. **설계만 갱신했으며 구현·live 검증은 미수행(UNVERIFIED)**이다. 2026-07-16 리뷰 기록은 당시 설계의 이력으로 보존한다.

## §0. 이전 설계에서 바뀐 결정

| 이전 설계                                            | 현재 결정                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| 별도 QuickConnectButton + preset 팝오버              | 기존 Data 행 28px 생성 액션과 DataTableCreator 재사용               |
| preset 선택을 1클릭 완결로 표현                      | 생성 설정 후 한 번의 실행으로 생성·연결 완결; 총 클릭 수 보장 아님  |
| factory 기본 아이템 제거 + 6종 연결 안내 empty state | 정적 items 유지; 미연결과 연결된 0건 구분; 전면 빈 상태 개편 제외   |
| createDataTable → binding 콜백 → 개별 복구           | DataChange 생성·바인딩 묶음과 공통 실패 복구·history 재사용         |
| label/description을 fieldMap에 자동 기록             | 텍스트는 field template, fieldMap은 value/icon의 fieldId            |
| props.dataBinding 직접 기록                          | 공통 적용기 → props.dataBinding; extension은 legacy/restore         |
| Table Column/ColumnGroup 전체 교체                   | 기존 컬럼 보존·재매핑 기본, 파괴적 교체는 명시적 선택               |
| Undo 미통합이면 안내로 대체                          | 사용자 실행 전체 Undo 필수; Table은 컬럼까지 검증 전 완료 판정 금지 |

## §1. 현재 구현 근거와 미검증 경계

아래 경로는 repository root 기준이며, 2026-09-16 작업 트리에서 확인했다. 병행 preset/sample-data 변경은 유지하며 구현 착수 시 최신 계약을 재확인한다.

| 현재 코드                                                                                                                                                                         | 확인한 사실                                                                                                                                                | 설계에 미치는 영향                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/builder/src/builder/components/property/PropertyDataBinding.tsx` — `PropertyDataBindingCreateAction`                                                                        | `openTableCreator(projectId)`만 호출                                                                                                                       | 대상 element/page/project 문맥 전달이 필요                                        |
| `apps/builder/src/builder/panels/datatable/types/editorTypes.ts` — `table-create`                                                                                                 | mode에 projectId만 보관                                                                                                                                    | optional 연결 대상 문맥 추가; 일반 생성은 기존 동작 유지                          |
| `apps/builder/src/builder/panels/datatable/DataTableEditorPanel.tsx`                                                                                                              | Creator에 projectId/onClose 전달                                                                                                                           | 대상 문맥을 Creator 실행까지 전달                                                 |
| `apps/builder/src/builder/panels/datatable/editors/DataTableCreator.tsx` — `handleCreate`                                                                                         | empty/preset/paste/file 생성 후 테이블 편집기 전환; API/AI는 다른 흐름으로 이동                                                                            | 기존 UI·preset 생성 옵션 재사용, API/AI 인계는 초기 자동 연결 범위 밖             |
| `apps/builder/src/builder/stores/utils/dataActions.ts` — `createDataTable` wrapper                                                                                                | 별도 생성은 DataChange history를 기록                                                                                                                      | 연결 모드에서 먼저 호출한 뒤 바인딩을 별도 실행하면 Undo가 나뉨                   |
| `apps/builder/src/builder/stores/utils/dataChange.ts` — `createApplyDataChangeAction`                                                                                             | collection 연산 후 binding 사전검증·적용, 역연산·복구, history 1개                                                                                         | 공통 적용기를 조합의 기본 경로로 사용                                             |
| `packages/shared/src/schemas/dataChange.ts`                                                                                                                                       | create_collection, bind_element와 fieldId 계약                                                                                                             | 기존 IR 소비; 별도 Quick Connect 저장 스키마 금지                                 |
| `PropertyDataBinding.tsx` / `packages/shared/src/collections/fieldTemplateStorage.ts`                                                                                             | value/icon 매핑과 텍스트 템플릿 분리; 저장 템플릿은 `{#fieldId}`                                                                                           | label/description fieldMap 추정 로직 폐기                                         |
| `apps/builder/src/builder/stores/elements.ts` — `applyCanonicalDataBindingPatch`; `apps/builder/src/adapters/canonical/canonicalMutations.ts` — `updateCanonicalNodePropsPrimary` | 정상 쓰기는 props.dataBinding 기록 + extension 비우기; restore는 두 위치의 원본 스냅샷 복원. primary 경로는 updateNodeProps의 FORBIDDEN 필터를 거치지 않음 | 적용기 경유; 캡처는 props/extension 스냅샷 보존, 정상 쓰기 read-back은 props 기준 |
| `apps/builder/src/builder/factories/definitions/SelectionComponents.ts`, `NavigationComponents.ts`                                                                                | props.items 사용; ListBox/GridList는 anchor-less, Menu는 children 없음                                                                                     | item child 일괄 제거 설계 폐기                                                    |
| `packages/shared/src/renderers/TableRenderer.tsx`                                                                                                                                 | 기존 Column 우선; 자동 컬럼은 postMessage로 생성 요청                                                                                                      | 스키마 재연결·기존 편집 보존·완료 read-back 필요                                  |
| `apps/builder/src/builder/hooks/useIframeMessenger.ts` — `flushPreviewGeneratedElements`                                                                                          | Preview 생성물 ingress는 명시적으로 history 미기록                                                                                                         | DataChange만으로 컬럼 Undo까지 해결됐다고 판정 금지                               |

**미검증**: 6종의 실제 바인딩 전환·빈 상태, Table 동일 source 재연결 캐시, 실패/Undo/Redo/refresh 결과. 코드 존재는 이 흐름들의 PASS 근거가 아니다.

## §2. 사용자 흐름과 연결 대상

1. ListBox/GridList/Select/ComboBox/Menu/Table의 Data 행 생성 액션에서 기존 Creator를 연다. 일반 Data 패널에서 열면 연결 대상 없이 기존 생성 동작을 유지한다.
2. 진입 시 immediate selection/context 계약으로 projectId·pageId·elementId·편집 문맥·기존 바인딩을 캡처한다. 정상 바인딩은 `props.dataBinding`에서 읽고, legacy/import 복구를 위해 적용기와 동일하게 props/extension 두 위치의 원본 스냅샷을 보존한다. 모드에는 직렬화 가능한 대상 정보만 두며 선택 요소 객체나 오래된 onChange 콜백을 보관하지 않는다.
3. Creator에 연결 대상 이름과 `만들고 연결` 실행 의미를 표시한다. empty/preset/paste/file은 기존 입력·미리보기·seed·blank 옵션을 재사용한다.
4. 실행 직전 및 비동기 저장 후 canonical commit 경계에서 원래 대상의 존재, 프로젝트/페이지/편집 문맥, 바인딩 변경 여부를 검증한다. 다른 요소가 선택되어도 그 요소로 대상을 바꾸지 않는다. 원래 대상이 유효하면 원래 대상에 연결하고, 삭제·문맥 이탈·다른 바인딩 편집 시 무변경 중단 또는 공통 복구한다.
5. 처리 중 중복 실행을 막고 mode 교체·닫기·재열기의 오래된 완료 응답이 새 패널 상태를 덮지 않도록 요청 수명을 확인한다. 성공은 원래 대상의 `props.dataBinding` read-back과 extension 바인딩 해제 확인 이후 알린다.
6. API/AI 인계는 초기 자동 연결 지원에서 제외한다. 연결 모드에서는 미지원 이유를 표시하고 일반 생성으로 명시적으로 전환할 수 있게 한다. 인계 후 자동 연결된다고 안내하거나 문맥을 조용히 버리지 않는다. 일반 생성의 API/AI 기능은 유지한다.

## §3. 생성·매핑·Undo 계약

- 기존 생성 입력을 공통 draft로 정규화한다. 이름 정책·schema/fieldId 부여·preset 번역·샘플 생성은 현행 생성 경로를 공유하며 별도 suffix 정책이나 생성기를 복제하지 않는다.
- 연결 모드는 생성과 `bind_element`를 하나의 `applyDataChange` 실행에 넣는다. 현행 생성 wrapper를 먼저 실행해 별도 history를 만들지 않는다.
- 같은 묶음의 `create_collection.id`와 `bind_element.collectionId`에 사전 생성 UUID를 사용한다. 현행 reducer가 `op.id`를 채택하고 중복 ID를 거부하며, binding preflight는 reduce 후 `result.collections`를 대조하므로 API 변경 없이 성립한다 (`dataChange.ts`의 `create_collection`, `preflightBindingOps`, `createApplyDataChangeAction` 확인). Phase 0에는 이 확인 사실을 기록하고, 구현 시 `schemas/dataChange.ts`의 복원 전용으로 적힌 id 주석 범위를 정정한다. 별도 ID 예약 API 신설이나 이름 기반 임시 연결은 필요 없다.
- 바인딩은 source `dataTable` + collectionId + 호환 name, 필요한 value/icon fieldId로 구성한다. 텍스트 역할은 기존 component template/override 계약에 맞는 `{#fieldId}`로 준비한다. 공유 component origin을 수정하지 않는다.
- 현재 DataChange만으로 텍스트 template/override 변경까지 묶인다고 가정하지 않는다. 추가 변경이 필요하면 기존 canonical/history 조합 경로를 확정하고 생성·바인딩·template 변경을 한 사용자 실행으로 되돌릴 수 있어야 한다. 해당 경계가 G0 미해결이면 본 구현을 시작하지 않는다.
- 기존 binding/template과 정적 items는 복원 가능하게 보존한다. 재연결해도 이전 collection은 삭제하지 않는다. 이후 사용자의 컴포넌트 삭제도 collection을 삭제하지 않는다.
- 실패는 공통 적용기의 역연산과 persistence 경로로 복구한다. 복구 저장 실패를 console.error만 남긴 채 성공 처리하지 않는다. 오류를 노출하고 재시도/복구 가능 상태를 유지하며 재실행의 중복 생성을 차단한다. 이는 목표 계약이며 현행 적용기의 완전한 DB 원자성을 주장하지 않는다.
- Undo 1회는 이 실행의 새 collection·바인딩·template/컬럼 변경을 되돌리고, Redo는 같은 ID와 표시 결과를 복원한다. 후속 수동 편집은 기존 history 순서를 따른다.

## §4. Table 컬럼 정책

- 신규 Table: 생성 schema 기준으로 컬럼을 준비하며 0행이어도 schema로 연결 결과를 표현한다. Preview가 열려 있어야만 생성이 완료되는 구조를 성공 조건으로 삼지 않는다.
- 재연결: 기존 Column/ColumnGroup의 ID·순서·폭·스타일·정렬 설정을 기본 보존한다. 새 schema의 fieldId와 기존 필드 key/type을 비교해 유일하게 대응되는 필드를 재매핑한다. 모호하거나 사라진 필드는 실행 전에 해결하도록 표시한다.
- 새 스키마로 전면 교체는 변경 내용을 확인한 명시적 선택일 때만 수행한다. 확인 전 기존 컬럼을 삭제하지 않는다.
- 적용 방식은 G0에서 확정한다. Builder 측 canonical command로 컬럼 변경을 동일 Undo 범위에 포함하거나, 동등한 보장과 요청 상관관계를 갖춘 기존 경로를 사용한다. 현재 Preview ingress의 history skip을 그대로 두고 전체 Undo를 주장하지 않는다.
- 늦게 도착한 `ADD_COLUMN_ELEMENTS`/`ADD_FIELD_ELEMENTS`가 중복 생성하거나 Undo 후 노드를 되살리지 않도록 소유권·취소·재전송 정책을 검증한다. 기존 수동 바인딩 경로도 유지한다.
- 동일 source/다른 collection, 동일 필드 key/다른 fieldId, 다른 schema를 각각 검증한다. 캐시 문제를 재현하지 않은 상태에서 임시 null 바인딩 우회를 추가하지 않는다.
- Table 전체 실행의 실패 복구·Undo를 입증하지 못하면 Table 자동 연결을 미지원으로 명시한다. 나머지 컴포넌트의 부분 전달과 ADR 전체 완료를 구분한다.

## §5. Phase와 Gate

| Phase | 작업                                                                                                                                                      | 완료 조건                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 0     | 현재 코드/6종 capability 재확인; 사전 UUID create+bind 지원 사실 기록 및 id 주석 정정 계획, template/history, Table 컬럼·늦은 ingress·오류 복구 경계 확정 | G0: 적용 경로와 실패 시 상태를 기록. 현재 UNVERIFIED                                        |
| 1     | 기존 생성 액션·editor mode·Creator에 대상 문맥과 생성 후 연결 결선, 공통 draft/적용 경로 구현                                                             | G1: 일반 생성 회귀 없음, 대상 검증·중복 제출 방지·binding/template read-back 및 인접 테스트 |
| 2     | 6종 연결 전환과 Table 컬럼 보존·재매핑·명시적 교체, 전체 Undo 처리                                                                                        | G2: Canvas/Preview 데이터·0건·재연결·Undo/Redo live 확인; Table 미통과 시 전체 완료 보류    |
| 3     | 실패 주입·refresh hydration·기존 수동 흐름 회귀 검증                                                                                                      | G3: 모든 hard constraint와 아래 시나리오 PASS 후에만 상태 승격                              |

구현 시 TS 변경은 `pnpm run codex:typecheck`, 인접 Vitest, 실제 Builder 흐름 및 필요한 `cross-check`를 수행한다. 완료 기본 게이트는 `pnpm run codex:preflight`; 병행 dirty 변경이 있으면 `.agents/README.md`의 범위별 검증을 따른다. 사용자 가시 구현 완료 시 CHANGELOG와 ADR 인덱스를 갱신한다. 문서 수정만으로 Phase/Gate를 완료 처리하지 않는다.

## §6. 검증 시나리오

1. 일반 Data 패널 생성: 기존 생성·편집 전환 및 API/AI 인계 유지; 임의 컴포넌트 자동 연결 없음.
2. 대상 6종: preset 생성 후 원래 대상에 연결, fieldId/template 저장과 Canvas/Preview 표시 확인.
3. empty/paste/file: 기존 입력 사용; 0행 연결에서 정적 샘플이 되살아나지 않고 미연결과 구분됨.
4. 선택 변경: A에서 시작해 B를 선택해도 B에는 쓰지 않음. A 삭제·프로젝트/페이지 문맥 이탈·A 바인딩 변경은 안전하게 중단/복구.
5. 연속 클릭·패널 닫기/재열기·중복 이름: 중복 생성이나 오래된 완료 응답의 오적용 없음.
6. label/description template 및 value/icon fieldId가 필드 rename과 refresh 후 유지; 공유 origin 불변.
7. Table: 신규 0행 schema, 기존 컬럼 보존·재매핑, 명시적 전체 교체, 동일 source 재연결 확인.
8. 생성 저장·binding commit·template/컬럼 단계 실패 주입: 이전 상태 복구, orphan/깨진 참조 없음. 복구 저장 실패는 사용자 오류로 관찰 가능.
9. Undo 1회/Redo 및 refresh: collection·바인딩·template/컬럼이 함께 복원되며 늦은 Preview ingress가 되살리지 않음.
10. 기존 collection 수동 선택·연결 해제·정적 items 편집 유지; 요소 삭제 후 collection 유지.

모든 실행 결과는 **UNVERIFIED**. 이 문서는 구현 계획이며 테스트 실행 보고서가 아니다.
