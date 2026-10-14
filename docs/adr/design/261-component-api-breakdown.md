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

**live 재현 (2026-10-15, headed Chrome · dev 5173 · `apps/builder/scripts/adr261-drop-parent-live.mjs`, main `21705cd91`)** — fixture: Frame A > Frame S (slot `content`) → Create component → ⌘D instance I → 팔레트로 I 의 slot 에 Button b1 · b2 (fillSlot, 이미 맞는 경로).

| 행  | 조작                                        | 결과 (수리 전)                                                                             | 판정 |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------ | ---- |
| ①-a | I slot 의 b1 선택 · ArrowDown               | b1 이 I `fillSlot` 에서 빠져 **원본 S `children`** 으로 — 「instance 영향」 대화상자 뜸    | RED  |
| ①-b | b1 선택 · ⌘C ⌘V (선택 뒤 붙여넣기)          | 사본이 **원본 S `children`** 에 — 대화상자 없음                                            | RED  |
| ①-c | page 의 Button 을 I slot 자리로 Canvas drag | 문서 무변경 (drag 좌표 · 시작 조건 미확인 — G1 에서 다시 잰다)                             | 미정 |
| ②   | layout 적용 page 내용 p1 선택 · ArrowDown   | p1 이 body `fillSlot` 에서 빠져 **layout template slot C `children`** 으로 — 대화상자 없음 | RED  |

**주소 보유 필드 전수 (grep, 서브에이전트 + 실행자 인용 확인)** — 저장 주소는 넷이다.

| 필드                                                                         | 형태 · 위치                                    | 검증                                                                                                                        | 교체 시 주의                                                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `NodeEntry.descendantOverrides[].address` (`patch` · `replace` · `fillSlot`) | `InstanceAddress` `types.ts:454-459 · 477-489` | 형태 `validation.ts:795-866` · 참조 `graph.ts:846-893` → `address.ts:21-91` · refIndex (`referencedIds` `graph.ts:100-110`) | `replacementId` · `childIds` 는 소유 edge — 버리면 `UNOWNED_NODE`. 지우거나 옮겨야 한다                      |
| `InteractionEntry.address?` (`ownerId` 와 쌍)                                | `types.ts:801-805`                             | `graph.ts:937-942` · refIndex                                                                                               | 선례 `reanchorInteractions` (`materialize.ts:958-1004`)                                                      |
| `showWhen.from` · `all[].from` 의 `ancestor.address`                         | `types.ts:698-726`                             | **graph 검증 없음 · refIndex 밖** — 명령의 `assertStateOwnersLinked` (`structure.ts:469-610`) 만                            | 깨져도 거부되지 않고 노드가 조용히 숨는다 (`presence.ts:2729-2781`). 재매핑 유틸 `stateOwnerRefs.ts:135-174` |
| `showWhen` 의 `ancestor.local`                                               | `types.ts:704-708`                             | 형태만 (`validation.ts:1600-1617`)                                                                                          | 지금 production 작성자 0 (패널은 `nodeId` 만) — 스키마상 대상                                                |

주소가 아닌 것 (재매핑 불요): `binding` (collection · field id) · `slot` / `regions` (이름) · `metadata` · `{key}` 바인딩 · `StateVariableEntry.ownerId` · `action.targetId` (NodeId — 교체해도 id 유지). 단 `ancestor.nodeId` = X 인 `showWhen` 은 교체로 X 의 type 이 바뀌면 그 상태 키가 없어질 수 있다 (Phase 2 결과 알림 대상).

교체 대상 X 가 원본 (project template) 안 노드면, 그 정의의 다른 instance 주소 중 `instances` 에 X 가 든 것도 옛 정의 경로라 깨진다 (`address.ts:74-80`) — Phase 2 범위 (Decision 2 「바깥 instance 의 이 노드를 지나는 override」).

**`replace` override 지원 표** (서브에이전트 + 실행자 인용 확인 `graph.ts:865` · `fields.ts:472` · `structure.ts:1052-1069`)

