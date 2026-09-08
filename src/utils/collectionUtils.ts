export type IdentifiedById = {
  id: string | number;
};

export type ReplaceByIdUpdate<T extends IdentifiedById> = T | ((current: T) => T);

export function replaceById<T extends IdentifiedById>(
  items: T[],
  id: T['id'],
  update: ReplaceByIdUpdate<T>
): T[] {
  return items.map((item) => item.id === id
    ? (typeof update === 'function' ? update(item) : update)
    : item);
}

export function upsertById<T extends IdentifiedById>(items: T[], item: T): T[] {
  const existingIndex = items.findIndex((candidate) => candidate.id === item.id);

  if (existingIndex === -1) {
    return [item, ...items];
  }

  return items.map((candidate, index) => (index === existingIndex ? item : candidate));
}
