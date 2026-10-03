# ADR-250: Preview 의 펼침 조작 — 문서 역기록 대신 Preview 실행 상태로

## Status

Accepted — 2026-10-03 (사용자 「B 로 진행해」)

사용자 요청: ADR-248 Phase 4e 후속 점검에서 나온 「Preview 의 Disclosure · Tree 펼침을 문서로 역기록」 항목을 ADR-248 과 분리해 다룬다 (사용자 「별도로 열어」 2026-10-03 — 분리 confirm). 핵심 질문 — **Preview 에서 사용자가 펼치고 접은 상태를 문서에 쓸 것인가** — 은 같은 날 사용자가 대안 B (쓰지 않는다) 로 판정했다.

> **2026-10-03 Phase 0 · 1 구현 (G0 · G1 · G2 PASS)**: Preview 의 Tree · Disclosure · DisclosureGroup 펼침이 Preview 실행 값이 되고 (문서 쓰기 0), Builder 가 선언값을 바꾸면 Preview 가 따른다. 실행 중 찾은 것 2 — DisclosureGroup 안 Disclosure 는 Builder 의 선언 변경을 아예 따르지 않았다 (그룹이 자식 변경에 다시 그려지지 않음) · 규칙의 Tree `expand` 는 항목 key 를 문자열로 넘겨 Tree 가 무시했다. 둘 다 같은 범위로 고쳤다. 남은 것: G3 사용자 확인 (Compare Mode). 기록: [breakdown §6](design/250-preview-expansion-runtime-state-breakdown.md).

## Context

### 무엇이 달라졌나

구 앱은 Preview 에서 Disclosure 머리글을 눌러 접거나 Tree 항목을 펼치면 그 값을 Builder 문서에 다시 썼다 (2026-07-14). Preview 가 `ELEMENT_PROPS_CHANGED` 를 보내고 Builder 가 `updateElementProps` 로 반영해 undo 기록과 저장까지 했다. 대상은 allowlist 2개 — Disclosure `isExpanded` · Tree `expandedKeys` (ADR-239) 였다 (`988e5177a^:apps/builder/src/preview/messaging/builderPropSync.ts`). 이유는 Compare Mode 에서 Preview 만 접히고 Canvas 는 펼친 채 남는 발산이었다. 같은 구 앱에서도 **인터랙션 규칙 실행** (`Disclosure.expand` capability) 은 문서가 아니라 실행 override 층에 쌓았다 — 「실행은 런타임 동작이지 문서 편집이 아니다」 (`988e5177a^:apps/builder/src/preview/App.tsx:825-831`).

ADR-248 의 새 Preview 는 Builder 문서의 **읽기 전용 복제본**이다. Preview → Builder 메시지는 `PREVIEW_READY` · snapshot 요청 · `CATALOG_SELECT` (선택만, 문서 변경 0) 셋뿐이다 ([CatalogPreviewFrame.tsx:89-104](../../apps/builder/src/builder/workspace/canvas/catalog/CatalogPreviewFrame.tsx)). 그래서 역기록이 빠졌고, 실측한 현재 동작은 다음과 같다.

| 대상                    | 새 Preview 의 현재 동작                                                                                                                                                                                                                                                                                 | 코드                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disclosure (단독)       | RAC 비제어 (`defaultExpanded` = 문서 값, key 에 값 포함 → 문서가 바뀌면 다시 마운트). 클릭하면 Preview 안에서만 접힌다. Canvas 는 문서 값 그대로                                                                                                                                                        | [delegatedDom.tsx:1330-1341](../../apps/builder/src/builder/catalogRuntime/delegatedDom.tsx)                                                                                                                     |
| Disclosure (Group 안)   | DisclosureGroup 이 `defaultExpandedKeys` 로 비제어. 클릭은 Preview 안에서만                                                                                                                                                                                                                             | delegatedDom.tsx:1376-1382                                                                                                                                                                                       |
| Tree                    | RAC **제어** (`expandedKeys` = 문서 값, `onExpandedChange` 없음) — chevron 을 눌러도 **아무것도 바뀌지 않는다**. 접힌 항목의 자식 TreeItem 은 DOM 에 아예 넘기지 않는다 (`ownsDescendant` 가 문서 `expandedKeys` 로 판정)                                                                               | [delegatedDom.tsx:502-531](../../apps/builder/src/builder/catalogRuntime/delegatedDom.tsx) · [presence.ts:256-264](../../apps/builder/src/builder/catalogRuntime/presence.ts) `catalogTreeItemExpanded`          |
| 규칙 실행 (`expand` 등) | 문서가 아니라 Preview 실행 override (`propOverrides`, "runtime only — the document and the Builder never see it")                                                                                                                                                                                       | [catalogPreviewInteractions.ts:150-191](../../apps/builder/src/preview/catalog/catalogPreviewInteractions.ts) · [domBinding.tsx:1077](../../apps/builder/src/builder/catalogRuntime/domBinding.tsx) `overrideOf` |
| Canvas                  | 문서의 선언값만 읽는다 — Disclosure 패널 표시 ([presence.ts:46](../../apps/builder/src/builder/catalogRuntime/presence.ts) `catalogDisclosureExpanded`) · Tree 자식 행 ([presence.ts:256](../../apps/builder/src/builder/catalogRuntime/presence.ts)). Properties 「Expanded」 토글이 같은 prop 을 쓴다 | [Disclosure.binding.ts](../../packages/shared/src/catalog/bindings/Disclosure.binding.ts) `isExpanded` (section state)                                                                                           |