| 층                                      | 지원 | 근거 · 빠진 것                                                                                                                                                                                                                          |
| --------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| resolver 투영                           | O    | `resolver.ts:1516-1552` — replacement 는 `resolveOwned` 로 slot 정보 · `{prop}` · 행 · 루트 props 를 받지 않는다 (Phase 5 확인 행)                                                                                                      |
| 자리 열거 · `targetExists`              | O    | `positions.ts:201-215 · 411-415` — replace 분기는 그 자리 patch `enabled` 를 보지 않는다                                                                                                                                                |
| 주소 검증                               | O    | `graph.ts:846-852`. 호환성 (type · nesting) 검사 없음 · prop 검증은 replace 를 건너뜀 (`graph.ts:865`)                                                                                                                                  |
| 소유 · 순환 · 영향                      | O    | `ownedChildren` `graph.ts:84-97` · `validateDefinitionCycles` `graph.ts:1158-1190` · `collectAffectedIds` `graph.ts:1209-1241`                                                                                                          |
| clipboard · 다른 프로젝트 붙여넣기      | O    | `structure.ts:1237 · 1271-1275 · 1401-1438`                                                                                                                                                                                             |
| detach                                  | 부분 | 일반 O (`materialize.ts:324-329`). template root replace 는 `POSITION_REPLACED`. replacement 하위 `showWhen` 주소 재매핑 없음 · 같은 주소 patch 가 replace 사본을 덮음 (`materialize.ts:473 · 508`)                                     |
| Builder Layers · 선택 · compositionRoot | O    | `readModel.childRows` · `positionOfRecord` · `compositionRoot.ts:2999-3004 · 3577-3583 · 3770-3778`                                                                                                                                     |
| 되돌리기 명령                           | X    | `resetDescendant` 가 replace 면 `OVERRIDE_NOT_FOUND` (`fields.ts:472`) · replacement 삭제는 그 자리 숨김 (`structure.ts:1052-1069`)                                                                                                     |
| replace 를 덮어 고아 만드는 경로        | X    | `setChildList` (`context.ts:308-328`) · `removeTargets` descendant (`structure.ts:1099-1108`) · `mergePatch` (`transaction.ts:252 · 278-281`) · `releaseLayout` (`project.ts:400-418`) — 모두 `UNOWNED_NODE` 로 거부 (조용한 손상 아님) |
| 패널 override 목록                      | X    | `CatalogComponentSection.tsx:117` 이 replace 를 건너뜀                                                                                                                                                                                  |

→ Phase 5 의 수리 행: replace 되돌리기 명령 · 덮어쓰기 경로 4 · 패널 목록 · detach 의 showWhen · replacement 에 instance 루트 props 전달. Phase 1 은 replace 에 닿지 않는다 (Layers drop 이 replacement 행을 옮기려 하면 `REPLACEMENT_NOT_MOVABLE` — 출발지 판정에서 뺀다).

**명령 층 검증 추가 여부 (§1 재확인)**: 유지 — 명령은 편집 맥락을 모른다. 원본 page 위에서 원본 S 에 직접 넣는 것은 정상 편집이라, 「template 노드 부모 거부」 를 그래프에 넣으면 원본 편집까지 막는다. 수리는 Builder 의 부모 · 출발지 결정 (record → EditTarget) 한 곳.

**oracle 표** (pen.dev · Figma 문서 — 본문 Context)

