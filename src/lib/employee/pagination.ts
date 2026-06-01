import type { SheetPagination } from "@/types/sheet";

export const DEFAULT_PAGE_SIZE = 12;

export function paginateSheetData(
  data: string[][],
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): { data: string[][]; pagination: SheetPagination } {
  if (!data.length) {
    return {
      data: [],
      pagination: { page: 1, pageSize, total: 0, totalPages: 0 },
    };
  }

  const [headerRow, ...bodyRows] = data;
  const total = bodyRows.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = bodyRows.slice(start, start + pageSize);

  return {
    data: [headerRow, ...pageRows],
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
  };
}
