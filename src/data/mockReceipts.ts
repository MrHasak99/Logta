import type { DocumentType } from './types'

export interface MockReceiptLine {
  raw: string
  price: number
}

export interface MockReceipt {
  id: string
  label: string
  storeId: string
  storeHeader: string
  storeSubHeader: string
  documentType: DocumentType
  lines: MockReceiptLine[]
}

/**
 * Built-in sample receipts for one-click testing. These simulate the raw
 * line text printed on real Kuwait receipts; matching to the catalogue
 * is done by the same matcher used for AI output.
 */
export const MOCK_RECEIPTS: MockReceipt[] = [
  {
    id: 'mishref-coop-sample',
    label: 'Mishref Co-op receipt',
    storeId: 'mishref-coop',
    storeHeader: 'MISHREF CO-OP | جمعية مشرف',
    storeSubHeader: 'Block 5, Mishref - Kuwait',
    documentType: 'receipt',
    lines: [
      { raw: 'ALM FF MLK 1L', price: 0.55 },
      { raw: 'KIRI SQ CHEESE 24', price: 1.45 },
      { raw: 'SADIA CHKN BREAST 1KG', price: 2.25 },
      { raw: 'INDOMIE CHKN NDL 5PK', price: 0.75 },
      { raw: 'KLEENEX FACIAL TISSUE 5PK', price: 1.95 },
      { raw: 'FAIRY DISHWASH LIQ 1L', price: 1.35 },
      { raw: 'PLASTIC BAG', price: 0.02 },
    ],
  },
  {
    id: 'lulu-sample',
    label: 'Lulu Hypermarket receipt',
    storeId: 'lulu',
    storeHeader: 'LULU HYPERMARKET',
    storeSubHeader: 'Al-Rai Branch - Kuwait',
    documentType: 'receipt',
    lines: [
      { raw: 'حليب المراعي كامل الدسم ١ لتر', price: 0.54 },
      { raw: 'NESCAFE CLASSIC 200G', price: 3.05 },
      { raw: 'EVIAN WATER 6X1.5L', price: 1.65 },
      { raw: 'LURPAK UNSLT BUTTER 200G', price: 1.15 },
      { raw: 'TIDE POWDER 3KG', price: 2.75 },
      { raw: 'DETTOL LIQ 500', price: 1.55 },
      { raw: 'TILDA BASMATI 5KG', price: 4.45 },
      { raw: 'RED BULL ENRGY DRNK', price: 0.58 },
      { raw: 'FRESH BANANA KG', price: 0.29 },
    ],
  },
]
