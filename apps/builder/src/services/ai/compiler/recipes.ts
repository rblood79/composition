/** 제품 alias가 기존 op/prop만 참조한다. factory/reusable의 자식 트리는 복제하지 않는다. */
import type { BuilderCommandOperation } from "./contracts";

export const commandRecipes: readonly {
  id: string;
  aliases: readonly string[];
  operation: BuilderCommandOperation;
}[] = [
  {
    id: "confirmation-button",
    aliases: ["확인 버튼", "confirmation button"],
    operation: {
      op: "create_element",
      args: { type: "Button", props: { children: "확인" } },
    },
  },
];