| 규칙                                         | 출처               | 지금 composition                                        | Phase 뒤               |
| -------------------------------------------- | ------------------ | ------------------------------------------------------- | ---------------------- |
| slot 에 drag · paste 로 채운다               | pen.dev Slots      | 팔레트 · slot 섹션만 · Canvas 4 경로는 원본에 씀 (①)    | Phase 1                |
| 채운 내용은 그 instance 의 것                | pen.dev Slots      | 팔레트 경로만                                           | Phase 1                |
| 원본 유래 레이어는 instance 안에서 못 옮긴다 | pen.dev Components | 화살표 · z-order 가 원본 자식을 빼 올 수 있음 (리뷰 h1) | Phase 1 출발지 판정    |
| slot 이 아닌 곳에는 넣지 않는다              | pen.dev Slots      | container 자리는 `ensureChildList` 로 받음              | Phase 1 (결정 2: 거부) |
| 교체 시 override 유지 (이름 기준)            | Figma Swap         | 교체 명령 없음                                          | Phase 2                |
| slot 추천 = 제한 아닌 안내                   | pen.dev Slots      | 없음                                                    | Phase 3                |
| 속성 text · boolean · instance swap · 기본값 | Figma properties   | 없음                                                    | Phase 4 · 5            |

사용자 결정 2 (2026-10-15 AskUserQuestion): **거부 — slot 에만** (pen.dev).

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
- 테스트 (Phase 5 완료 — `instanceProperty.test.ts`): B 원본 편집 → I 가 영향 목록에 · clipboard snapshot 에 B · 실제 정의 순환 (원본 안에서 자기 정의 선택) 은 `DEFINITION_CYCLE` — page instance 의 replacement 가 A 를 가리키는 것은 순환이 아니다 (Round 2 LOW) · 그려진 B 안 자리 선택 · 편집.
- preferred = Phase 3 picker 재사용.

## 7. Phase 6 — 종료 (G4 · G5)

- live 스크립트 `apps/builder/scripts/adr261-component-api-live.mjs` (ADR-260 live 스크립트 2개의 패턴).
- Compare Mode 로 속성 값 Canvas = Preview.
- 문서: 본문 Live Exercise · README · CHANGELOG · 메모리 `project-origin-instance-slot-reference-pen-figma`.

## 8. 기록

- 2026-10-15 Proposed — 코드 판독 (서브에이전트 2 · 핵심 인용은 실행자 재확인: `components.ts:124-140` · `types.ts:191-207 · 454-496 · 739-747` · `canvasGesture.ts:1245-1285` · `canvasMenu.ts:305-326` · `positions.ts:224-236` · `layerTree.ts:440-465` · `structure.ts:829-845` · `graph.ts:861-864`). Phase 0 의심 1건은 코드상 확정, live 재현은 Phase 0.
- 2026-10-15 Codex 설계 리뷰 Round 1 — HIGH 4 · MEDIUM 1. 실행자 코드 대조: `shortcuts.ts:426-444` (ids 도 `sourceId`) · `types.ts:801` + `graph.ts:936-941` (interaction 주소 검증) · `positions.ts:333-340` (자리 열거는 authored 정의). r1 수리 — 본문 Decision 1 · 2 · 3 · 4 · 사용자 결정 6 · Risks R8 · R9, 이 문서 §1 · §2 · §3 · §4 · §6. 수리 검증 (Round 2) 대기.
- 2026-10-15 Accepted (`/execute-adr 261`) · 사용자 결정 1 · 2 · 3 · 5 · 6 답 (권장안 전부).
- 2026-10-15 **Phase 0 완료** — 위 「Phase 0 결과」. 서브에이전트 2 (주소 필드 · `replace` 지원) 인용은 실행자가 `graph.ts:100-112 · 860-868` · `fields.ts:468-476` · `structure.ts:1052-1070` 로 재확인.
- 2026-10-15 **Phase 1 완료** — `apps/builder/src/builder/catalogRuntime/insertParent.ts` (`catalogInsertParent` · `catalogParentOfNode` · `catalogTemplateNodeAt` — slots.ts 의 템플릿 조회를 옮김, 팔레트 모듈을 끌지 않게 별도 파일) · `canvasGesture.ts` (host `itemOfRecord`, `CatalogDropTarget.parent: NodeParent`) · `canvasMenu.ts` · `shortcuts.ts` · `layerTree.ts` (`catalogLayerDropCommand(tree, graph, …)`).
  - 설계에서 바뀐 것: 메뉴 · 화살표의 부모는 부모 record 의 EditTarget 이 아니라 **노드가 문서에 놓인 자리** (`catalogParentOfNode` — `locate()` 와 같은 판정, throw 대신 `undefined`). 처음 구현 (부모 record `itemOfRecord`) 이 action bar 의 선택마다 메뉴 빌드에 조회를 더해 ratchet 등급 A 4 초과 (`readModel#read` 1710→1770 · `get root` 1797→1887 …) — 자리 판정으로 바꾼 뒤 초과 0.
  - 판독 1회 (reviewer, 임시 probe 실행): HIGH 1 — 비-slot 자리를 건너뛴 걷기가 instance 루트 record (`node` target) 에 닿아 `I.children` 에 넣음 · layout body 면 `releaseLayout` 이 덮어 고아 → `catalogInsertParent` 가 프로젝트 정의 instance 는 루트 slot (`descendant`) 만, 없으면 `undefined`. MEDIUM 1 — Layers 가 아직 채우지 않은 slot 의 형제를 owned 행만 세어 index 0 → slot 부모면 전체 행. 수리 검증: 원복 RED 2/2 · 테스트 +2.
  - LOW deferred 1: 팔레트 (`paletteInsert.ts` `parentOf`) 는 slot 이 아닌 template 자리에도 `ensureChildList` 로 넣는다 — 결정 2 는 drop · paste 질문이었고 팔레트는 「이미 맞는 경로」 로 범위 밖. 재현되는 손상 없음 (instance 쪽 `fillSlot`).
  - live (`adr261-drop-parent-live.mjs`, headed Chrome): ①-a ArrowDown · ①-b ⌘C ⌘V · ①-c Canvas drag 로 slot 채우기 · ② layout page ArrowDown — 원본 · layout template 바이트 동일, 콘솔 오류 0. G0 의 ①-c 무변경은 Components 패널이 Canvas 왼쪽 (노드 자리) 을 덮어 drag 가 시작되지 않은 측정 결함이었다 (스크립트가 패널을 닫도록 수정).
