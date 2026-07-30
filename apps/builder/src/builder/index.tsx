import { BuilderCore } from "./main/BuilderCore";
import { RenderProfiler } from "./utils/RenderProfiler";
import { PERF_LABEL } from "./utils/perfMarks";

function Builder() {
  return (
    <RenderProfiler id="root" label={PERF_LABEL.REACT_RENDER_ROOT}>
      <BuilderCore />
    </RenderProfiler>
  );
}

export default Builder;
