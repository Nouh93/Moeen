type OfferLike = {
  percent: number;
  categoryId: string | null;
  endsAt: Date | null;
  active: boolean;
};

/** أفضل خصم ساري على منتج: أعلى نسبة بين عروض المتجر كله وعروض تصنيفه */
export function bestOfferPercent(
  offers: OfferLike[],
  categoryId: string | null,
): number {
  const now = Date.now();
  let best = 0;
  for (const o of offers) {
    if (!o.active) continue;
    if (o.endsAt && o.endsAt.getTime() < now) continue;
    if (o.categoryId && o.categoryId !== categoryId) continue;
    if (o.percent > best) best = o.percent;
  }
  return best;
}
