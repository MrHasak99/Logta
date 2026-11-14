import type { Product } from '../../data/types'
import type { BasketLine } from './engine'

/**
 * "Load Sample Weekly Basket": a realistic 6-item Kuwait basket, tuned against the seed data
 * (see createSeedData in src/data/seedData.ts):
 *  - Americana Foul is out of stock at Lulu (the cheapest store), so no single cheap store covers the basket
 *    and the best plan becomes a Lulu + Carrefour split.
 *  - Almarai Low Fat Milk 2L is out of stock at Carrefour, so the best single store (Carrefour) swaps it for
 *    Almarai Fresh Milk 1L packs.
 * `id` is the exact product id; `keyword` is a lowercase fragment of nameEn used if the id ever stops matching,
 * so a typo or catalogue change can never leave the demo basket empty.
 */
interface DemoSpec extends Omit<BasketLine, 'productId'> {
  id: string
  keyword: string
}

export const DEMO_BASKET: DemoSpec[] = [
  { id: 'almarai-low-fat-milk-2l', keyword: 'low fat milk', qty: 2, allowSubstitute: true },
  { id: 'americana-foul-400', keyword: 'foul', qty: 4, allowSubstitute: true },
  { id: 'sadia-chicken-breast-1kg', keyword: 'chicken breast', qty: 2, allowSubstitute: true },
  { id: 'indomie-chicken-5', keyword: 'indomie', qty: 3, allowSubstitute: false },
  { id: 'nescafe-classic-200', keyword: 'nescafe', qty: 1, allowSubstitute: true },
  { id: 'fairy-dish-1l', keyword: 'fairy', qty: 1, allowSubstitute: true },
]

/** Ids used by the "Quick add" chips (resolved the same way as the demo basket). */
export const QUICK_ADD: { id: string; keyword: string }[] = [
  { id: 'almarai-fresh-milk-1l', keyword: 'fresh milk' },
  { id: 'kiri-square-24', keyword: 'kiri' },
  { id: 'tilda-basmati-5kg', keyword: 'basmati' },
  { id: 'lipton-yellow-100', keyword: 'lipton' },
  { id: 'tide-powder-3kg', keyword: 'tide' },
  { id: 'evian-6x1.5', keyword: 'evian' },
]

export const resolveProduct = (spec: { id: string; keyword: string }, products: Product[]): Product | undefined =>
  products.find((p) => p.id === spec.id) ?? products.find((p) => p.nameEn.toLowerCase().includes(spec.keyword))

/** Resolves every spec against the live catalogue, skipping unknowns and duplicates. */
export const buildDemoBasket = (products: Product[]): BasketLine[] => {
  const lines: BasketLine[] = []
  for (const spec of DEMO_BASKET) {
    const p = resolveProduct(spec, products)
    if (p && !lines.some((l) => l.productId === p.id)) {
      lines.push({ productId: p.id, qty: spec.qty, allowSubstitute: spec.allowSubstitute })
    }
  }
  return lines
}
