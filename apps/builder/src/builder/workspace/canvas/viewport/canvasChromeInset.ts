/**
 * 캔버스 위에 떠 있는 chrome 이 가리는 좌우 폭 (px).
 *
 * 캔버스는 창 전체를 덮고 패널 토글 레일 (`.panel-toggle-rail`) 이 그 위에 떠 있다 — 레일이
 * 덮는 띠는 페이지를 놓을 수 없는 자리다. 열 수 `auto` 가 컨테이너 전폭으로 세면 마지막 열이
 * 레일 밑으로 들어간다 (사용자 지적 2026-09-23).
 *
 * 폭은 고정값을 복제하지 않고 실제 rect 에서 읽는다 — 레일 폭과 바깥 여백은 CSS 소유
 * (`PanelWorkspace.css`) 라 상수로 두면 갈라진다. 레일 **바깥쪽 여백까지** 포함한다: 창
 * 가장자리에서 레일 안쪽 끝까지가 통째로 못 쓰는 띠다.
 *
 * 떠 있는 **패널** 은 세지 않는다 — 여닫을 때마다 열 수가 뛴다 (위치가 패널 상태에 묶인다).
 */
export function readCanvasRailInset(
  doc: Pick<Document, "querySelector"> | undefined = typeof document ===
  "undefined"
    ? undefined
    : document,
  viewportWidth: number = typeof window === "undefined" ? 0 : window.innerWidth,
): number {
  if (!doc) return 0;
  let inset = 0;
  for (const side of ["left", "right"] as const) {
    const rail = doc.querySelector(`.panel-toggle-rail[data-side="${side}"]`);
    if (!(rail instanceof Element)) continue;
    const rect = rail.getBoundingClientRect();
    if (!(rect.width > 0)) continue;
    inset +=
      side === "left"
        ? Math.max(0, rect.right)
        : Math.max(0, viewportWidth - rect.left);
  }
  return inset;
}
