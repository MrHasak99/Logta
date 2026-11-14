export type Lang = 'en' | 'ar'

const en = {
  appName: 'Logta',
  appTagline: 'Kuwait price scanner',
  resetDemo: 'Reset Demo Data',
  resetConfirm: 'Reset all prices and scans back to the original demo data?',
  switchLang: 'عربي',

  navScanner: 'Scanner',
  navBasket: 'Basket Optimizer',
  navAlerts: 'Price Alerts',

  comingSoon: 'Coming soon',
  basketTitle: 'Basket Optimizer',
  basketDesc:
    'Build your shopping list and see which Kuwait store (or split across stores) gives you the cheapest basket.',
  alertsTitle: 'Price Alerts',
  alertsDesc: 'Get notified when an item on your watchlist drops in price at a store near you.',

  scanTitle: 'AI Receipt & Price Scanner',
  scanSubtitle: 'Snap a receipt or shelf tag. We extract the prices and update the live index.',
  dropTitle: 'Drop a receipt or shelf tag photo',
  dropHint: 'JPG, PNG or WEBP',
  chooseFile: 'Choose photo',
  orDivider: 'or',
  useSample: 'Use Sample Kuwait Receipt',
  sampleHeading: 'Pick a sample',
  sampleBadge: 'Sample receipt',
  removeImage: 'Remove',
  scanNow: 'Scan & Extract Prices',
  badFileType: 'Please choose a JPG, PNG or WEBP image.',
  scanning: 'Extracting bilingual line items & matching catalogue...',
  scanningSub: 'Reading Arabic & English text, then matching to the Kuwait product catalogue',
  modeSimulated: 'Demo mode: simulated extraction',
  modeLive: 'Live AI extraction',

  reviewTitle: 'Review & verify',
  reviewHint: 'Fix any price or product, or remove lines you are unsure about.',
  store: 'Store',
  selectStore: 'Select store',
  storeNotDetected: 'Store not detected - please choose',
  documentType: 'Document type',
  docReceipt: 'Receipt',
  docShelfTag: 'Shelf Tag',
  trustReceipt: 'Receipt: 95% Trust',
  trustShelf: 'Shelf Tag: 80% Trust',
  receiptDate: 'Date',
  item: 'Item',
  rawText: 'Printed as',
  price: 'Price',
  confidence: 'Confidence',
  noMatch: 'No match - choose product',
  lowConfidence: 'Low confidence',
  removeLine: 'Remove line',
  noItemsLeft: 'No items left to confirm.',
  fixLines: 'Match a product (or remove) for {n} line(s) to continue',
  confirm: 'Confirm & Update Live Prices',
  cancel: 'Start over',
  itemsToSave: '{n} item(s) will be saved',

  successTitle: 'Live prices updated',
  itemsAdded: 'New prices added',
  itemsUpdated: 'Prices updated',
  newPriceAt: 'new price at',
  cheaperThanPrev: 'cheaper than previous',
  pricierThanPrev: 'more expensive than previous',
  unchangedPrev: 'same as previous',
  firstPrice: 'first price recorded',
  updatedAt: 'updated at',
  scanAnother: 'Scan another',

  feedTitle: 'Recent Verified Scans',
  feedSubtitle: 'Live prices in the shared index',
  feedEmpty: 'No verified scans yet. Scan a receipt to add the first one.',
  verifiedScans: '{n} scan(s) verified this session',
  confidenceShort: 'conf.',
  srcReceipt: 'Receipt Scan',
  srcShelf: 'Shelf Tag',
  srcInitial: 'Initial Index',
}

export type TKey = keyof typeof en

