/**
 * Server-side pagination helpers for Prisma queries.
 */

export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function parsePaginationParams(
  searchParams: Record<string, string | string[] | undefined>
): PaginationParams {
  const page = Math.max(1, parseInt(String(searchParams.page ?? "1"), 10) || 1);
  const rawSize = parseInt(String(searchParams.pageSize ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, rawSize), MAX_PAGE_SIZE);
  const search = typeof searchParams.search === "string" ? searchParams.search.trim() : undefined;
  const sortBy = typeof searchParams.sortBy === "string" ? searchParams.sortBy : undefined;
  const sortOrder =
    typeof searchParams.sortOrder === "string" && searchParams.sortOrder === "desc"
      ? "desc"
      : "asc";

  // Collect filter_* params
  const filters: Record<string, string> = {};
  for (const [key, val] of Object.entries(searchParams)) {
    if (key.startsWith("filter_") && typeof val === "string" && val) {
      filters[key.replace("filter_", "")] = val;
    }
  }

  return { page, pageSize, search, sortBy, sortOrder, filters };
}

export function buildPrismaArgs(params: PaginationParams): {
  skip: number;
  take: number;
  orderBy?: Record<string, "asc" | "desc">;
} {
  const skip = (params.page - 1) * params.pageSize;
  const take = params.pageSize;
  const orderBy = params.sortBy
    ? { [params.sortBy]: params.sortOrder ?? "asc" }
    : undefined;

  return { skip, take, ...(orderBy ? { orderBy } : {}) };
}

export function paginateResult<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  return {
    data,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  };
}
