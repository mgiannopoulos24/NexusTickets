export interface ApiResponse<T> {
  data: T;
  error: string | null;
  meta?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  error: string | null;
  meta: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}