즉 **Disclosure 는 구 앱의 07-14 발산이 다시 생긴 상태**이고, **Tree 는 Preview 에서 펼침 자체가 동작하지 않는 상태** (구 앱보다 후퇴) 다.

### 이 질문에 걸린 사용자 원칙

2026-07-20 사용자 판정 (ADR-150 A1 철회): 「skia 화면에서 hovered/pressed/focused 가 직접 동작하는 개념이 아니다. css preview 에서 동작. skia 는 정의하는 빌더」. Canvas 는 노드가 **선언한** 상태를 보여 주는 정의 surface 이고, 컴포넌트의 런타임 상호작용은 Preview (D1) 소관이다. 이 판정은 07-14 역기록보다 나중이다.

### Domain (SSOT 3-domain)

- **D1 DOM/접근성**: RAC Disclosure · Tree 의 펼침 동작 · 키보드 · `aria-expanded` — 설치된 `react-aria-components` 가 권위. 이 ADR 은 RAC 동작을 바꾸지 않는다.
- **D2 Props/API**: `isExpanded` · `expandedKeys` · `defaultExpandedKeys` — 노드가 선언하는 초기 · 표시 상태 (Properties 편집 surface).
- **D3**: 직접 대상 아님. Canvas 의 시각은 D2 선언값을 따른다.

질문의 본체는 **D1 런타임 상태가 D2 선언값을 덮어쓸 것인가** — 경계 교차 여부다.

### 제약

- **hard**: Builder 문서의 쓰기는 `workspace.execute` 하나로만 (Memory → Index → History → DB → Preview 순서, CLAUDE.md §상태 변경 파이프라인) · `apps/publish` 수정 0 (ADR-248 범위 원칙) · 저장 스키마 변경 0 (`isExpanded` · `expandedKeys` 는 이미 문서 필드) · Preview 부팅 JS 에 새 의존 0 (ADR-201 initial 상한).
- **hard (BC)**: 스키마 변경이 없으므로 기존 프로젝트 재직렬화 0 파일 · 영향 사용자 0%. 대안 A 만 클릭마다 문서 1 step (history 1 + IndexedDB part 1 write) 을 만든다.
- **soft**: Compare Mode / Preview iframe 은 모델이 열지 않는다 — Preview 검증은 unit + 사용자 확인 (작업 규율).

## Alternatives Considered

외부 사례: Figma 프로토타입 · Webflow Interactions 미리보기 · Framer 미리보기는 미리보기 안의 조작이 디자인 파일을 바꾸지 않는다 (미리보기 상태는 세션 한정). Plasmic 은 캔버스 안에 「interactive mode」 를 두어 저작 화면에서 컴포넌트를 조작하게 하지만 그 상태를 저장하지 않는다. 구 composition 은 Preview 조작을 문서에 쓴 드문 예였다.

### 대안 A: 구 앱 역기록 복원 (Preview → 문서 쓰기)

