import { createContext, useContext } from "react";
export const CollectionDataContext = createContext({});
/**
 * Collection Data 서비스 훅
 */
export function useCollectionDataServices() {
    return useContext(CollectionDataContext);
}
//# sourceMappingURL=collectionDataContext.js.map