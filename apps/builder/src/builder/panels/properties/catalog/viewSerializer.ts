/**
 * ADR-291 G3 — the view request serializer (`collections/view/serialize.ts`, ~1.9 KB gz) for the
 * filter section: loaded when a connection shows an API collection's request (the endpoint has a
 * query format), so the Properties panel on the first screen does not carry it.
 */
import { useLazyModule } from "../../../../../../../packages/shared/src/hooks/useLazyModule";
import { createLazyModule } from "../../../../../../../packages/shared/src/utils/lazyModule";

type ViewSerializer =
  typeof import("../../../../../../../packages/shared/src/collections/view/serialize");

const viewSerializer = createLazyModule(
  () =>
    import("../../../../../../../packages/shared/src/collections/view/serialize"),
);

/** The serializer once loaded; `wanted` starts the load (an API collection's request is shown). */
export function useViewSerializer(wanted: boolean): ViewSerializer | undefined {
  return useLazyModule(viewSerializer, wanted);
}
