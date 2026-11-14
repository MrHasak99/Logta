import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { STORES, createSeedData } from '../data/seedData'
import type { AppData, PriceEntry, Product, ScanRecord, ScanSummary, Store } from '../data/types'
import { makeT, type Lang, type Translate } from '../i18n'
import { applyScan, type CommitInput } from '../services/priceCommit'
import { clearData, loadData, loadLang, saveData, saveLang } from '../utils/storage'

interface AppContextValue {
  stores: Store[]
  products: Product[]
  priceEntries: PriceEntry[]
  scanRecords: ScanRecord[]
  commitScan: (input: CommitInput) => ScanSummary
  resetDemoData: () => void
  lang: Lang
  isRtl: boolean
  toggleLang: () => void
  t: Translate
  productName: (p: Product | undefined) => string
  storeName: (s: Store | undefined) => string
}

const AppContext = createContext<AppContextValue | null>(null)

const initialData = (): AppData => loadData() ?? createSeedData()

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(initialData)
  const [lang, setLang] = useState<Lang>(loadLang)
  const dataRef = useRef(data)

  useEffect(() => {
    dataRef.current = data
    saveData(data)
  }, [data])

  useEffect(() => {
    saveLang(lang)
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  const commitScan = useCallback((input: CommitInput): ScanSummary => {
    const { data: next, summary } = applyScan(dataRef.current, input)
    dataRef.current = next
    setData(next)
    return summary
  }, [])

  const resetDemoData = useCallback(() => {
    clearData()
    const fresh = createSeedData()
    dataRef.current = fresh
    setData(fresh)
  }, [])

  const toggleLang = useCallback(() => setLang((l) => (l === 'en' ? 'ar' : 'en')), [])

  const value = useMemo<AppContextValue>(
    () => ({
      stores: STORES,
      products: data.products,
      priceEntries: data.priceEntries,
      scanRecords: data.scanRecords,
      commitScan,
      resetDemoData,
      lang,
      isRtl: lang === 'ar',
      toggleLang,
      t: makeT(lang),
      productName: (p) => (p ? (lang === 'ar' ? p.nameAr : p.nameEn) : ''),
      storeName: (s) => (s ? (lang === 'ar' ? s.nameAr : s.nameEn) : ''),
    }),
    [data, lang, commitScan, resetDemoData, toggleLang],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
