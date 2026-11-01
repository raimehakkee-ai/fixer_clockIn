export type PageParams = {
  page: number;
  limit: number;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function skipFor({ page, limit }: PageParams): number {
  return (page - 1) * limit;
}

export function paginated<T>(data: T[], total: number, params: PageParams): Paginated<T> {
  return {
    data,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    },
  };
}
