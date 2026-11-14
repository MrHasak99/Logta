import type { AppData, Category, PriceEntry, PriceSource, Product, Store } from './types.js'

export const DATA_VERSION = 1

export const STORES: Store[] = [
  {
    id: 'mishref-coop',
    nameEn: 'Mishref Co-op',
    nameAr: 'جمعية مشرف',
    area: 'Mishref',
    lat: 29.2753,
    lng: 48.0722,
    isOnline: false,
    aliases: ['mishref co-op', 'mishref coop', 'mishref cooperative society', 'مشرف', 'جمعية مشرف التعاونية'],
  },
  {
    id: 'khaldiya-coop',
    nameEn: 'Khaldiya Co-op',
    nameAr: 'جمعية الخالدية',
    area: 'Khaldiya',
    lat: 29.2989,
    lng: 47.9661,
    isOnline: false,
    aliases: ['khaldiya co-op', 'khaldiya coop', 'khaldiya cooperative society', 'الخالدية', 'جمعية الخالدية التعاونية'],
  },
  {
    id: 'lulu',
    nameEn: 'Lulu Hypermarket',
    nameAr: 'لولو هايبرماركت',
    area: 'Al-Rai',
    lat: 29.3,
    lng: 47.9,
    isOnline: false,
    aliases: ['lulu', 'lulu hypermarket', 'lulu hyper market', 'lulu group', 'لولو', 'لولو هايبر ماركت'],
  },
  {
    id: 'carrefour',
    nameEn: 'Carrefour',
    nameAr: 'كارفور',
    area: '360 Mall',
    lat: 29.2641,
    lng: 47.9964,
    isOnline: false,
    aliases: ['carrefour', 'majid al futtaim', 'mafc', 'كارفور'],
  },
  {
    id: 'taw9eel',
    nameEn: 'Taw9eel (توصيل)',
    nameAr: 'توصيل',
    area: 'Online Delivery',
    lat: 29.3759,
    lng: 47.9774,
    isOnline: true,
    aliases: ['taw9eel', 'tawseel', 'taw9eel kw', 'توصيل'],
  },
]

/** Order of the price tuple below. */
const STORE_ORDER = ['mishref-coop', 'khaldiya-coop', 'lulu', 'carrefour', 'taw9eel'] as const

type Seed = Omit<Product, 'id'> & { id: string; prices: [number, number, number, number, number] }

const seed = (
  id: string,
  nameEn: string,
  nameAr: string,
  category: Category,
  unitSize: string,
  aliases: string[],
  prices: [number, number, number, number, number],
): Seed => ({ id, nameEn, nameAr, category, unitSize, aliases, prices })

