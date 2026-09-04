# ADR-923 Phase 5 후속 — 3.6 fit-content 재측정의 텍스트 출처 (가설 1 + 반증 1)

> 2026-09-04. 착수 5. [subpart-extension](923-phase5-followup-subpart-extension.md) §잔여에 "3.6 재측정이 raw `children` 텍스트를 읽는 것 자체 (비-sub-part Label 에도 해당)" 로 남겨둔 항목. `.claude/rules/review-loop-closure.md` §2 절차 — 커버리지 지적에 "채우기" 가 아니라 **가설 1개 + 반증 케이스 1개**로 답한다.

## 1. 가설

`fullTreeLayout` 3.6 (implicit child style → batch 패치) 의 fit-content 폭 재측정은 자식 `props.children` 으로 폭을 다시 잰다. 자식 텍스트를 parent 가 정하는 컴포넌트에서 자식 store 값이 낡아 있으면 (Inspector 가 아닌 writer 가 parent prop 만 바꾸고 읽기 시점 propagation 이 표시 텍스트를 갈아끼운 상태) **Canvas 상자만 낡은 텍스트 폭**이 된다.

근거가 되는 코드 사실 2개:

| 사실                                                                                                                                           | 경로                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 자식 자신의 visit 은 read-time propagation 을 적용한 뒤 폭을 잰다 (표시 텍스트 기준)                                                           | `fullTreeLayout.ts:1466` `resolvePropagatedProps`           |
| 3.6 의 입력 자식은 부모 단계 `applyImplicitStyles` 가 **elementsMap 원본**에서 받은 것이라 propagation 이 안 실려 있다 (sub-part 만 투영 사본) | `fullTreeLayout.ts:1750` `rawChildren` · 2.6 절 재측정 블록 |

선례: Meter Label 이 실제로 그랬다 — raw `"Storage"` 54 vs 표시 `"Name"` 40 (= DOM 39), 2026-09-03. 그 축은 read-only sub-part 판정으로 닫혔다 (투영 style 에 width 키워드가 없어 재측정 자체가 안 걸린다).

## 2. 반증 케이스 — 전수 대조 게이트

`__tests__/adr923FitContentRemeasureTextSource.test.ts` (신규 3 케이스). 판정 3개를 production 모듈 `fitContentRemeasure.ts` 로 뽑아 **게이트가 복사본이 아니라 실제 판정**을 부른다.

- **축 A (registry `children` 전파)** — `parentProp → 자식 children` 규칙을 가진 (parent, child) 쌍 전부 (직계 childPath 만 — 중첩 경로는 Inspector 쓰기에서만 해석돼 store 가 늘 최신). 자식에 낡은 텍스트 + `width: fit-content` 를 얹고 implicit 을 돌린 뒤 판정을 부른다. 재측정이 걸리면 그때 읽히는 텍스트가 parent 가 정한 표시 텍스트여야 한다.
- **축 B (파생 값 leaf, 양성 대조)** — Meter/ProgressBar 값 leaf 와 SliderOutput 은 재측정이 **실제로 걸리는** 자리다 (implicit 이 fontSize 주입 + factory `width: fit-content`). 여기서 implicit 이 `children` 을 파생 텍스트로 덮으므로 옳은 텍스트를 읽는다 — 그 덮기가 사라지면 축 B 가 RED (게이트가 공허하지 않다는 증거).
- **배선** — 3.6 이 부모 `rawElement` 로 술어를 부르고 그 결과를 폭 계산 입력 (`childForWidth`) 에 싣는지 원문 대조 (`fullTreeLayout.static` 선례 동형). 판정 함수 단위 PASS 는 그 사이 매핑의 증거가 아니다.

**축 A 첫 실행 = RED 4건**:

```
GridListItem > Text (재측정 텍스트 "Storage")
GridListItem > Description (재측정 텍스트 "Storage")
ListBoxItem > Text (재측정 텍스트 "Storage")
ListBoxItem > Description (재측정 텍스트 "Storage")
```

