/** ترقيم صفحات موحّد للقوائم — يمنع تحميل آلاف السجلات دفعة واحدة. */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

export interface PageParams {
  skip: number;
  take: number;
  page: number;
  perPage: number;
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

/** يحلّل معاملات الاستعلام (page/perPage) بحدود آمنة. */
export function parsePage(pageRaw?: string, perPageRaw?: string): PageParams {
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const perPageParsed = Number.parseInt(perPageRaw ?? String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE;
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, perPageParsed));
  return { skip: (page - 1) * perPage, take: perPage, page, perPage };
}

export function toPage<T>(items: T[], total: number, params: PageParams): Page<T> {
  return { items, total, page: params.page, perPage: params.perPage };
}
