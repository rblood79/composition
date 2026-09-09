import { useListData } from 'react-stately';
import { useEffect } from 'react';

const FAVORITE_COMPONENTS_KEY = 'composition_favorite_components';

/**
 * localStorage에서 즐겨찾기 로드
 */
export function loadFavoritesFromStorage(): { id: string; type: string }[] {
    try {
        const stored = localStorage.getItem(FAVORITE_COMPONENTS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                // string[] → { id, type }[] 변환
                return Array.from(new Set<string>(parsed.filter((type) => typeof type === 'string').map((type) => type === 'Chart' ? 'chart-bar' : type))).map((type) => ({ id: type, type }));
            }
        }
    } catch (error) {
        console.error('Failed to load favorite components:', error);
    }
    return [];
}

/**
 * localStorage에 즐겨찾기 저장
 */
function saveFavoritesToStorage(items: { id: string; type: string }[]) {
    try {
        // { id, type }[] → string[] 변환
        const tags = items.map((item) => item.type);
        localStorage.setItem(FAVORITE_COMPONENTS_KEY, JSON.stringify(tags));
    } catch (error) {
        console.error('Failed to save favorite components:', error);
    }
}

/**
 * useFavoriteComponents - React Stately useListData 기반 즐겨찾기 관리
 *
 * @example
 * ```tsx
 * const { favoriteTags, toggleFavorite, isFavorite, clearFavorites } = useFavoriteComponents();
 *
 * // 즐겨찾기 토글
 * toggleFavorite('Button');
 *
 * // 즐겨찾기 여부 확인
 * if (isFavorite('Button')) { ... }
 * ```
 */
export function useFavoriteComponents() {
    const list = useListData<{ id: string; type: string }>({
        initialItems: loadFavoritesFromStorage(),
        getKey: (item) => item.id,
    });

    // localStorage 동기화: items가 변경될 때마다 저장
    useEffect(() => {
        saveFavoritesToStorage(list.items);
    }, [list.items]);

    // 즐겨찾기 토글
    const toggleFavorite = (type: string) => {
        const exists = list.items.some((item) => item.type === type);
        if (exists) {
            // 제거
            list.remove(type);
        } else {
            // 추가
            list.append({ id: type, type });
        }
    };

    // 즐겨찾기 여부 확인
    const isFavorite = (type: string) => {
        return list.items.some((item) => item.type === type);
    };

    // 즐겨찾기 초기화
    const clearFavorites = () => {
        // 모든 아이템 제거
        const allKeys = list.items.map((item) => item.id);
        list.remove(...allKeys);
        localStorage.removeItem(FAVORITE_COMPONENTS_KEY);
    };

    // 하위 호환성을 위해 favoriteTags 배열 제공
    const favoriteTags = list.items.map((item) => item.type);

    return {
        favoriteTags,
        toggleFavorite,
        isFavorite,
        clearFavorites,
    };
}
