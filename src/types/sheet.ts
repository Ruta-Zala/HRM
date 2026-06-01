export interface SheetPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SheetResponse<T> {
  success: boolean;
  data: T[];
  pagination?: SheetPagination;
  sheetRows?: number[];
}