- 2026-10-15 **Phase 2 완료** — shared `commands/swap.ts` (`planSwapInstance` · `swapInstance`, index export) · 테스트 `swap.test.ts` 9 · `randomUndo.test.ts` 에 `swap` 행동. Builder `catalogRuntime/swapInstance.ts` (후보 · 요청 신호) · `panels/properties/catalog/CatalogSwapPicker.tsx` (+ .css — RAC DialogTrigger · Popover · Autocomplete · SearchField · ListBox 섹션) · `CatalogComponentSection.tsx` (이름 칩 = picker, 알림) · `canvasMenu.ts` 「swap-instance」 · `shortcuts.ts` (`openDesignPanel` + 요청) · `config/actionIcons.ts` `swapInstance: Replace` · i18n 7 키.
  - 설계에서 바뀐 것: (1) 이름 경로 키에 같은 키 형제 순번을 넣어 키가 늘 유일하다 — 「중복 이름」 은 순번으로 맞춘다 (Figma 도 레이어 순서로 잇는다). (2) 걷기는 교체 전 구조로 한다 — 처음 구현은 꺼낸 slot 내용이 instance 밖으로 나간 뒤 걸어 그 `showWhen` 이 옛 주소로 남았다 (unit 이 잡음). 밖으로 나가는 내용의 그 instance 조건은 결정 6 대로 지운다. (3) prop 은 옛 · 새 계약의 값 타입이 같고 값이 맞을 때만 남긴다 · 색 조합 오류면 조합 키를 버린다 · 다른 정의로 맞춘 `fillSlot` 의 쓰기 필드는 버린다 (판독 m1). (4) 교체 노드 자신은 그 자리 nesting 검사 (거부), 맞춘 slot 내용은 새 자리 nesting 이 안 맞으면 꺼낸다 · picker 후보도 같은 검사 (판독 h2).
  - 판독 1회 (reviewer, 기본 원본 81 × 81 교체 probe): HIGH 1 · MEDIUM 1 → 수리 검증 원복 RED 3 + probe 재실행 (적용 거부 107 → 0, 5112 통과, 1080 계획 단계 nesting 거부, ListBox → GridList 항목 3 밖으로). LOW deferred 3: holder 밖 instance 의 `showWhen` 주소 (패널은 `nodeId` 만 작성 — production 경로 0) · `ancestor.nodeId` 조건의 상태 키 소실 미집계 · 알림 수치는 계획 시점 graph (REVISION_CONFLICT 재계획 시 표시만 어긋남).
  - live (`adr261-swap-live.mjs`): 이름 칩 → 목록 (Card B 관련 맨 위 · 현재 제외 · 70) · 검색 · 교체 한 step (id 유지) · 제목 override 「Mine」 · slot 내용이 B 의 같은 자리로 · 알림 「kept 2 · dropped 0 · moved out 0」 · undo 한 번 복원 · Canvas 오른쪽 클릭 「Swap instance」 → Design 패널 목록. ratchet 등급 A 초과 0 · initial JS gzip 1,323,007 B (상한 1,421,000 — picker 는 Properties 지연 청크).