- 설명: Preview 가 사용자 클릭으로 바뀐 `isExpanded` / `expandedKeys` 를 새 메시지 (`CATALOG_PROPS`, allowlist 2) 로 보내고, Builder 가 record → `workspace.itemOfRecord(identity).target` ([workspace.ts:539](../../apps/builder/src/builder/catalogRuntime/workspace.ts)) → `setFields` 로 실행한다 (인스턴스 안이면 descendant override 로). 규칙 실행은 지금처럼 Preview override 에 둔다.
- 위험: 기술(LOW — `CATALOG_SELECT` 와 같은 수신 경로 · `itemOfRecord` · `setFields` 가 이미 있음) / 성능(MEDIUM — 클릭마다 history 1 + 저장 1 + Preview 로 delta 왕복, 연속 클릭이 undo 기록을 채움) / 유지보수(**HIGH** — Preview 가 두 번째 문서 작성자가 된다. ADR-248 「Builder 만 쓴다」 경계와 07-20 원칙에 어긋나고, 이후 Preview 상호작용마다 「이것도 올릴까」 allowlist 판단이 생긴다. 구 앱 allowlist 가 그 흔적) / 마이그레이션(LOW)

### 대안 B: Preview 실행 상태로 둔다 — Canvas 는 선언값 (권고)

- 설명: Preview 안의 펼침 조작은 Preview 세션 한정 상태다. 문서 쓰기 0, Builder 메시지 0. Disclosure 는 지금처럼 RAC 비제어로 두고 (문서 값이 바뀌면 key 로 다시 마운트 = 선언값으로 복귀), **Tree 는 Preview 에서 실제로 펼치고 접히게** 고친다 (문서 `expandedKeys` 를 초기값으로, 이후 상태는 Preview 가 소유). 규칙 실행 override 와 사용자 클릭이 같은 Preview 상태를 읽도록 맞춘다. Compare Mode 에서 Preview 를 조작하면 Canvas 와 달라지는 것은 「Preview = 런타임」 의 정상 동작으로 본다. 문서에 반영하고 싶으면 Properties 「Expanded」 로 선언한다.
- 위험: 기술(LOW — Preview override 층 · RAC 비제어 경로가 이미 있음. Tree 는 `ownsDescendant` 판정이 Preview 상태를 읽도록 바꾸는 범위) / 성능(LOW — Builder 왕복 0) / 유지보수(LOW — 쓰기 경계 유지, Publish 런타임과 같은 의미) / 마이그레이션(LOW). 제품 위험 MEDIUM — 07-14 에 사용자가 겪은 Compare Mode 발산이 Disclosure 에서 그대로 남는다.

### 대안 C: Builder 세션 한정 표시 상태 (저장 안 함)

- 설명: Preview 조작을 Builder 로 보내되 문서가 아니라 Builder 세션의 transient override 에 담고, Canvas 가 그것을 읽어 같이 접는다 (history · 저장 0).
- 위험: 기술(**HIGH** — Canvas root 에 새 입력 채널 (record 별 prop override) 이 필요하고 presence · layout · Skia 소비 경로 3곳 (`catalogDisclosureExpanded` · `catalogTreeItemExpanded` · 2-pass 재배치) 이 함께 바뀐다) / 성능(MEDIUM — Preview 클릭마다 Canvas 재배치) / 유지보수(**HIGH** — Canvas 가 Properties 의 선언값과 다른 값을 보여 준다. 07-20 원칙의 「Canvas 가 런타임을 재현」 에 해당) / 마이그레이션(LOW)

### Risk Threshold Check

| 대안 | HIGH+                     | 판정               |
| ---- | ------------------------- | ------------------ |
| A    | 유지보수 HIGH 1           | 회피 대안 존재 (B) |
| B    | 없음                      | 통과               |
| C    | 기술 HIGH · 유지보수 HIGH | 회피 대안 존재 (B) |

모든 대안이 HIGH 인 상황이 아니므로 추가 루프 없음.

## Decision

**대안 B 를 채택한다** (2026-10-03 사용자 판정 「B 로 진행해」).

위험 수용 근거: B 의 잔존 위험은 Compare Mode 에서 Preview 를 조작하면 Canvas 와 달라지는 제품 위험 (MEDIUM) 하나다. 이것은 2026-07-20 사용자 원칙 (Canvas = 정의 surface, 상호작용 = Preview) 이 의도한 결과이고, 문서에 남기려면 Properties 「Expanded」 라는 선언 경로가 이미 있다. Publish 도 같은 런타임 의미 (조작이 문서를 바꾸지 않음) 라 Preview 와 Publish 의 동작이 같아진다. 반대로 Tree 가 Preview 에서 펼쳐지지 않는 현재 후퇴는 B 에서 해소된다.

기각 사유:

