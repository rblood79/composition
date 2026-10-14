# ADR-261 design breakdown — 컴포넌트 API (교체 · slot 추천 · 속성 · drop 부모)

> 본문: [../261-component-api-swap-slot-suggestions-properties.md](../261-component-api-swap-slot-suggestions-properties.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 는 로컬 전용이라 실측 결론은 여기에 둔다.

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: ADR-260 (원본 참조 모델, Implemented) 이 base 이고 이 ADR 은 그 위의 응용이다. ADR-260 breakdown §1 「후속 기능 4건 — 막지 않음」 이 의존 방향을 확인했다. [ADR-262](262-instance-override-push-and-reset-all-breakdown.md) 와는 직교한다 — 262 는 override 만 다루고, 이 ADR 의 속성 값을 원본에 반영하는 행만 262 가 이 ADR 뒤에 더한다.
2. **schema**: 선택 필드 둘이다 — `DefinitionEntry.properties?` · `NodeEntry.slot.suggested?`. 옛 문서는 필드가 없어 지금과 같다. 직교한다.
3. **선행 전제 reverse 검증**: ADR-260 Consequences 의 「variant / component property 범위 밖」 은 「260 범위 밖」 이라는 뜻이었고, 후속 설계는 사용자 지시 (2026-10-14 「260 종료 후 설계」) 다. 분리 confirm 은 2026-10-15 AskUserQuestion 「2개 (권장)」 이다.
4. **판독**: Codex 1차는 사용자가 요청할 때 (`/review-adr 261`).

## 1. Phase 0 — inventory · live 재현 · oracle (G0)

- **live 재현 2건** (headed Chrome · dev 5173 · 저장된 인증 세션):
  - ① 사용자 컴포넌트 instance 의 container 자리에 Canvas drop → 원본 노드 `children` 이 바뀌는지.
  - ② layout 을 적용한 page 내용에서 화살표 순서 · 「선택 뒤 붙여넣기」 → layout template 이 바뀌는지.
  - 결과 (RED · 재현 안 됨) 를 아래 「Phase 0 결과」 에 적는다.
- **경로 inventory** (2026-10-15 코드 판독, 본문 현재 6 · 7):

| 경로             | 파일:라인                                                                                                                                      | 지금 부모                                    | 바꿀 것                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------- |
| Canvas drop 대상 | `catalogRuntime/canvasGesture.ts:1228-1291` (`dropTarget`)                                                                                     | `{node, record.sourceId}` (1262 · 1283)      | record 의 EditTarget          |
| drop 실행 (이동) | `canvasGesture.ts:1016-1019`                                                                                                                   | `{node, drop.parent}`                        | 대상 그대로 전달              |
| Alt 복제 drop    | `canvasGesture.ts:1001-1004` · 절대 배치 `1066-1090` · `1137-1152`                                                                             | `{node, …}` · `parent.sourceId`              | 같은 대상                     |
| 선택 뒤 붙여넣기 | `catalogRuntime/canvasMenu.ts:309-325` (`pasteInto` 179-187)                                                                                   | `parent.sourceId`                            | EditTarget                    |
| z-order          | `canvasMenu.ts:337-347`                                                                                                                        | `parent.sourceId`                            | EditTarget                    |
| ⌘V · 화살표 순서 | `catalogRuntime/shortcuts.ts:373-395` · `426-444`                                                                                              | 메뉴 경로 · `parent.sourceId`                | EditTarget                    |
| Layers drop      | `catalogRuntime/layerTree.ts:427-468`                                                                                                          | `node` 부모만 (442 · 447)                    | `descendant` 부모 · 자식 허용 |
| 팔레트 (기준)    | `catalogRuntime/paletteInsert.ts:118-121` · `150-210`                                                                                          | `itemOfRecord(record.id).target` (이미 맞다) | 그대로                        |
| 명령             | `commands/structure.ts:160-198` (`insertNodes`) · `829-894` (`moveNodes`) · `1310-1379` (`pasteNodes`) · `context.ts:291-329` (`setChildList`) | `descendant` 부모 지원                       | 그대로                        |

- **원본 쓰기 막는 검증 추가 여부**: 명령 층에서 「`{kind: node}` 부모가 정의 template 노드 (참조 원본 · 숨은 template · layout template) 이고 편집 맥락이 그 정의 view · page 원본이 아니다」 를 판정할 수단이 없다 (명령은 맥락을 모른다). 그래서 수리는 Builder 의 부모 결정 한 곳에서 하고, 그래프 검증은 바꾸지 않는다. Phase 0 이 이 판단을 다시 확인한다.
- **주소 보유 필드 전수** (리뷰 h2 · Round 2): `InstanceAddress` · template id 경로를 갖는 필드 (interaction `types.ts:801` · `descendantOverrides` · `showWhen.from` / `all[].from` 의 `ancestor.address` · `ancestor.local` `types.ts:698-726` · 그 밖 — grep 으로 센다) 와 각자의 검증 지점 (`graph.ts:936-941` 등). 교체 · instance 속성이 같은 transaction 에서 고칠 목록이다.
- **`replace` override 지원 확인** (리뷰 h3 · h4): 투영 (`resolver.ts`) · 자리 열거 (`positions.ts`) · 주소 검증 · materialize (detach · 다른 프로젝트 붙여넣기) · Layers · 선택이 `replace` 를 다 지나는지. 테스트 (`commands/__tests__/g0DescendantRoutes.test.ts:538`) 밖 경로를 표로 적고, 빠진 곳은 Phase 5 의 수리 행이 된다.
- **교체 영향 inventory**: override 주소 (`types.ts:454-459`) 를 만드는 · 읽는 곳 (`resolution/address.ts` · `templateOwners.ts` · `CatalogComponentSection.tsx:107-160` · `structure.ts:1101-1107` 숨김) · `definitionId` 를 읽는 캐시 (compositionRoot 영향 root · `definitionOfTemplateRoot` 역색인) — 교체가 무효화해야 할 것.
- **oracle 표** (pen.dev · Figma 문서, 본문 Context): slot 추천 (제한 아님) · drag/paste 채우기 · 원본 유래 레이어 이동 불가 · 교체 override 유지 (이름 기준) · 속성 3종 · 기본값 · preferred. 행마다 composition 결과 (지금 · Phase 뒤) 를 적는다.

### Phase 0 결과

(실행 시 기록)

## 2. Phase 1 — drop · 붙여넣기 · 순서 부모 = EditTarget (G1, 본문 Decision 1)

- 출발지 판정 (리뷰 h1) — 옮길 노드는 편집 대상이 `node` 인 record 만 (instance 소유 노드 · slot 자식). `descendant` (원본에서 투영된 자리) 는 옮기기 · 순서 · z-order 대상에서 뺀다. 화살표 순서 (`shortcuts.ts:426-444`) · z-order · Canvas `beginMove` (이미 node 만 — `canvasGesture.ts:381-385`) · Layers (`layerTree.ts:447`) 가 같은 판정.
- 공용 함수 하나 — 「record → 넣을 부모 대상」 (`workspace.itemOfRecord(id).target` · `node` 면 node · `descendant` 면 그 instance 자리). 위 표의 Canvas 경로 전부와 Layers 가 이 함수를 쓴다.
- 순서 index 는 대상의 자식 목록 기준 — `descendant` 면 `fillSlot` 자식 (없으면 `ensureChildList` 가 만들 template 자식 순서) 이다. Canvas `insertionIndex` · Layers 형제 계산을 그 목록으로.
- slot 이 아닌 container 자리: 사용자 결정 2 의 답대로 (기본안 거부 — 대상 함수가 `slot` 선언 없는 template 자리를 건너뛰어 바깥 부모로).
- 원본 첫 편집 확인 대화상자 (`componentConfirm.ts`) 는 원본에서 직접 편집할 때만 남는다 — instance 안 drop 이 더는 원본을 쓰지 않으므로 그 경로의 대화상자도 사라진다 (본문 R7).
- 테스트: 경로마다 「instance 자리 → `fillSlot` 변경 · 원본 / layout template entry 동일」 · slot 안 순서 · 원복 RED (부모를 `sourceId` 로 되돌리면 실패). 기존 `__tests__/phase4eCanvasGesture.test.ts` · `phase4eCanvasMenu.test.ts` 옆에 둔다.
- live: slot 에 Canvas drag · paste 로 채우기 · 같은 slot 안 순서 · Layers 로 slot 에 넣기 · 원본 무변경 · layout page 내용 이동.

## 3. Phase 2 — instance 교체 (G2, Decision 2)

- shared 명령 `swapInstance({id, definitionId, newId})` (`commands/components.ts`):
  - instance 가 아니면 `NOT_AN_INSTANCE`. 같은 정의면 no-op.
  - entry 다시 쓰기 (`applyLayout` 의 `put` 과 같은 방식) — id · `placement` · 루트 own 필드 유지, 루트 `props` 는 새 `instanceContract` 가 받는 키만.
  - 주소 재매핑: 옛 정의 template 경로 → 「이름 ?? type + 같은 이름 형제 중 순서」 경로 → 새 정의에서 유일한 자리. 중첩 instance 주소 (`instances` 2개 이상) 는 첫 자리를 재매핑하고 나머지를 그대로 둔다 (안쪽 정의가 같으면 유지, 다르면 버림).
  - `fillSlot`: 같은 slot name 의 새 자리로. 못 맞추면 사용자 결정 1.
  - 같은 transaction 에서 주소 보유자 (Phase 0 전수 — interaction · 바깥 instance 의 이 노드를 지나는 override · `showWhen` 상태 소유자) 를 같은 규칙으로 옮긴다. 테스트에 Round 2 재현 (slot 자식 `isSelected` 조건 → 교체 뒤 표시 유지) 을 넣는다. 못 맞추면 사용자 결정 6 (리뷰 h2).
  - 결과 (유지 · 버림 수) 를 command label · 반환 메타로 — Builder 가 토스트.
- Builder: Component 절의 컴포넌트 이름 → picker (사용자 결정 3 · 5) · Canvas 오른쪽 클릭 「Swap instance」 · i18n ko/en.
- 무작위 명령 500 단계 하니스 (ADR-248 4b) 에 `swapInstance` 를 넣는다.

## 4. Phase 3 — slot 추천 (G2, Decision 3)

- `NodeEntry.slot.suggested?: DefinitionId[]` · library `LibraryTemplateNode.slot` 은 손대지 않는다.
- 검증: `validation.ts:1198-1203` 에 배열 · 존재 (`DANGLING_DEFINITION`). 그래프 참조 색인 (`referencedIds`) 에 포함. 정의 삭제 · 해체 때 추천에서 뺀다.
- 다른 프로젝트 붙여넣기 (리뷰 m1): 대상 그래프에 없는 project 정의 추천을 뺀다 (library id 는 유지) — ADR-260 경로는 정의를 가져오지 않고 instance 를 굳힌다 (`structure.ts:1393-1437` · `materialize.ts:353`). 같은 프로젝트 붙여넣기는 그대로.
- UI: `CatalogSlotSection.tsx` — 원본 쪽 「+」 (picker) · 추천 칩 목록 · 제거. instance 쪽은 추천을 넣기 목록 맨 위에 (`catalogSlotInsertOptions` `slots.ts:286` 에 추천 그룹).

## 5. Phase 4 — 속성 text · boolean (G3, Decision 4)

- `DefinitionEntry.properties?` 타입 · 검증 (대상이 원본 서브트리 안 · 종류별 대상 field 존재 · 키 유일).
- 계약: 정의 `accepts` 를 속성 표에서 파생 (text → `string`, boolean → `boolean`) — `instanceContract` (`document/library.ts:138-180`) 가 그대로 받는다.
- resolver: template 자리 투영 때 「그 자리 노드를 대상으로 하는 속성」 의 가장 바깥 instance 값 → text 는 대상 prop, boolean 은 `enabled`. 루트 prop 전달 (`resolver.ts:1597-1600`) 에서 속성 키 제외.
- detach (`materialize.ts:1024` `detachInto`) 가 값을 굳힌다. 대상 삭제 · 서브트리 밖 이동 정리.
- 패널: `editContract.ts` 에 속성 계약을 더한다 (사용자 컴포넌트 instance — Property 탭 「Component properties」 섹션). 원본 Component 절의 「Properties」 목록 · 레이어에서 만들기 · 이름 바꾸기 · 지우기.

## 6. Phase 5 — instance 교체 속성 (G3)

- kind `instance`: 대상 = 원본 안의 중첩 instance 노드 T. 값을 바꾸는 명령 = instance 의 T 자리에 `replace` override (instance 소유의 새 instance 노드, 정의 B) 를 쓴다. T 안쪽 override · 주소 보유자는 Phase 2 재매핑 규칙으로 새 노드에 옮긴다. 값 = 그 노드의 `definitionId` (따로 저장 0) · 기본값으로 되돌리기 = replace 제거. resolver 에서 정의만 바꾸는 방식은 쓰지 않는다 (리뷰 h3 · h4 — 의존성 · 자리 열거 · 주소가 옛 정의를 따른다).
- 테스트: B 원본 편집 → I 가 영향 목록에 · clipboard snapshot 에 B · 실제 정의 순환 (원본 안에서 자기 정의 선택) 은 `DEFINITION_CYCLE` — page instance 의 replacement 가 A 를 가리키는 것은 순환이 아니다 (Round 2 LOW) · 그려진 B 안 자리 선택 · 편집.
- preferred = Phase 3 picker 재사용.

## 7. Phase 6 — 종료 (G4 · G5)

- live 스크립트 `apps/builder/scripts/adr261-component-api-live.mjs` (ADR-260 live 스크립트 2개의 패턴).
- Compare Mode 로 속성 값 Canvas = Preview.
- 문서: 본문 Live Exercise · README · CHANGELOG · 메모리 `project-origin-instance-slot-reference-pen-figma`.

## 8. 기록

- 2026-10-15 Proposed — 코드 판독 (서브에이전트 2 · 핵심 인용은 실행자 재확인: `components.ts:124-140` · `types.ts:191-207 · 454-496 · 739-747` · `canvasGesture.ts:1245-1285` · `canvasMenu.ts:305-326` · `positions.ts:224-236` · `layerTree.ts:440-465` · `structure.ts:829-845` · `graph.ts:861-864`). Phase 0 의심 1건은 코드상 확정, live 재현은 Phase 0.
- 2026-10-15 Codex 설계 리뷰 Round 1 — HIGH 4 · MEDIUM 1. 실행자 코드 대조: `shortcuts.ts:426-444` (ids 도 `sourceId`) · `types.ts:801` + `graph.ts:936-941` (interaction 주소 검증) · `positions.ts:333-340` (자리 열거는 authored 정의). r1 수리 — 본문 Decision 1 · 2 · 3 · 4 · 사용자 결정 6 · Risks R8 · R9, 이 문서 §1 · §2 · §3 · §4 · §6. 수리 검증 (Round 2) 대기.
- 2026-10-15 Codex 수리 검증 Round 2 — h1 · h3 · h4 · m1 닫힘 (실행 확인), h2 남음 (`showWhen` 상태 소유자 주소 — `types.ts:698-726` 실행자 확인). r2 — Decision 2 대상을 주소 필드 전수로 · `showWhen` 추가. LOW deferred 1 (Phase 5 순환 문구 — 정정). 판독 상한 도달 — 확인은 Phase 2 G2.
