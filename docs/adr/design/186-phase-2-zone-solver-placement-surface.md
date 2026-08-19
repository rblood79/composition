# ADR-186 Phase 2: zone solver, placement surface, and rollback target

## 판정

**G2 PASS — 2026-08-19**

production drag/runtime/writer는 v2에 유지한 채 9-zone pure solver, actual 4px placement
surface와 v3 -> v2 operational rollback recovery를 추가했다. Phase 2 build는 v3 primary를
valid v2 primary로 복구할 수 있는 최소 rollback target이며 Phase 3 drag transaction은
시작하지 않았다.

- 기준 commit은 Phase 1 완료 commit `f748aaaa7`다.
- production layout state는 계속 `PanelWorkspaceLayoutV2`다.
- v3 production writer와 zone drag candidate/drop transaction은 연결하지 않았다.
- project document, IndexedDB project row, Supabase API write 경로는 변경하지 않았다.

## 9-zone geometry 계약

`panelWorkspaceLayoutV3.ts`는 normalize/fit 뒤 다음 값만으로 origin을 계산한다.

```text
remainingWidth = surface.width - cluster.width
remainingHeight = surface.height - cluster.height

left / center / right = 0 / remainingWidth / 2 / remainingWidth
top / center / bottom = 0 / remainingHeight / 2 / remainingHeight
```

solver는 visible row만 solve 수요와 frame geometry에 포함하고 hidden row/cluster graph는
normalized layout에 그대로 보존한다. 사후 position clamp를 사용하지 않으므로 width/height가
바뀔 때 right/top/bottom zone origin을 다시 계산한다.

| fixture                        | 결과                                                  |
| ------------------------------ | ----------------------------------------------------- |
| 9-zone origin                  | 9/9 expected local origin과 일치                      |
| top-right width 233 -> 500     | `x + width === surface.width`, `y === 0`              |
| bottom-right height 160 -> 500 | right/bottom edge drift 0                             |
| 320x180 full registry          | visible frame의 x/y >= 0, right/bottom surface 이탈 0 |

## 공통 placement surface

`.panel-workspace`는 host 전체를 덮고 `.panel-workspace-placement-surface`가
`inset: var(--panel-workspace-gap)`을 정확히 한 번 적용한다. activity rail, dock와 모든
stable panel frame은 이 surface 아래에 있고 `.panel-dock-surface`는 dynamic frame bounds가
아닌 `inset: 0` common containing block이다.

production store 초기화는 pending surface의 실제 `clientWidth/clientHeight`가 측정된 뒤
실행한다. runtime도 같은 measured rect로 생성되고 ResizeObserver가 publish한 rect만
소비한다.

local Builder 실측:

| rect / invariant     | 값                                                 |
| -------------------- | -------------------------------------------------- |
| route                | `/builder/9a089720-8f73-40ea-916a-bf58c2f49599`    |
| workspace            | `(0, 48) 2131 x 1184`                              |
| placement surface    | `(4, 52) 2123 x 1176`                              |
| actual inset         | top/right/bottom/left 모두 `4px`                   |
| dock                 | placement surface와 네 edge 모두 오차 `0px`        |
| visible frame parent | Nodes/Components/Styles 모두 `.panel-dock-surface` |

## v3 -> v2 operational rollback

`panelWorkspaceLayoutV3Rollback.ts`는 actual surface rect로 v3를 검증하고 다음 source를
구분한다.

| source                        | v2 target                                                       |
| ----------------------------- | --------------------------------------------------------------- |
| migration 직후 byte-identical | matching `composition-panel-layout.v2-backup`의 exact raw       |
| migration 이후 편집           | current v3 graph를 actual-surface floating position으로 project |
| v3-born                       | current v3 projection                                           |

projection은 `placementZone`만 v2 floating `position`으로 바꾸며 column/row, panel ID,
visibility, `railOrder`, width/height와 bottommost -> topmost focus order를 보존한다.

rollback write 순서는 다음 세 경계로 고정했다.

1. exact current v3 raw와 valid target v2 raw를
   `composition-panel-layout.v3-rollback-backup` prepared envelope로 쓴다.
2. primary와 prepared envelope가 그대로인지 다시 검증한 뒤 valid v2 primary를 쓴다.
3. rollback envelope marker를 committed로 쓴다.

| fault 경계             | 잔존 primary | 잔존 rollback backup | 재실행 결과               |
| ---------------------- | ------------ | -------------------- | ------------------------- |
| prepared backup write  | v3           | 없음                 | rollback 전체 재시도      |
| v2 primary write       | v3           | prepared             | 동일 target rollback      |
| committed marker write | v2           | prepared             | marker-only commit repair |

prepared mismatch/malformed input은 primary를 쓰지 않고 fail closed한다. committed rollback
뒤 v2 사용자가 layout을 다시 편집한 경우에는 valid v2 current primary를 정상 hydrate한다.
store integration fixture는 v3 primary를 actual surface 기반 exact v2로 복구하고 hydration을
`ready`로 전환하는 old-code boundary를 검증한다.

## 검증 결과

- focused Vitest: panel workspace 관련 21 files, 156 tests PASS
- `pnpm run codex:typecheck`: PASS, Builder baseline 43 known errors 대비 신규 violation 0
- `pnpm run codex:preflight`: PASS
- local Builder browser geometry: actual inset 4/4/4/4px, dock edge error 0px, visible frame
  containing block 3/3 일치
- CSS/Skia cross-check: 변경은 Builder DOM panel overlay와 localStorage layout recovery에
  한정된다. Preview/catalog/spec/Skia renderer import 0건이며 Canvas는 기존
  `.panel-workspace-main` local rect 소비 계약을 유지한다.

## 위험 잔여

| 위험                 | G2 처리                                            | 잔여 Gate                                |
| -------------------- | -------------------------------------------------- | ---------------------------------------- |
| R2 zone anchor drift | fit-before-origin pure solver, browser common rect | G3 candidate/drop, G4 resize 전 zone     |
| R9 narrow viewport   | 320x180 solver fit와 actual 4px surface fixture    | G3/G4 interaction lifecycle              |
| R10 rollback/crash   | exact/post-edit/v3-born + 3 write fault recovery   | G5 production cutover rollback rehearsal |

다음 단계는 별도 사용자 요청 뒤 Phase 3 transient drag/candidate transaction으로 진행한다.