- **A**: Compare Mode 발산은 없앨 수 있지만, Preview 를 문서 작성자로 만들어 ADR-248 쓰기 경계와 07-20 원칙을 함께 깬다. 클릭이 undo 기록 · 저장을 만드는 것도 구 앱에서 「실행은 문서 편집이 아니다」 로 규칙 실행을 따로 뺐던 판단과 어긋난다. 사용자가 「Compare Mode 에서 Preview 조작이 Canvas 에 남아야 한다」 를 우선한다면 A 가 맞다 — 이것이 사용자 판정 질문이다.
- **C**: 문서는 지키지만 Canvas 가 런타임 상태를 재현하게 되어 07-20 원칙에 정면으로 어긋나고, Canvas 입력 채널 신설 비용이 가장 크다.

> 구현 상세: [250-preview-expansion-runtime-state-breakdown.md](design/250-preview-expansion-runtime-state-breakdown.md)

## Risks

| ID  | 위험                                                                                                   | 심각도 | 대응                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------ | :----: | --------------------------------------------------------------------------------------------------------------------------- |
| R1  | Compare Mode 에서 Preview 조작 뒤 Canvas 와 펼침이 다름 (07-14 발산의 재현)                            |  MED   | 의도된 동작으로 문서화 (CHANGELOG · 이 ADR). 사용자 확인 G3 에서 받아들일 수 없다고 판정되면 A 로 재판정                    |
| R2  | Preview 상태가 문서 변경을 가림 — Properties 에서 Expanded 를 바꿨는데 Preview 가 사용자 조작값을 유지 |  MED   | 문서의 해당 값이 바뀌면 Preview 상태를 선언값으로 되돌린다 (Disclosure 의 key 재마운트 규칙을 Tree 에도). G2 로 확인        |
| R3  | Tree 의 `ownsDescendant` (접힌 자식 미전달) 를 바꾸면 Canvas 와 DOM 의 자식 판정이 갈림                |  MED   | Canvas 판정 (`catalogTreeItemExpanded`) 은 문서 선언값 그대로 두고 DOM leg 만 Preview 상태를 읽는다. ADR-248 parity 12 유지 |
| R4  | 규칙 실행 (`expand` capability) 과 사용자 클릭이 서로 다른 상태를 보아 엇갈림                          |  LOW   | 둘 다 Preview 상태 한 곳을 읽고 쓴다 (G1)                                                                                   |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점      | 통과 조건                                                                                                              | 실패 시 대안                            |
| ---- | --------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| G0   | 착수 전   | 현재 동작 고정: Preview Tree chevron 이 상태를 바꾸지 못함 · Disclosure 클릭이 문서를 바꾸지 않음을 unit 으로 RED 기록 | 실측이 다르면 Context 표 정정 후 재판정 |
| G1   | Phase 1   | Preview 에서 Tree 펼침 · 접힘이 동작하고 자식 항목이 나타남 · 규칙 실행과 클릭이 같은 상태를 읽음 (unit, 원복 RED)     | 범위 축소: Tree 만 먼저                 |
| G2   | Phase 1   | 문서 쓰기 0 (Preview 조작 전후 graph 변경 0 · Builder 메시지 0) · 문서 값이 바뀌면 Preview 가 선언값으로 복귀 (R2)     | 복귀 규칙을 record 단위로 좁힘          |
| G3   | 완료 직전 | 사용자 확인 — Compare Mode 에서 Disclosure · Tree 조작 (모델은 Preview 를 열지 않음). R1 을 받아들일 수 있는지 판정    | A 로 재판정 (역기록)                    |

### Live Exercise

(Implemented 승격 시 기재 — Preview 는 사용자 확인 G3 이 live exercise 다.)

## Consequences

### Positive

- Preview 에서 Tree 펼침이 다시 동작한다 (현재 후퇴 해소).
- 문서 작성자는 Builder 하나로 유지된다 — Preview · Publish 의 런타임 의미가 같다.
- 클릭이 undo 기록 · 저장을 만들지 않는다.

### Negative

- Compare Mode 에서 Preview 조작이 Canvas 에 남지 않는다 (구 앱 07-14 동작과 다름). 문서에 남기려면 Properties 「Expanded」 를 쓴다.
- 영향 파일: `apps/builder/src/builder/catalogRuntime/delegatedDom.tsx` (Tree DOM leg) · `apps/builder/src/preview/catalog/catalogPreviewInteractions.ts` (Preview 상태 공유) — Canvas (`presence.ts`) 와 Builder 메시지 경로는 변경 0.
