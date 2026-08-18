# ADR-922 Phase 6: Legacy Removal / Final Cutover Evidence

## 범위와 판정

- 실행일: 2026-08-18
- 범위: Phase 6 — legacy 제거와 최종 전환
- Gate: G6 Cutover/Removal
- 결과: **PASS**
- 유지 boundary: v1 parser, prepared/committed exact backup,
  `projectV2ToLegacyView` emergency rollback projection

## Production state/action cutover

Zustand `PanelLayoutSlice`에서 v1 `panelLayout` projection과 다음 compatibility action을
제거했다.

- `setPanelLayout`, `resetPanelLayout`
- `savePanelLayoutToStorage`, `loadPanelLayoutFromStorage`
- `toggleBottomPanel`
- `openPanelAsModal`, `closeModalPanel`, `focusModalPanel`
- `updateModalPanelPosition`, `updateModalPanelSize`, `closeAllModalPanels`

production state는 `panelWorkspaceLayout`, hydration status/error만 가진다. `usePanelLayout`은
`togglePanel(panelId)`, `floatPanel`, `focusFloatingPanel`, initialize/set command만 노출한다.
rail side 인자는 이미 visibility 판정에 쓰이지 않았으므로 제거했고 Command Palette,
Monitor shortcut, Typography Fonts 진입, BuilderHeader Settings 진입을 v2 command로 갱신했다.

production grep 결과 v1 state/action alias는 0건이다. `PanelLayoutState`와
`DEFAULT_PANEL_LAYOUT`은 `panelWorkspaceLayoutV2Migration`/Persistence 및 store의 v1
hydrate/default adapter에서만 참조된다.

## Legacy host/runtime removal

call graph가 barrel/test 밖에서 0인 다음 surface를 제거했다.

- `PanelArea.tsx`
- `BottomPanelArea.tsx`
- `PanelContainer.tsx`와 static test
- `ModalPanelContainer.tsx` / `ModalPanelContainer.css`
- `panelStackLayout.ts`와 v1 전용 test
- `workspace/utils/panelLayoutRuntime.ts`
- `styles/layout/footer.css`
- `styles/modules/panel-container.css`
- `layout/index.ts`의 legacy export/type export

`PanelArea`의 전용 child였던 `PanelContainer`와 v1 `panelStackLayout`도 production import 0을
확인한 뒤 같은 removal boundary에 포함했다. 삭제된 `panel-container.css`에서 실제 사용 중인
Nodes empty state 규칙만 `NodesPanel.css`로 옮겼다. panel 주석의 visibility owner도 실제
`PanelWorkspace` Activity boundary로 정정했다.

## Empty bottom rail과 Monitor

populated layout에서 Monitor가 right rail로 이동해 bottom `railOrder`가 빈 경우에도
`<div data-side="bottom"><nav><ul /></nav></div>`가 생성되는 잔여를 browser smoke가
발견했다. `PanelWorkspace`는 panel ID가 1개 이상인 rail만 렌더링하도록 수정했다.

- default fixture: bottom rail button `monitor` 1개
- moved fixture: bottom rail DOM 0, right rail Monitor button 1개
- Monitor frame/placement는 두 fixture 모두 1개
- production browser: rail 2개, empty rail 0, legacy DOM 0

따라서 빈 legacy DOM만 제거하고 bottom placement와 Monitor registry default는 유지했다.

## Rollback / refresh rehearsal

전용 3 files / 32 tests가 다음 경계를 재검증했다.

- v1 exact raw → prepared backup → primary v2 → committed backup 순서
- backup/primary/committed mark write 실패와 prepared refresh
- migrated-v1 exact backup reader와 v2-born byte-equivalent refresh
- Phase 1 read-only legacy projection에서 panel ID/visibility/placement 손실 0
- registry add/remove normalization
- production store refresh에서 visibility/cluster/size/floating focus order 보존
- production store shape에 v1 projection/action key 0

## Populated Builder browser smoke

대상: `http://localhost:5173/builder/8e92598a-99ae-4408-b905-b9531968c696`

- fresh reload: `.panel-workspace-host` 1, registry frame 13, legacy host DOM 0
- empty activity rail 0; 현재 persisted rail은 left/right 두 개만 렌더링
- Settings: rail hide → reload hidden 확인 → header `floatPanel`로 placed 복구, legacy modal 0
- Monitor: false → true toggle 후 reload에서도 true/placed, 다시 false로 복원 후 reload 확인
- 800×600: host `800×552`, main `704×504`, main 음수 rect 0
- narrow viewport의 active floating panel 3개가 모두 viewport bounds 내부
- viewport reset 후 `1800×988`, Settings true/placed와 Monitor false/hidden 원상복구

## Cross-check

| 레이어               | 영향                                                        | 결과 |
| -------------------- | ----------------------------------------------------------- | ---- |
| Spec / Factory       | component D1/D2와 factory 변경 없음                         | N/A  |
| shared CSS / Preview | shared renderer/CSS 변경 없음                               | N/A  |
| Skia / Canvas        | Canvas geometry/input 변경 없음                             | N/A  |
| Builder DOM/CSS      | v1 host CSS 제거, active PanelWorkspace/browser parity 확인 | PASS |
| State/Input          | v2 command만 노출, migration/rollback boundary 유지         | PASS |

Spec source를 수정하지 않았고 `.spec-rebuild-pending`도 생성되지 않았다. cross-check 결과
CRITICAL/HIGH 불일치는 0건이다.

## 검증

- functional changed-file ESLint: PASS, 신규 violation `0`
- layout/store/hook/component Vitest: `21 files / 125 tests` PASS
- rollback rehearsal: `3 files / 32 tests` PASS
- `pnpm type-check`: PASS, Builder baseline 43건 대비 신규 violation `0`
- `pnpm run codex:guard`: PASS
- `pnpm run codex:preflight`: PASS; format/type-check와 registration contract
  `1 file / 14 tests` 통과
- populated Builder G6 browser smoke: PASS
- `git diff --check`: PASS

G0~G6가 모두 통과했으며 ADR-922를 `Implemented`로 승격할 수 있다.
