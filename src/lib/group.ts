import type { TodoGroup } from "@/lib/types";

/**
 * AI가 나눠 준 묶음을 검사하고 바로잡는다.
 *
 * Design Ref: DESIGN.md §2 묶음 보기 — 할 일을 빠뜨리거나 두 번 보여주지 않는 것은 AI에 맡기지 않고 코드가 지킨다.
 * - 모든 할 일이 정확히 한 묶음에 들어가게 한다 (빠진 것은 "기타"로, 겹친 것은 처음 묶음에만)
 * - 묶음은 최대 MAX_GROUPS개, 이름은 MAX_GROUP_NAME자까지
 * - 묶음 안에서는 원래 순서를, 묶음끼리는 첫 할 일이 나온 순서를 지킨다
 */

export const MAX_GROUPS = 5;
export const MAX_GROUP_NAME = 10;

const OTHER = { name: "기타", emoji: "📌" };

/**
 * @param raw AI 답을 JSON으로 읽은 값. {"groups": [{"name", "emoji", "items": [1부터 시작하는 번호]}]}
 * @param count 할 일 개수
 * @returns 바로잡은 묶음 목록. indexes는 0부터 시작. 모양이 아예 틀리면 null
 */
export function normalizeGroups(raw: unknown, count: number): TodoGroup[] | null {
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { groups?: unknown }).groups)) return null;

  const used = new Set<number>();
  const groups: TodoGroup[] = [];

  for (const item of (raw as { groups: unknown[] }).groups) {
    if (typeof item !== "object" || item === null) continue;
    const { name, emoji, items } = item as { name?: unknown; emoji?: unknown; items?: unknown };
    if (typeof name !== "string" || !name.trim() || !Array.isArray(items)) continue;

    const indexes: number[] = [];
    for (const number of items) {
      const index = typeof number === "number" && Number.isInteger(number) ? number - 1 : -1;
      if (index >= 0 && index < count && !used.has(index)) {
        used.add(index);
        indexes.push(index);
      }
    }
    if (indexes.length === 0) continue;

    groups.push({
      name: Array.from(name.trim()).slice(0, MAX_GROUP_NAME).join(""), // 이모지가 반으로 잘리지 않게 글자 단위로 자른다
      emoji: typeof emoji === "string" && emoji.length <= 8 ? emoji.trim() : "",
      indexes,
    });
  }

  // AI가 빠뜨린 할 일은 "기타"에 넣는다
  const missing = Array.from({ length: count }, (_, i) => i).filter((i) => !used.has(i));
  if (missing.length > 0) groups.push({ ...OTHER, indexes: missing });

  // 이름이 같은 묶음은 하나로 합친다
  let merged: TodoGroup[] = [];
  for (const group of groups) {
    const same = merged.find((g) => g.name === group.name);
    if (same) same.indexes.push(...group.indexes);
    else merged.push({ ...group, indexes: [...group.indexes] });
  }

  // 묶음이 너무 많으면 앞의 (MAX_GROUPS - 1)개만 남기고 나머지는 모두 "기타" 하나로 합친다.
  // "기타"를 붙인 뒤에 세므로, 빠진 할 일이 있어도 MAX_GROUPS개를 넘지 않는다
  if (merged.length > MAX_GROUPS) {
    const keep = merged.filter((g) => g.name !== OTHER.name).slice(0, MAX_GROUPS - 1);
    const rest = merged.filter((g) => !keep.includes(g));
    merged = [...keep, { ...OTHER, indexes: rest.flatMap((g) => g.indexes) }];
  }

  for (const group of merged) group.indexes.sort((a, b) => a - b);
  return merged.sort((a, b) => a.indexes[0] - b.indexes[0]);
}
