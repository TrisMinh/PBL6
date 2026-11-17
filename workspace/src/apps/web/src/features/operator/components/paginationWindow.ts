export function paginationWindow(
  page: number,
  total: number,
): (number | "start-gap" | "end-gap")[] {
  const numbers = [
    ...new Set([
      1,
      total,
      ...Array.from({ length: 5 }, (_, i) => page - 2 + i),
    ]),
  ]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const result: (number | "start-gap" | "end-gap")[] = [];
  numbers.forEach((n, i) => {
    if (i && n - numbers[i - 1] > 1)
      result.push(n < page ? "start-gap" : "end-gap");
    result.push(n);
  });
  return result;
}