const ar: Record<TKey, string> = {
  appName: 'لقطة',
  appTagline: 'ماسح أسعار الكويت',
  resetDemo: 'إعادة ضبط البيانات',
  resetConfirm: 'هل تريد إعادة جميع الأسعار والمسوحات إلى بيانات العرض الأصلية؟',
  switchLang: 'English',

  navScanner: 'الماسح',
  navBasket: 'تحسين السلة',
  navAlerts: 'تنبيهات الأسعار',

  comingSoon: 'قريباً',
  basketTitle: 'تحسين السلة',
  basketDesc: 'أنشئ قائمة مشترياتك واعرف أي متجر في الكويت (أو توزيع بين المتاجر) يعطيك أرخص سلة.',
  alertsTitle: 'تنبيهات الأسعار',
  alertsDesc: 'احصل على إشعار عندما ينخفض سعر منتج في قائمة مراقبتك في متجر قريب منك.',

  scanTitle: 'ماسح الفواتير والأسعار بالذكاء الاصطناعي',
  scanSubtitle: 'صوّر فاتورة أو بطاقة سعر. نستخرج الأسعار ونحدّث الفهرس المباشر.',
  dropTitle: 'اسحب صورة فاتورة أو بطاقة سعر',
  dropHint: 'JPG أو PNG أو WEBP',
  chooseFile: 'اختر صورة',
  orDivider: 'أو',
  useSample: 'استخدم فاتورة كويتية تجريبية',
  sampleHeading: 'اختر نموذجاً',
  sampleBadge: 'فاتورة تجريبية',
  removeImage: 'إزالة',
  scanNow: 'امسح واستخرج الأسعار',
  badFileType: 'يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP.',
  scanning: 'جارٍ استخراج البنود ثنائية اللغة ومطابقة الكتالوج...',
  scanningSub: 'قراءة النص العربي والإنجليزي ثم مطابقته مع كتالوج المنتجات الكويتي',
  modeSimulated: 'وضع العرض: استخراج محاكى',
  modeLive: 'استخراج مباشر بالذكاء الاصطناعي',

  reviewTitle: 'مراجعة والتحقق',
  reviewHint: 'صحّح أي سعر أو منتج، أو احذف البنود غير المؤكدة.',
  store: 'المتجر',
  selectStore: 'اختر المتجر',
  storeNotDetected: 'لم يتم التعرف على المتجر - يرجى الاختيار',
  documentType: 'نوع المستند',
  docReceipt: 'فاتورة',
  docShelfTag: 'بطاقة رف',
  trustReceipt: 'فاتورة: ثقة 95%',
  trustShelf: 'بطاقة رف: ثقة 80%',
  receiptDate: 'التاريخ',
  item: 'المنتج',
  rawText: 'كما طُبع',
  price: 'السعر',
  confidence: 'الثقة',
  noMatch: 'لا يوجد تطابق - اختر المنتج',
  lowConfidence: 'ثقة منخفضة',
  removeLine: 'حذف البند',
  noItemsLeft: 'لا توجد بنود للتأكيد.',
  fixLines: 'اختر منتجاً (أو احذف) لعدد {n} بند للمتابعة',
  confirm: 'تأكيد وتحديث الأسعار المباشرة',
  cancel: 'البدء من جديد',
  itemsToSave: 'سيتم حفظ {n} منتج',

  successTitle: 'تم تحديث الأسعار المباشرة',
  itemsAdded: 'أسعار جديدة مضافة',
  itemsUpdated: 'أسعار محدّثة',
  newPriceAt: 'سعر جديد في',
  cheaperThanPrev: 'أرخص من السابق',
  pricierThanPrev: 'أغلى من السابق',
  unchangedPrev: 'نفس السعر السابق',
  firstPrice: 'أول سعر مسجّل',
  updatedAt: 'تم التحديث في',
  scanAnother: 'مسح آخر',

  feedTitle: 'آخر المسوحات الموثّقة',
  feedSubtitle: 'الأسعار المباشرة في الفهرس المشترك',
  feedEmpty: 'لا توجد مسوحات موثّقة بعد. امسح فاتورة لإضافة أول واحدة.',
  verifiedScans: 'تم توثيق {n} مسح في هذه الجلسة',
  confidenceShort: 'ثقة',
  srcReceipt: 'مسح فاتورة',
  srcShelf: 'بطاقة رف',
  srcInitial: 'الفهرس الأولي',
}

export const dictionaries: Record<Lang, Record<TKey, string>> = { en, ar }

export type Translate = (key: TKey, params?: Record<string, string | number>) => string

export const makeT =
  (lang: Lang): Translate =>
  (key, params) => {
    let s = dictionaries[lang][key]
    if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v))
    return s
  }