Label 축은 전부 통과한다 (sub-part 이거나 implicit 이 fontSize 를 안 넣어 재측정이 안 걸린다) — 남아 있던 것은 collection item 의 Text/Description 이었다.

## 3. 수리

`resolveRemeasureChildProps(parent, child)` — 자식 visit 과 **같은 registry 를 같은 방향으로** 한 번 더 읽어 텍스트만 얹는다. 3.6 은 그 결과를 `childText` 와 `childForWidth` 양쪽에 쓴다. `resolvePropagatedProps` 는 parent 값이 undefined 면 건너뛰므로 낡은 텍스트를 undefined 로 덮지 않는다.

같이 뽑은 것 (동작 무변경, 판정 공유용): `resolveSubpartAwareImplicitStyles` (3.6 의 sub-part delta) · `isFitContentRemeasureWidth` · `resolveFitContentRemeasureText`.

## 4. 원복 RED

| 원복                                                                  | 결과                                                                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| (a) `resolveRemeasureChildProps` 가 propagation 을 안 얹음            | 축 A **4 FAIL** (위 목록 그대로)                                                                             |
| (b) implicit 의 `children: showValueLabel ? formattedValue : ""` 제거 | 축 B **FAIL** (`Meter > MeterValue` 재측정 텍스트 75% ≠ 3%)                                                  |
| (c) sub-part delta/투영 기준 제거 (full style 로)                     | **3 PASS** — 수리 (3) 이 sub-part 여부와 무관하게 텍스트를 맞추므로 축 A 는 이 원복에 반응하지 않는다 (기록) |

## 5. Live 실측 — **사용자-가시 결과는 바뀌지 않았다**

surface: 빌더 Components 페이지의 `component-listbox-item-default` (실 store ListBoxItem origin, 자식 Text 2 — `{label}` / `{description}`). 임시 probe 를 3.6 재측정 블록에 넣어 실제 호출을 확인했다.

| 상태     | 3.6 이 읽은 텍스트 | 3.6 이 batch 에 쓴 width | Canvas rect (label / item) |
| -------- | ------------------ | ------------------------ | -------------------------- |
| 원복 (a) | `{label}`          | 48                       | 44 / 68                    |
| 수리     | `Name`             | 38                       | 44 / 68                    |

- 캔버스가 그리는 텍스트는 양쪽 다 `Name` (parent `label` propagation) — **원복 상태의 3.6 은 그리지 않는 텍스트로 폭을 쟀다**. 가설의 전반부는 live 에서 확증.
- 그러나 3.6 이 쓴 폭 (38 · 48) 은 **최종 rect 에 도달하지 않는다** — 두 상태의 rect 가 같다 (label 44 · item 68, item 은 `width: fit-content` 로 라벨이 폭을 정하는 배치로 만든 것). 즉 이 경로에서 3.6 의 폭 write 는 뒤 단계에 덮인다.
- 그래서 이 수리는 **잘못된 중간 입력을 없앤 정합 수리**이고 사용자-가시 동작 변경은 0 이다. 그 이상으로 주장하지 않는다.

곁가지 관찰 (범위 밖): ListBoxItem 의 `label → Text.children` 규칙은 자식 **type** 으로만 매칭해 label/description 두 Text 자식이 **둘 다** parent `label` 을 받는다 (live: 두 줄 모두 `Name`). slot 구분이 규칙 축에 없다.

## 6. 잔여 (LOW deferred)

- 3.6 의 fit-content 폭 write 가 최종 rect 에 도달하지 않는 경로 — 위 실측이 드러낸 것. 재측정 자체가 dead 인지, 특정 컨테이너에서만 덮이는지는 별도 인벤토리. production 재현 시나리오가 아직 없어 라운드 재개 사유 아님.
- `label → Text.children` 의 slot 미구분 (위 §5 곁가지).

## 7. 검증

