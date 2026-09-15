import { lazyPanel } from "../core/lazyPanel";
import "./AIPanel.css";

/** AI 첫 열림에서 direct 실행 의존성을 준비해 이후 offline 제출도 실행한다. */
export const AIPanel = lazyPanel(async () => {
  const [module] = await Promise.all([
    import("./AIPanel"),
    import("../../../services/ai/tools/runCommand"),
  ]);
  return { default: module.AIPanel };
});
