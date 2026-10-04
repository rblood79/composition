import { PersistentLayoutTree as SharedPersistentLayoutTree } from "../../../../../../../../packages/shared/src/catalog/runtime/persistentLayoutTree";
import {
  createLayoutEngine,
  type LayoutEngineAPI,
} from "../../wasm-bindings/layoutBridge";
export type { PersistentBatchNode } from "../../../../../../../../packages/shared/src/catalog/runtime/persistentLayoutTree";
export class PersistentLayoutTree extends SharedPersistentLayoutTree {
  constructor(engine: LayoutEngineAPI = createLayoutEngine()) {
    super(engine);
  }
}
