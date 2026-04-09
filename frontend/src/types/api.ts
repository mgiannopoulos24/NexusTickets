export interface ApiResponse<T> {
  data: T;
  error: string | null;
  meta?: any;
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