const SEEDS: Seed[] = [
  // ---------- Dairy ----------
  seed('almarai-fresh-milk-1l', 'Almarai Fresh Milk 1L', 'حليب المراعي كامل الدسم ١ لتر', 'Dairy', '1L',
    ['Almarai Full Fat Milk 1L', 'ALM FF MLK 1L', 'ALMARAI MILK 1L', 'ALM FRESH MILK 1L', 'حليب المراعي', 'حليب المراعي طازج ١ لتر'],
    [0.6, 0.59, 0.55, 0.56, 0.65]),
  seed('almarai-low-fat-milk-2l', 'Almarai Low Fat Milk 2L', 'حليب المراعي قليل الدسم ٢ لتر', 'Dairy', '2L',
    ['ALM LF MLK 2L', 'ALMARAI LOW FAT 2L', 'ALM L/F MILK 2LTR', 'حليب المراعي قليل الدسم'],
    [1.05, 1.05, 0.98, 1.0, 1.15]),
  seed('kiri-square-24', 'Kiri Square Cheese 24pcs', 'جبنة كيري مربعات ٢٤ قطعة', 'Dairy', '24 pcs',
    ['KIRI SQ CHEESE 24', 'KIRI SQUARE 24PCS', 'KIRI CHS SQR 24P', 'جبنة كيري', 'كيري مربعات'],
    [1.45, 1.4, 1.25, 1.3, 1.55]),
  seed('lurpak-unsalted-200', 'Lurpak Unsalted Butter 200g', 'زبدة لورباك غير مملحة ٢٠٠ جرام', 'Dairy', '200g',
    ['LURPAK UNSLT BUTTER 200G', 'LURPAK BUTTER 200G', 'LURPAK UNSALTED 200', 'زبدة لورباك'],
    [1.35, 1.3, 1.15, 1.2, 1.45]),
  seed('rawabi-laban-1l', 'Al Rawabi Laban 1L', 'لبن الروابي ١ لتر', 'Dairy', '1L',
    ['AL RAWABI LABAN 1L', 'RAWABI LBN 1L', 'ALRAWABI LABAN', 'لبن الروابي'],
    [0.45, 0.45, 0.4, 0.42, 0.5]),
  seed('puck-cream-cheese-500', 'Puck Cream Cheese Spread 500g', 'جبنة بوك كريمية ٥٠٠ جرام', 'Dairy', '500g',
    ['PUCK CRM CHEESE 500G', 'PUCK CREAM CHS 500', 'PUCK SPREAD 500G', 'جبنة بوك'],
    [1.65, 1.6, 1.45, 1.5, 1.75]),
  seed('almarai-yoghurt-1kg', 'Almarai Fresh Yoghurt 1kg', 'زبادي المراعي طازج ١ كيلو', 'Dairy', '1kg',
    ['ALM YOGHURT 1KG', 'ALMARAI YOGURT 1KG', 'ALM FRESH YOGHURT', 'زبادي المراعي'],
    [0.85, 0.85, 0.78, 0.8, 0.95]),
  seed('philadelphia-180', 'Philadelphia Cream Cheese 180g', 'جبنة فيلادلفيا كريمية ١٨٠ جرام', 'Dairy', '180g',
    ['PHILADELPHIA CRM CHS 180G', 'PHILLY CREAM CHEESE 180', 'PHILADELPHIA 180G', 'جبنة فيلادلفيا'],
    [1.1, 1.1, 0.99, 1.05, 1.2]),

  // ---------- Pantry ----------
  seed('sadia-chicken-breast-1kg', 'Sadia Chicken Breast 1kg', 'صدور دجاج سادية ١ كيلو', 'Pantry', '1kg',
    ['SADIA CHKN BREAST 1KG', 'SADIA CHICKEN BRST 1K', 'SADIA BREAST FILLET 1KG', 'صدور دجاج سادية', 'دجاج سادية صدور'],
    [2.35, 2.25, 2.1, 2.2, 2.5]),
  seed('indomie-chicken-5', 'Indomie Chicken Noodles 5-pack', 'اندومي نودلز دجاج ٥ حبات', 'Pantry', '5 x 70g',
    ['INDOMIE CHKN NDL 5PK', 'INDOMIE CHICKEN 5X70G', 'INDOMIE NOODLES CHICKEN 5S', 'اندومي دجاج', 'اندومي'],
    [0.75, 0.75, 0.68, 0.7, 0.85]),
  seed('americana-foul-400', 'Americana Foul Medames 400g', 'فول مدمس أمريكانا ٤٠٠ جرام', 'Pantry', '400g',
    ['AMERICANA FOUL MDMS 400G', 'AMERICANA FUL MEDAMES', 'AMRCN FOUL 400G', 'فول مدمس أمريكانا', 'فول أمريكانا'],
    [0.42, 0.4, 0.36, 0.38, 0.5]),
  seed('kfm-flour-1kg', 'Kuwait Flour Mills All-Purpose Flour 1kg', 'طحين مطاحن الدقيق الكويتية ١ كيلو', 'Pantry', '1kg',
    ['KFM ALL PURPOSE FLOUR 1KG', 'KUWAIT FLOUR MILLS 1K', 'KFM FLOUR 1KG', 'KUWAIT FLR MILLS AP 1KG', 'طحين مطاحن الدقيق', 'دقيق الكويت'],
    [0.38, 0.38, 0.35, 0.36, 0.45]),
  seed('goody-spaghetti-500', 'Goody Spaghetti 500g', 'سباغيتي جودي ٥٠٠ جرام', 'Pantry', '500g',
    ['GOODY SPAGHETTI 500G', 'GOODY SPAG 500', 'GOODY PASTA 500G', 'سباغيتي جودي', 'معكرونة جودي'],
    [0.32, 0.32, 0.29, 0.3, 0.38]),
  seed('heinz-ketchup-567', 'Heinz Tomato Ketchup 567g', 'كاتشب هاينز ٥٦٧ جرام', 'Pantry', '567g',
    ['HEINZ KETCHUP 567G', 'HEINZ TOM KETCHUP 567', 'HEINZ TOMATO KTCHP', 'كاتشب هاينز'],
    [0.95, 0.95, 0.85, 0.89, 1.05]),
  seed('tilda-basmati-5kg', 'Tilda Basmati Rice 5kg', 'أرز تيلدا بسمتي ٥ كيلو', 'Pantry', '5kg',
    ['TILDA BASMATI 5KG', 'TILDA BSMTI RICE 5K', 'TILDA RICE 5KG', 'أرز تيلدا', 'رز تيلدا بسمتي'],
    [4.95, 4.85, 4.45, 4.6, 5.25]),
  seed('nutella-350', 'Nutella Hazelnut Spread 350g', 'نوتيلا ٣٥٠ جرام', 'Pantry', '350g',
    ['NUTELLA 350G', 'NUTELLA HZLNT SPRD 350', 'NUTELLA SPREAD 350G', 'نوتيلا'],
    [1.65, 1.6, 1.45, 1.5, 1.8]),

  // ---------- Beverages ----------
  seed('nescafe-classic-200', 'Nescafe Classic 200g', 'نسكافيه كلاسيك ٢٠٠ جرام', 'Beverages', '200g',
    ['NESCAFE CLASSIC 200G', 'NESCAFE CLSSC 200', 'NESCAFE JAR 200G', 'نسكافيه كلاسيك', 'نسكافيه'],
    [3.45, 3.4, 3.1, 3.25, 3.75]),
  seed('evian-6x1.5', 'Evian Water 6x1.5L', 'مياه إيفيان ٦ × ١.٥ لتر', 'Beverages', '6 x 1.5L',
    ['EVIAN WATER 6X1.5L', 'EVIAN 6X1.5LTR', 'EVIAN MINERAL WTR 6PK', 'إيفيان', 'مياه ايفيان'],
    [1.85, 1.85, 1.65, 1.75, 2.1]),
  seed('vimto-710', 'Vimto Cordial 710ml', 'فيمتو عصير مركز ٧١٠ مل', 'Beverages', '710ml',
    ['VIMTO CORDIAL 710ML', 'VIMTO SQUASH 710', 'VIMTO 710ML', 'فيمتو'],
    [1.25, 1.2, 1.1, 1.15, 1.4]),
  seed('lipton-yellow-100', 'Lipton Yellow Label Tea 100 Bags', 'شاي ليبتون يلو ليبل ١٠٠ كيس', 'Beverages', '100 bags',
    ['LIPTON YELLOW LBL 100B', 'LIPTON TEA BAGS 100', 'LIPTON YL TEA 100S', 'شاي ليبتون', 'ليبتون'],
    [1.95, 1.9, 1.75, 1.85, 2.15]),
  seed('redbull-250', 'Red Bull Energy Drink 250ml', 'ريد بول مشروب الطاقة ٢٥٠ مل', 'Beverages', '250ml',
    ['RED BULL 250ML', 'REDBULL ENERGY 250', 'RED BULL ENRGY DRNK', 'ريد بول'],
    [0.65, 0.65, 0.58, 0.6, 0.75]),
  seed('tang-orange-2kg', 'Tang Orange Powder Drink 2kg', 'تانج برتقال ٢ كيلو', 'Beverages', '2kg',
    ['TANG ORANGE 2KG', 'TANG ORNG PWDR 2K', 'TANG DRINK ORANGE 2 KG', 'تانج برتقال', 'تانج'],
    [3.25, 3.2, 2.95, 3.1, 3.55]),
  seed('aquafina-12x500', 'Aquafina Water 12x500ml', 'مياه أكوافينا ١٢ × ٥٠٠ مل', 'Beverages', '12 x 500ml',
    ['AQUAFINA 12X500ML', 'AQUAFINA WTR 12PK', 'AQUAFINA WATER 12X0.5L', 'أكوافينا', 'مياه أكوافينا'],
    [0.75, 0.75, 0.68, 0.7, 0.9]),

  // ---------- Household ----------
  seed('fairy-dish-1l', 'Fairy Dishwashing Liquid 1L', 'سائل جلي فيري ١ لتر', 'Household', '1L',
    ['FAIRY DISHWASH LIQ 1L', 'FAIRY DISH LIQUID 1LTR', 'FAIRY LEMON 1L', 'FAIRY DSHWSH 1L', 'فيري سائل جلي', 'سائل فيري'],
    [1.25, 1.25, 1.1, 1.15, 1.4]),
  seed('kleenex-tissues-5', 'Kleenex Facial Tissues 5-pack', 'مناديل كلينكس ٥ علب', 'Household', '5 boxes',
    ['KLEENEX FACIAL TISSUE 5PK', 'KLEENEX TISSUES 5X', 'KLNX TISSUE 5S', 'مناديل كلينكس', 'كلينكس'],
    [1.95, 1.9, 1.75, 1.8, 2.2]),
  seed('tide-powder-3kg', 'Tide Powder Detergent 3kg', 'مسحوق تايد ٣ كيلو', 'Household', '3kg',
    ['TIDE POWDER 3KG', 'TIDE DETERGENT 3K', 'TIDE PWDR AUTO 3KG', 'مسحوق تايد', 'تايد'],
    [2.95, 2.9, 2.65, 2.75, 3.3]),
  seed('dettol-antiseptic-500', 'Dettol Antiseptic Liquid 500ml', 'ديتول مطهر ٥٠٠ مل', 'Household', '500ml',
    ['DETTOL ANTISEPTIC 500ML', 'DETTOL LIQ 500', 'DETTOL ANTSPTC 500ML', 'ديتول'],
    [1.75, 1.7, 1.55, 1.6, 1.95]),
  seed('downy-softener-2l', 'Downy Fabric Softener 2L', 'داوني منعم أقمشة ٢ لتر', 'Household', '2L',
    ['DOWNY SOFTENER 2L', 'DOWNY FAB SOFT 2LTR', 'DOWNY CONC 2L', 'داوني'],
    [2.45, 2.4, 2.2, 2.3, 2.75]),
  seed('bounty-towels-6', 'Bounty Paper Towels 6-roll', 'مناديل مطبخ باونتي ٦ رولات', 'Household', '6 rolls',
    ['BOUNTY PAPER TOWEL 6R', 'BOUNTY KITCHEN TOWEL 6', 'BOUNTY 6 ROLL', 'باونتي', 'مناديل باونتي'],
    [2.85, 2.8, 2.55, 2.65, 3.15]),
  seed('glad-cling-wrap-200', 'Glad Cling Wrap 200m', 'غلاد لفافة تغليف ٢٠٠ متر', 'Household', '200m',
    ['GLAD CLING WRAP 200M', 'GLAD CLNG WRP 200', 'GLAD FILM 200M', 'غلاد'],
    [1.55, 1.5, 1.35, 1.45, 1.75]),
]

