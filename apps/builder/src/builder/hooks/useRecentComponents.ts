import { useListData } from 'react-stately';
import { useEffect } from 'react';

const RECENT_COMPONENTS_KEY = 'composition_recent_components';
const MAX_RECENT_ITEMS = 8;

interface RecentComponent {
    id: string;
    type: string;
    count: number;
}

/**
 * localStorage에서 최근 컴포넌트 로드
 */
export function loadRecentFromStorage(): RecentComponent[] {
    try {
        const stored = localStorage.getItem(RECENT_COMPONENTS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                const merged = new Map<string, RecentComponent>();
                for (const item of parsed) {
                    const original = typeof item === 'string' ? item : item?.type;
                    if (typeof original !== 'string') continue;
                    const type = original === 'Chart' ? 'chart-bar' : original;
                    const count = typeof item === 'object' && item?.count > 0 ? item.count : 1;
                    const previous = merged.get(type);
                    if (previous) previous.count += count;
                    else merged.set(type, { id: type, type, count });
                }
                return Array.from(merged.values()).slice(0, MAX_RECENT_ITEMS);
            }
        }
    } catch (error) {
        console.error('Failed to load recent components:', error);
    }
    return [];
}

/**
 * localStorage에 최근 컴포넌트 저장
 */
function saveRecentToStorage(items: RecentComponent[]) {
    try {
        // { id, type, count }[] 형식으로 저장
        localStorage.setItem(RECENT_COMPONENTS_KEY, JSON.stringify(items));
    } catch (error) {
        console.error('Failed to save recent components:', error);
    }
}

/**
 * useRecentComponents - React Stately useListData 기반 최근 사용 컴포넌트 관리
 *
 * 최대 8개까지만 유지하며, 최근 순서대로 정렬됩니다.
 * 각 컴포넌트의 사용 횟수를 추적합니다.
 *
 * @example
 * ```tsx
 * const { recentTags, addRecentComponent, clearRecentComponents, getComponentCount } = useRecentComponents();
 *
 * // 컴포넌트 추가 (중복 제거 + 맨 앞에 추가 + 사용 횟수 증가)
 * addRecentComponent('Button');
 *
 * // 특정 컴포넌트의 사용 횟수 가져오기
 * const count = getComponentCount('Button');
 *
 * // 최근 사용 목록 초기화
 * clearRecentComponents();
 * ```
 */
export function useRecentComponents() {
    const list = useListData<RecentComponent>({
        initialItems: loadRecentFromStorage(),
        getKey: (item) => item.id,
    });

    // localStorage 동기화: items가 변경될 때마다 저장
    useEffect(() => {
        saveRecentToStorage(list.items);
    }, [list.items]);

    // 최근 사용 컴포넌트 추가
    const addRecentComponent = (type: string) => {
        // 이미 존재하면 제거하고 count 증가
        const existingItem = list.items.find((item) => item.type === type);
        if (existingItem) {
            list.remove(type);
            // 맨 앞에 추가하고 count 증가
            list.prepend({ id: type, type, count: existingItem.count + 1 });
        } else {
            // 새로 추가 (count = 1)
            list.prepend({ id: type, type, count: 1 });
        }

        // MAX_RECENT_ITEMS 개수 제한
        if (list.items.length > MAX_RECENT_ITEMS) {
            // 오래된 아이템 제거 (마지막 아이템들)
            const itemsToRemove = list.items.slice(MAX_RECENT_ITEMS);
            const keysToRemove = itemsToRemove.map((item) => item.id);
            list.remove(...keysToRemove);
        }
    };

    // 최근 사용 목록 초기화
    const clearRecentComponents = () => {
        // 모든 아이템 제거
        const allKeys = list.items.map((item) => item.id);
        list.remove(...allKeys);
        localStorage.removeItem(RECENT_COMPONENTS_KEY);
    };

    // 특정 컴포넌트의 사용 횟수 가져오기
    const getComponentCount = (type: string): number => {
        const item = list.items.find((item) => item.type === type);
        return item?.count || 0;
    };

    // 하위 호환성을 위해 recentTags 배열 제공
    const recentTags = list.items.map((item) => item.type);

    return {
        recentTags,
        addRecentComponent,
        clearRecentComponents,
        getComponentCount,
    };
}
