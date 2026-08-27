/**
 * 다중 선택 조작 = 되돌리기 1회 계약 (2026-07-26).
 *
 * `track*` 헬퍼는 mutation 이 스스로 history 를 기록하지 않던 시절의 것이다. 2026-07-15
 * 에 전 mutation call site 가 canonical event 부착으로 전환된 뒤, 기록하는 store action
 * 과 `track*` 을 나란히 부르는 호출부는 **같은 변경을 두 엔트리로** 남기게 됐다. 실측:
 *
 * | 조작                  | 수정 전 엔트리 | 원인                                             |
 * | --------------------- | -------------- | ------------------------------------------------ |
 * | 그룹 (Cmd+G)          | 1 ✅           | addElement(skipHistory) + trackGroupCreation     |
 * | 그룹 해제             | 2 ❌           | trackUngroup + removeElement 가 각각 기록         |
 * | 다중 삭제 (2개)       | 4 ❌           | trackMultiDelete N개 + removeElement N개          |
 * | 정렬·분배 (패널 버튼) | 2 ❌           | trackBatchUpdate + batchUpdateElementProps       |
 * | 정렬·분배 (단축키)    | 1 + N ❌       | trackBatchUpdate + 요소별 updateElementProps      |
 * | 배치 편집             | 2 ❌           | trackBatchUpdate + batchUpdateElementProps       |
 *
 * 수정 후는 전부 **1** 이며 표의 모든 조작을 live 실측했다:
 * - 정렬·분배는 `left/top/width/height` 4개가 px 인 요소가 있어야 동작하므로 임시로 조건을
 *   만들어 패널 버튼·단축키 두 경로 각각 확인 (우변 정렬 160 / 수평 분배 가운데 50→100px).
 * - 배치 편집은 필드 변경이 대기 상태로 모이고 "모두 적용" 에서 반영되는 구조다
 *   (`BatchPropertyEditor.handleApplyAll` → `onBatchUpdate`) — 스위치 토글만으로는
 *   store 가 안 바뀌므로 적용 버튼까지 눌러야 측정된다.
 * - 전부 엔트리 1개 + undo 1회 복원 + 요소 id 가 prop 이름으로 새는 현상 0건.
 *
 * 상태 손상은 없었다 (중복 insert 가 upsert) — 증상은 "아무 것도 안 바뀌는 죽은 undo
 * 단계". 렌더 하네스가 없는 파일이라 소스 계약으로 고정한다.
 */
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function readSource(file: string): Promise<string> {
  return readFile(resolve(__dirname, file), "utf-8");
}

const PANELS = ["./PropertiesPanel.tsx", "./CanvasSelectionShortcuts.tsx"];

/**
 * 정렬·분배·그룹 해제의 오케스트레이션은 ADR-182 Phase 1.5 에서 공유 계층
 * (`canvasActions`) 으로 옮겨졌다 — 단축키 host 와 컨텍스트 메뉴가 같은 구현을
 * 소비한다. 계약 자체는 그대로이므로 검사 대상만 따라간다.
 */
const CANVAS_ACTIONS = "../../workspace/canvas/actions/canvasActions.ts";

describe("기록하는 store action 과 track 헬퍼를 겹쳐 부르지 않는다", () => {
  it("두 패널은 trackBatchUpdate 를 쓰지 않는다 (배치 action 이 이미 기록)", async () => {
    for (const file of PANELS) {
      const source = await readSource(file);
      // 주석 언급은 허용, 실제 호출/임포트는 금지
      expect(source).not.toMatch(/^\s*trackBatchUpdate\(/m);
      expect(source).not.toMatch(/^\s*trackBatchUpdate,\s*$/m);
    }
  });

  it("정렬·분배는 요소별 update 대신 배치 action 1회로 적용한다", async () => {
    const actions = await readSource(CANVAS_ACTIONS);

    // 요소별 updateElementProps 를 Promise.all 로 돌리면 엔트리가 요소 수만큼 늘어난다
    expect(actions).not.toMatch(
      /Promise\.all\(\s*\n?\s*updates\.map\(\(update\)/,
    );
    expect(actions.match(/await batchUpdateElementProps\(/g)).toHaveLength(2); // align + distribute

    const panel = await readSource("./PropertiesPanel.tsx");
    // batch 편집 1곳 — 정렬·분배는 공유 계층(body 필터 포함)을 소비한다
    expect(panel.match(/await batchUpdateElementProps\(/g)).toHaveLength(1);
    expect(panel).toContain("await alignSelection(");
    expect(panel).toContain("await distributeSelection(");
  });

  it("다중 삭제는 배치 removeElements 1회 (요소별 병렬 삭제 금지)", async () => {
    const panel = await readSource("./PropertiesPanel.tsx");

    expect(panel).toContain("await removeElements(selectedElementIds);");
    // 병렬 단건 삭제는 엔트리 N개 + 오래된 currentState 기반 set 으로 앞선 삭제 되살림
    expect(panel).not.toMatch(/Promise\.all\(\s*\n?\s*selectedElementIds\.map/);
    // 주석 언급은 허용(제거 사유 기록), 호출·임포트는 금지
    expect(panel).not.toMatch(/^\s*trackMultiDelete\(/m);
    expect(panel).not.toMatch(/^\s*trackMultiDelete,\s*$/m);
  });

  it("그룹 해제의 group 삭제는 skipHistory (trackUngroup 이 remove event 보유)", async () => {
    const actions = await readSource(CANVAS_ACTIONS);

    expect(actions).toContain(
      "await removeElement(groupIdToDelete, { skipHistory: true });",
    );
    // 생성 쪽과 대칭 — 한쪽만 skipHistory 면 되돌리기 단위가 어긋난다
    expect(actions).toContain(
      "addElement(groupElement, { skipHistory: true })",
    );
    expect(actions).toContain("trackUngroup(");
  });
});

describe("trackBatchUpdate 는 남아 있지만 정당한 사용처만 갖는다", () => {
  it("historyHelpers 안의 instance 전파 경로에서만 호출된다", async () => {
    const helpers = await readFile(
      resolve(__dirname, "../../stores/utils/historyHelpers.ts"),
      "utf-8",
    );

    // 정의 1 + trackInstancePropagation 안의 호출 1
    expect(helpers.match(/trackBatchUpdate\(/g)).toHaveLength(2);
    expect(helpers).toContain("trackInstancePropagation");

    // "요소마다 엔트리 1개" 설계였던 trackMultiDelete 는 제거됨 — 부활 금지
    expect(helpers).not.toContain("export function trackMultiDelete");
  });
});