export const SEED_PRODUCTS: Product[] = SEEDS.map(({ prices: _prices, ...product }) => product)

const DAY = 24 * 60 * 60 * 1000

/** Some seed entries are tagged as scans so the "Recent Verified Scans" feed is never empty. */
const sourceFor = (i: number, s: number): { source: PriceSource; confidence: number } => {
  const n = (i * 7 + s * 3) % 10
  if (n === 0) return { source: 'Receipt Scan', confidence: 93 }
  if (n === 5) return { source: 'Shelf Tag', confidence: 82 }
  return { source: 'Initial Index', confidence: 70 + ((i + s) % 4) * 5 }
}

/** Builds a fresh seed snapshot. Timestamps are relative to "now" so data always looks recent. */
/**
 * Historical price multipliers relative to the current price, oldest last.
 * Gives each product/store pair 4 history points (current + 3 older) so
 * Basket Optimizer trends and Price Alerts need no schema change later.
 */
const HISTORY_FACTORS = [1.06, 1.03, 1.08] as const
const HISTORY_AGES_DAYS = [14, 28, 45] as const

/** Deterministic "out of stock" pattern (~1 in 14 pairs) so alerts/optimizer have realistic gaps. */
const isInStock = (i: number, s: number): boolean => (i * 5 + s * 3) % 14 !== 0