- 2026-10-15 **Phase 3 완료** — shared `document/types.ts` (`slot.suggested`) · `validation.ts` (`DEFINITION_ID_REQUIRED` · `DUPLICATE_SUGGESTION`) · `graph.ts` (`referencedIds` · 존재 검증) · `commands/structure.ts` (`removeWithReferrers` 정리 · `withTargetSuggestions` · `withSuggested`) · `commands/context.ts` (`CommandDraft.writtenEntries`). Builder `slots.ts` (`catalogSlotInsertOptions` 추천 먼저 · `catalogSlotSuggestionChoices`) · `CatalogSlotSection.tsx` (+ .css) · i18n 2 키. 테스트 `slotSuggestions.test.ts` 5 · `adr261Swap.test.ts` Phase 3 1.
  - 판독 1회 (reviewer probe): MEDIUM 1 — `removeWithReferrers` 는 committed 역색인만 봐서, dissolve 가 같은 draft 에서 만든 detach 사본 (원본 slot 의 `suggested` 를 그대로 복사 — `materialize.ts:353`) 을 놓쳐 `DANGLING_DEFINITION`. 수리: draft 가 쓴 노드도 걷는다 (`writtenEntries`). 수리 검증 원복 RED 1/1. LOW deferred 2 (본문 Status).
  - live (`adr261-swap-live.mjs` 4): 원본 slot 선택 → 「Add suggestion」 → Card B (원본 첫 편집이라 영향 확인 대화상자 — 계속) · `suggested` 저장 · instance slot 에 Card B 버튼 · 눌러 fillSlot +1 (Card B instance) · 원본 slot 무변경.
- 2026-10-15 **Phase 4 완료** — shared `document/componentProperties.ts` (계약 파생 · 쓰기 계산) · `types.ts` · `validation.ts` (`componentProperties`) · `graph.ts` (`referencedIds` 대상 · `validateComponentProperties`) · `library.ts` (`instanceContract`) · `resolution/resolver.ts` (`propertyScopes` · `withoutPropertyKeys`) · `fieldSource.ts` (`propertyLayer`) · `commands/properties.ts` (5 명령 · `pruneComponentPropertyTargets` · `pruneMovedPropertyTargets` · `clearComponentPropertyValues`) · `structure.ts` (`removeWithReferrers` · `moveNodes`) · `materialize.ts` (`createMaterializer` 값 굳히기) · `swap.ts` · `runtime/compositionRoot.ts` (`writesComponentProperty`). Builder `catalogRuntime/componentProperties.ts` · `editContract.ts` · `CatalogComponentPropertiesSection.tsx` · `CatalogTextEditor.tsx` · i18n 11 키.
  - 설계에서 바뀐 것: (1) 대상이 `NodeId` 가 아니라 `{id, prop?}` — text 속성은 그 레이어의 어느 글자 prop 을 바꾸는지 적어야 한다 (패널은 인라인 편집과 같은 `catalogTextKey`). (2) 값 쓰기 위치는 resolver 의 composite 자리 투영마다 instance 경로를 키로 둔 표 — 행 반복 · inner owner fill · replace 가 같은 키를 읽는다. (3) Canvas 증분 갱신의 값 전용 경로가 instance 자신의 record 만 다시 풀어 driven 레이어가 갱신되지 않았다 (builder unit 이 잡음) → 속성 키 쓰기는 루트 재평탄화. (4) 첫 구조 편집 (`ensureChildList`) 사본도 값을 굳힌다 — pen.dev 「넣은 내용은 instance 의 것」, 닿을 레이어가 없는 속성 필드는 숨긴다 (판독 m3). (5) 중첩 instance 의 속성 키는 대상이 아니다 (범위 밖 「expose nested instances」 · 판독 m2).
  - 판독 1회 (reviewer, probe 5): MEDIUM 3 → 수리 · 원복 RED 3/3. LOW deferred 1 (본문 Status).
  - live (`adr261-properties-live.mjs`, headed Chrome · Compare Mode) 14/14. ratchet: 작업 트리 측정 `--judge` 등급 A 초과 0 · B 경고 7 (비차단).