- 신규 게이트 3 PASS · builder unit 5221 PASS (기존 실패 4건은 본 변경과 무관 — `canvasStore.static` · `styleReadCanonical.static` · `adr113DescendantsGrepGate` · `g5LegacyFieldGrepGate`, HEAD 에서 동일 재현 확인)
- browser parity 1086 PASS (기존 2 실패: `catalogComponentBox` GridListItem · Tooltip)
- `pnpm type-check` PASS

## 8. 재확인 (2026-09-04, 사용자 요청 — "production 재현 없음" 판정을 다시 잰다)

§6 의 LOW deferred 두 건을 각각 **가설 1 + 반증 1** 로 다시 쟀다. 둘 다 "재현 없음" 이 유지되고, 성격은 결함이 아니라 **dead 경로**로 좁혀진다.

### 8-1. 3.6 의 fit-content 폭 write — 게이트·live 어디에서도 최종 rect 에 닿지 않는다 (dead)

- 반증: `fullTreeLayout.ts` 3.6 의 `batch[batchIdx].style.width = \`${correctedWidth}px\`` 를 **`1px` 로 강제**하고 전량을 돌렸다 (변이 대조).
  - browser parity **1110 PASS** (기존 실패 2 만 — GridListItem·Tooltip) · layout engines unit **482 PASS**. 팔레트 production 트리 · DC-6 · field/sub-part 게이트 어느 것도 반응하지 않았다.
  - live (빌더 재로드, 서빙 모듈에 변이 확인): 재측정이 **실제로 걸리는** 축 B 자리 ProgressBarValue (`width: fit-content`) laid 30 · Label 38/35/58 — 1px 인 노드는 Separator (설계값 1) 와 빈 FieldError (0) 뿐.
- 판정: 이 write 는 뒤 단계 (자식 visit 의 스칼라 + 엔진 fit-content 해소 — ADR-170 · ADR-165) 에 항상 덮인다. production 재현 없음 유지. 성격은 "특정 컨테이너에서만 덮이는 결함" 이 아니라 **전 경로 dead** — 정리 대상 (삭제는 동작 변경 0 커밋 절차, `review-loop-closure.md` §3). 변이는 `git checkout` 으로 원복, diff 0.

### 8-2. `label → Text.children` 의 slot 미구분 — 규칙 자체가 production 에서 실행되지 않는다 (dead rule)

- 사실: ListBoxItem · GridListItem 의 D2 binding 은 `children` (라벨 "Label") · `description` · `icon` · `size` 만 노출하고 **`label` prop 이 없다** (`ListBoxItem.binding.ts:43` · `GridListItem.binding.ts:42`). live 의 origin (`component-listbox-item-default`) props 도 `children: "{label}"` · `description: "{description}"` 뿐. Canvas 투영 (`collectionVirtualization.ts:302` 의 `label:` 은 slot 폰트 맵) 도 parent `label` 을 쓰지 않는다.
- 따라서 registry 규칙 `label → Text.children` 은 parentProp 이 없어 **read-time · write-time 모두 skip** 되고 (`resolvePropagatedProps` 는 undefined 를 건너뛴다), `description → Description.children` 은 origin 의 자식이 `Text[slot=description]` 이라 type 이 맞지 않아 역시 대상이 없다. §5 의 "두 줄 모두 Name" 은 probe 가 parent 에 `label` 을 넣어 만든 상태였다.
- panel 편집은 `listBoxItemSlotChildActions.ts` 가 slot 자식을 **직접** 쓴다 (`{ slot: role, children }`) — registry 를 거치지 않는다.
- 판정: production 재현 없음 유지. 성격은 slot 미구분 결함이 아니라 **도달 불가 규칙** — 정리 대상 (규칙 삭제 또는 `children → Text[slot=label]` 로 재키잉은 필요가 생길 때). 이 문서 §2 축 A 의 RED 4 도 이 규칙을 테스트가 직접 켠 결과라, §3 수리는 문서가 이미 말한 대로 사용자-가시 변경 0 이다.