export const createSeedData = (): AppData => {
  const now = Date.now()
  const priceEntries: PriceEntry[] = []
  SEEDS.forEach((p, i) => {
    STORE_ORDER.forEach((storeId, s) => {
      const { source, confidence } = sourceFor(i, s)
      const ageDays = 1 + ((i * 3 + s * 5) % 12)
      const ageMs = ageDays * DAY + ((i * 37 + s * 11) % 1000) * 60 * 1000
      const inStock = isInStock(i, s)
      // Price history (older entries first in the array, latest entry last).
      HISTORY_FACTORS.forEach((factor, h) => {
        const wobble = ((i + s + h) % 3) * 0.01
        priceEntries.push({
          id: `seed-${p.id}-${storeId}-h${h}`,
          productId: p.id,
          storeId,
          priceKwd: Math.round((p.prices[s] * (factor + wobble)) / 0.005) * 0.005,
          timestamp: new Date(now - HISTORY_AGES_DAYS[h] * DAY - ageMs).toISOString(),
          source: 'Initial Index',
          confidence: 65,
          inStock: true,
        })
      })
      priceEntries.push({
        id: `seed-${p.id}-${storeId}`,
        productId: p.id,
        storeId,
        priceKwd: p.prices[s],
        timestamp: new Date(now - ageMs).toISOString(),
        source,
        confidence,
        inStock,
      })
    })
  })
  return {
    version: DATA_VERSION,
    products: SEED_PRODUCTS,
    priceEntries,
    scanRecords: [],
  }
}