- 2026-10-15 **Phase 5 완료** — shared `commands/instanceProperty.ts` (`setInstanceProperty` · `planInstanceProperty` · `resetReplacement` · `instancePropertyValue` · `instancePropertyPositions` · `originTemplatePath`) · `commands/swap.ts` (`replacementPlace` — 교체 노드의 nesting 부모 · moveOut 앵커) · `commands/compose.ts` (`stageOver`) · `commands/properties.ts` (`setComponentPropertyPreferred`) · `commands/structure.ts` (`removeWithReferrers` — 사라진 자리의 교체 노드 · preferred 정리) · `document/{types,validation,graph,componentProperties}.ts` · `resolution/resolver.ts` (replace 분기 표시 속성). Builder `catalogRuntime/componentProperties.ts` (`catalogInstancePropertyScope` · `Rows` · `Candidates` · `Plan` · `catalogIsComponentInstance`) · `editContract.ts` (instance 종류는 필드 아님 · 교체 자리 아래는 닿지 않음) · `swapInstance.ts` (`preferred` 그룹) · `CatalogInstancePropertiesSection.tsx` · `CatalogComponentPropertiesSection.tsx` (instance 만들기 · 추천 목록) · `CatalogComponentSection.tsx` (교체 행) · `CatalogSwapPicker.tsx` (`CatalogComponentPicker` 로 분리) · i18n 8 키. 테스트 `instanceProperty.test.ts` 18 · `randomUndo.test.ts` `instanceValue` · builder `adr261InstanceProperty.test.ts` 2. live `apps/builder/scripts/adr261-instance-property-live.mjs`.
  - 설계에서 바뀐 것: (1) 값을 처음 고를 때 「새 instance 노드」 를 빈 상태로 만들지 않고 그 자리를 소유 노드로 **복사** 한 뒤 (`createMaterializer` — 첫 구조 편집 · detach 와 같은 길) Phase 2 교체로 맞춘다 — instance 의 그 자리 쓰기 · 안쪽 override · slot 내용 · 주소 보유자가 교체 규칙 하나로 옮겨진다. 기본값은 역방향 (다시 교체 + 되접기 — 노드가 원본과 다른 필드만 patch 로). 복사로 소유가 된 원본 쪽 slot 내용은 되접은 뒤에도 instance 의 것으로 남는다 (놓은 instance 의 slot 내용 = instance 의 것, 2026-10-14). (2) 여러 planner 를 한 step 에 — `stageOver` (읽기 객체 위 stage). (3) 같은 레이어에 text 속성은 금지 (바뀐 자리는 새 노드라 text 가 닿지 않음 — Figma 도 text 속성은 글자 레이어 전용), 표시 속성은 바뀐 자리에도 적용. (4) 속성을 지워도 instance 의 교체는 보통 `replace` 로 남는다 (Figma — 값이 override 로 남음). (5) 원본 안 instance 의 값 위에 바깥 instance 가 다른 값을 고르는 경우는 거부 (`PROPERTY_VALUE_INHERITED`).
  - 판독 1회 (reviewer, probe 4): HIGH 1 (표시 속성 값이 복사 노드 `enabled` 에 굳어 되접기 뒤 patch 잔존 · 직접 쓰기보다 앞섬) · MEDIUM 2 (바깥 instance 가 원본 안 instance 의 자기 쓰기를 잃음 · 경로 중간 slot 내용 주소 `TEMPLATE_STEP_NOT_OWNED`) → 수리 검증 원복 RED 5/5. LOW deferred 3 (본문 Status).
  - ratchet (작업 트리 측정 `--judge`): 등급 A 초과 0 · B 경고 6 (비차단). initial JS gzip 1,332,540 B (상한 1,421,000).
  - 사용자 지시 「직접 테스트」 (push 뒤, Chrome MCP · 사용자 Chrome): 원본 Icon 레이어 → 「Instance swap property」 → 추천 Heart → instance picker (Preferred Heart 맨 위 · Star 제외) → Heart · 알림 · Overrides 「Icon → Heart」 · Compare Mode Canvas = Preview DOM (`★ ♥ Title ★ Title ♥`) · 되돌리기. 발견 1: 원본 레이어 버튼 셋이 233px 패널에서 잘림 → `.component-semantics-strip` 줄바꿈. Chrome MCP 탭은 `visibilityState: hidden` 이라 rAF 가 멈춰 Canvas 픽셀 · Preview 전달이 멈춤 (무관한 편집도 미반영 — 메모리 hidden 탭 함정) → undo · redo 의 Preview DOM 은 headed Playwright 로 확인 (live 스크립트 6 · 6b · 6c 추가, 16/16).
