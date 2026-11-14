import { DATA_VERSION } from '../data/seedData'
import type { AppData } from '../data/types'

const STORAGE_KEY = 'logta:data:v1'
const LANG_KEY = 'logta:lang'

export const loadData = (): AppData | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppData
    if (
      parsed?.version !== DATA_VERSION ||
      !Array.isArray(parsed.products) ||
      !Array.isArray(parsed.priceEntries) ||
      !Array.isArray(parsed.scanRecords)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export const saveData = (data: AppData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or unavailable: keep running in-memory.
  }
}

export const clearData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export const loadLang = (): 'en' | 'ar' => {
  try {
    return localStorage.getItem(LANG_KEY) === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

export const saveLang = (lang: 'en' | 'ar'): void => {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // ignore
  }
}
