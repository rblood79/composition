/**
 * lazy 패널 경계 — ADR-212 HC5.
 *
 * 편집기 구현 (`DataTableEditorPanel` · `DataTableFieldPanel` 과 그 아래 editors/*) 은 initial
 * chunk 에 들어가지 않는다. `panelConfigs` 는 loader 만 들고, 처음 열릴 때 chunk 를 받는다.
 * fallback 은 패널 골격 (`.panel`) 안의 스피너라 열림 순간 자리·폭이 흔들리지 않고, 포커스는
 * 호출한 곳 (목록의 버튼) 에 그대로 남는다 — 로드 뒤에도 옮기지 않는다.
 */
import { lazy, Suspense, type ComponentType } from "react";
import { LoadingSpinner, PanelContents } from "../../components";
import type { PanelProps } from "./types";

export function lazyPanel(
  loader: () => Promise<{ default: ComponentType<PanelProps> }>,
): ComponentType<PanelProps> {
  const Lazy = lazy(loader);
  function LazyPanel(props: PanelProps) {
    return (
      <Suspense
        fallback={
          <div className="panel panel-lazy-fallback" aria-busy="true">
            <PanelContents>
              <LoadingSpinner />
            </PanelContents>
          </div>
        }
      >
        <Lazy {...props} />
      </Suspense>
    );
  }
  return LazyPanel;
}