- 2026-10-15 **Codex 착수 완료 검토** (사용자 요청 — 구현 `21705cd91..79b881192`): HIGH 0 · MEDIUM 4, 4건 모두 실행 재현 → 수리. (M1) 교체한 레이어를 detach 하면 표시 속성의 숨김이 사라짐 — materializer replace 분기가 값을 굳히지 않음 → 직접 → 속성 → 원본 순으로 교체 노드 `enabled` 에 굳힘 (`materialize.ts`). (M2) 한 교체 속성이 부모 · slot 자식 둘을 대상으로 하면 자식이 안 바뀌고 되돌려도 남음 (Phase 5 LOW 가설이 실제로 재현) → 교체 대상이 다른 교체 대상 안에 있으면 그래프가 거부 (`PROPERTY_TARGET_NESTED`) · Builder 도 제안하지 않음. (M3) 교체 값이 있는 원본 레이어를 원본 밖으로 옮기면 `TEMPLATE_STEP_NOT_OWNED` 로 거부 → 원본 밖으로 나간 자리를 지나는 다른 instance 의 override 와 그것이 소유한 교체 노드 · slot 내용을 같은 step 에 정리 (`structure.ts` `dropAddressesLeftOrigin` — Figma: 메인에서 빠진 레이어의 instance 변경은 사라짐). (M4) Swap 이름 경로를 구분자 그대로 이어 붙여 `"Group#0/Title"` 이름이 다른 경로와 같은 키 → override 가 엉뚱한 레이어에 붙음 → 키 = `[이름, 순번]` 단계 배열의 JSON (`swap.ts`). 수리 검증 원복 RED 4/4 · shared 1693 · builder 5789 (기존 제외 1) · type-check · live 16/16.
- 2026-10-15 Codex 수리 검증 Round 2 — h1 · h3 · h4 · m1 닫힘 (실행 확인), h2 남음 (`showWhen` 상태 소유자 주소 — `types.ts:698-726` 실행자 확인). r2 — Decision 2 대상을 주소 필드 전수로 · `showWhen` 추가. LOW deferred 1 (Phase 5 순환 문구 — 정정). 판독 상한 도달 — 확인은 Phase 2 G2.
