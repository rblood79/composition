import { useCallback } from "react";
import { Element } from "../../types/core/store.types";

export interface UseValidationReturn {
  validateOrderNumbers: (elements: Element[]) => void;
}

export const useValidation = (): UseValidationReturn => {
  const validateOrderNumbers = useCallback((_elements: Element[]) => {
    if (process.env.NODE_ENV !== "development") return;
  }, []);

  return {
    validateOrderNumbers,
  };
};
