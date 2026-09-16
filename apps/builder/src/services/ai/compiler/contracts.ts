/** ADR-202 — host와 provider를 모르는 실행 계약. mutation 의미는 기존 tool이 소유한다. */
import { z } from "zod";
import { fillContract } from "./fillContract";

const id = z.string().min(1);
const fields = z.record(z.string(), z.json());
const canonical = z.strictObject({
  clip: z.boolean().optional(),
  placeholder: z.boolean().optional(),
  reusable: z.boolean().optional(),
  slot: z.union([z.literal(false), z.array(id)]).optional(),
});

export const elementToolContracts = {
  create_element: z.strictObject({
    type: id,
    parentId: id.optional(),
    props: fields.optional(),
    styles: fields.optional(),
    fills: z.array(fillContract).optional(),
    canonical: canonical.optional(),
  }),
  update_element: z.strictObject({
    elementId: id,
    props: fields.optional(),
    styles: fields.optional(),
    fills: z.array(fillContract).optional(),
    canonical: canonical.optional(),
  }),
  delete_element: z.strictObject({ elementId: id }),
  run_command: z.strictObject({ id, args: fields.optional() }),
};

const operation = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("create_element"),
    args: elementToolContracts.create_element,
  }),
  z.strictObject({
    op: z.literal("update_element"),
    args: elementToolContracts.update_element,
  }),
  z.strictObject({
    op: z.literal("delete_element"),
    args: elementToolContracts.delete_element,
  }),
  z.strictObject({
    op: z.literal("run_command"),
    args: elementToolContracts.run_command,
  }),
]);

export const programContract = z.strictObject({
  version: z.literal(1),
  source: z.enum(["compiler", "llm"]),
  // async multi-op은 기존 도구가 원자성을 보장하지 않는다. mutation 전 거부한다.
  operations: z.array(operation).length(1),
});

export type BuilderCommandOperation = z.infer<typeof operation>;
export type BuilderCommandProgram = z.infer<typeof programContract>;
export type ElementToolName = keyof typeof elementToolContracts;
export type ToolArgs<K extends ElementToolName> = z.infer<
  (typeof elementToolContracts)[K]
>;

/** 모델은 빈 operations로 실행 불가를 표현할 수 있다. executor는 계속 정확히 1 op만 허용한다. */
export const programJsonSchema = () =>
  z.toJSONSchema(
    programContract.extend({
      operations: z.array(operation).max(1),
    }),
  );

/** 표시한 로컬 작업을 같은 선택에서만 실행하기 위한 proposal. 실행 시 다시 검증한다. */
export interface CompilerProposal {
  identity: string;
  program: BuilderCommandProgram;
}
