export function buildShelves(items, perShelf = 12, minGroup = 4) {
  const counts = {};
  items.forEach((book) =>
    (book.tags || []).forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
    })
  );

  const primary = (book) =>
    (book.tags || []).slice().sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))[0] || null;

  const groups = new Map();
  items.forEach((book) => {
    const key = primary(book) || '__none';
    groups.set(key, [...(groups.get(key) || []), book]);
  });

  const named = [];
  const loose = [];
  for (const [key, list] of groups) {
    if (key === '__none' || list.length < minGroup) loose.push(...list);
    else named.push([key, list]);
  }
  named.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const shelves = [];
  const push = (label, list) => {
    for (let i = 0; i < list.length; i += perShelf) {
      shelves.push({
        id: `${label}-${i}`,
        label,
        showLabel: i === 0,
        books: list.slice(i, i + perShelf),
      });
    }
  };

  named.forEach(([label, list]) => push(label, list));
  if (loose.length) push(named.length ? 'More on the shelves' : 'On the shelves', loose);
  return shelves;
}
