/**
 * Static seed catalogue for Logta.
 *
 * ⚠️ HONESTY NOTE: every base price below is an ESTIMATE for demo purposes only
 * (seed_source = 'estimate'). They are plausible Kuwaiti shelf prices in KWD but were
 * NOT collected from any store. Real prices only enter via user photos or the optional
 * data/web_snapshot.json importer (seed_source = 'web_snapshot').
 *
 * Alias conventions in product rows:
 *   'TEXT'   → receipt_shorthand
 *   '~TEXT'  → colloquial (Kuwaiti / everyday wording)
 * Canonical EN + AR aliases are generated from name_en / name_ar automatically.
 */
import type { SizeUnit, StoreType, Volatility } from './schema.ts';

export interface StoreSeed {
  slug: string;
  nameEn: string;
  nameAr: string;
  type: StoreType;
  areaEn: string | null;
  areaAr: string | null;
  lat: number | null;
  lng: number | null;
  deliveryFeeKwd: number | null;
  minOrderKwd: number | null;
  /** Words that identify this store on a receipt header (normalised at runtime). */
  receiptKeywords: string[];
}

// Coordinates are APPROXIMATE (coords_approximate = true) — good enough for a travel-cost estimate.
export const STORES: StoreSeed[] = [
  { slug: 'coop-mishref', nameEn: 'Mishref Co-op', nameAr: 'جمعية مشرف التعاونية', type: 'coop', areaEn: 'Mishref', areaAr: 'مشرف', lat: 29.2745, lng: 48.0655, deliveryFeeKwd: null, minOrderKwd: null, receiptKeywords: ['mishref', 'مشرف'] },
  { slug: 'coop-khaldiya', nameEn: 'Khaldiya Co-op', nameAr: 'جمعية الخالدية التعاونية', type: 'coop', areaEn: 'Khaldiya', areaAr: 'الخالدية', lat: 29.3255, lng: 47.9645, deliveryFeeKwd: null, minOrderKwd: null, receiptKeywords: ['khaldiya', 'khaldiyah', 'الخالديه'] },
  { slug: 'coop-rawda', nameEn: 'Rawda Co-op', nameAr: 'جمعية الروضة التعاونية', type: 'coop', areaEn: 'Rawda', areaAr: 'الروضة', lat: 29.3295, lng: 48.0045, deliveryFeeKwd: null, minOrderKwd: null, receiptKeywords: ['rawda', 'rawdha', 'الروضه'] },
  { slug: 'coop-salwa', nameEn: 'Salwa Co-op', nameAr: 'جمعية سلوى التعاونية', type: 'coop', areaEn: 'Salwa', areaAr: 'سلوى', lat: 29.2955, lng: 48.0785, deliveryFeeKwd: null, minOrderKwd: null, receiptKeywords: ['salwa', 'سلوي'] },
  { slug: 'coop-jabriya', nameEn: 'Jabriya Co-op', nameAr: 'جمعية الجابرية التعاونية', type: 'coop', areaEn: 'Jabriya', areaAr: 'الجابرية', lat: 29.3215, lng: 48.0285, deliveryFeeKwd: null, minOrderKwd: null, receiptKeywords: ['jabriya', 'jabriyah', 'الجابريه'] },
  { slug: 'coop-surra', nameEn: 'Surra Co-op', nameAr: 'جمعية السرة التعاونية', type: 'coop', areaEn: 'Surra', areaAr: 'السرة', lat: 29.3105, lng: 47.9955, deliveryFeeKwd: null, minOrderKwd: null, receiptKeywords: ['surra', 'السره'] },
  { slug: 'coop-qurtuba', nameEn: 'Qurtuba Co-op', nameAr: 'جمعية قرطبة التعاونية', type: 'coop', areaEn: 'Qurtuba', areaAr: 'قرطبة', lat: 29.3085, lng: 47.9805, deliveryFeeKwd: null, minOrderKwd: null, receiptKeywords: ['qurtuba', 'qortuba', 'قرطبه'] },
  { slug: 'coop-adailiya', nameEn: 'Adailiya Co-op', nameAr: 'جمعية العديلية التعاونية', type: 'coop', areaEn: 'Adailiya', areaAr: 'العديلية', lat: 29.3305, lng: 47.9835, deliveryFeeKwd: null, minOrderKwd: null, receiptKeywords: ['adailiya', 'adailiyah', 'العديليه'] },
  { slug: 'lulu-alrai', nameEn: 'Lulu Hypermarket', nameAr: 'لولو هايبرماركت', type: 'hypermarket', areaEn: 'Al-Rai', areaAr: 'الري', lat: 29.2985, lng: 47.9335, deliveryFeeKwd: null, minOrderKwd: null, receiptKeywords: ['lulu', 'لولو'] },
  { slug: 'carrefour-avenues', nameEn: 'Carrefour', nameAr: 'كارفور', type: 'hypermarket', areaEn: 'The Avenues', areaAr: 'الأفنيوز', lat: 29.3035, lng: 47.9395, deliveryFeeKwd: null, minOrderKwd: null, receiptKeywords: ['carrefour', 'كارفور'] },
  { slug: 'tsc-salmiya', nameEn: 'The Sultan Center', nameAr: 'مركز سلطان', type: 'supermarket', areaEn: 'Salmiya', areaAr: 'السالمية', lat: 29.3355, lng: 48.0745, deliveryFeeKwd: null, minOrderKwd: null, receiptKeywords: ['sultan', 'tsc', 'سلطان'] },
  { slug: 'taw9eel', nameEn: 'Taw9eel', nameAr: 'توصيل', type: 'online', areaEn: null, areaAr: null, lat: null, lng: null, deliveryFeeKwd: 0.75, minOrderKwd: 5, receiptKeywords: ['taw9eel', 'tawseel', 'توصيل'] },
];

export interface CategorySeed { slug: string; nameEn: string; nameAr: string; volatility: Volatility }

export const CATEGORIES: CategorySeed[] = [
  { slug: 'dairy_eggs', nameEn: 'Dairy & Eggs', nameAr: 'الألبان والبيض', volatility: 'medium' },
  { slug: 'bakery', nameEn: 'Bakery', nameAr: 'المخبوزات', volatility: 'medium' },
  { slug: 'rice_grains', nameEn: 'Rice, Pasta & Grains', nameAr: 'الأرز والمعكرونة والحبوب', volatility: 'low' },
  { slug: 'oil_ghee', nameEn: 'Oil & Ghee', nameAr: 'الزيوت والسمن', volatility: 'low' },
  { slug: 'sugar_flour_baking', nameEn: 'Sugar, Flour & Baking', nameAr: 'السكر والطحين ومستلزمات الخبز', volatility: 'low' },
  { slug: 'canned_jars', nameEn: 'Canned & Jars', nameAr: 'المعلبات والمرطبانات', volatility: 'low' },
  { slug: 'beverages_water', nameEn: 'Beverages & Water', nameAr: 'المشروبات والمياه', volatility: 'low' },
  { slug: 'tea_coffee', nameEn: 'Tea & Coffee', nameAr: 'الشاي والقهوة', volatility: 'low' },
  { slug: 'snacks_breakfast', nameEn: 'Snacks & Breakfast', nameAr: 'الوجبات الخفيفة والفطور', volatility: 'low' },
  { slug: 'frozen', nameEn: 'Frozen', nameAr: 'المجمدات', volatility: 'medium' },
  { slug: 'meat_poultry', nameEn: 'Meat & Poultry (packaged)', nameAr: 'اللحوم والدواجن المغلفة', volatility: 'medium' },
  { slug: 'produce', nameEn: 'Fresh Produce', nameAr: 'الخضروات والفواكه الطازجة', volatility: 'high' },
  { slug: 'household_cleaning', nameEn: 'Household Cleaning', nameAr: 'المنظفات المنزلية', volatility: 'low' },
  { slug: 'paper_tissue', nameEn: 'Paper & Tissue', nameAr: 'الورقيات والمناديل', volatility: 'low' },
  { slug: 'personal_care', nameEn: 'Personal Care', nameAr: 'العناية الشخصية', volatility: 'low' },
  { slug: 'baby', nameEn: 'Baby', nameAr: 'مستلزمات الأطفال', volatility: 'low' },
];

export interface ProductSeed {
  slug: string;
  brand: string | null;
  nameEn: string;
  nameAr: string;
  category: string;
  sizeValue: number;
  sizeUnit: SizeUnit;
  packCount: number;
  /** ESTIMATED base shelf price in KWD (demo only). */
  basePrice: number;
  substituteGroup: string | null;
  aliases: string[];
  /** Bulky items: lower stocking probability at TSC / online. */
  bulk?: boolean;
}

type Row = [slug: string, brand: string | null, nameEn: string, nameAr: string, size: number, unit: SizeUnit, pack: number, price: number, group: string | null, aliases: string[], bulk?: boolean];

function cat(category: string, rows: Row[]): ProductSeed[] {
  return rows.map(([slug, brand, nameEn, nameAr, sizeValue, sizeUnit, packCount, basePrice, substituteGroup, aliases, bulk]) => ({
    slug, brand, nameEn, nameAr, category, sizeValue, sizeUnit, packCount, basePrice, substituteGroup, aliases, bulk,
  }));
}

export const PRODUCTS: ProductSeed[] = [
  ...cat('dairy_eggs', [
    ['kdd-milk-ff-1l', 'KDD', 'KDD Fresh Milk Full Fat 1L', 'حليب كي دي دي طازج كامل الدسم ١ لتر', 1, 'L', 1, 0.4, 'milk_full_fat_1L', ['KDD F/F MILK 1LTR', 'KDD FF MILK 1L', '~حليب كي دي دي كامل', 'حليب KDD كامل ١ لتر']],
    ['almarai-milk-ff-1l', 'Almarai', 'Almarai Fresh Milk Full Fat 1L', 'حليب المراعي طازج كامل الدسم ١ لتر', 1, 'L', 1, 0.42, 'milk_full_fat_1L', ['ALM FF MLK 1L', 'ALMARAI MILK F/F 1LTR', 'حليب المراعي كامل ١ لتر', '~حليب المراعي']],
    ['nadec-milk-ff-1l', 'Nadec', 'Nadec Fresh Milk Full Fat 1L', 'حليب نادك طازج كامل الدسم ١ لتر', 1, 'L', 1, 0.39, 'milk_full_fat_1L', ['NADEC FF MILK 1L', 'NADEC MLK F/F 1LT']],
    ['almarai-milk-lf-1l', 'Almarai', 'Almarai Fresh Milk Low Fat 1L', 'حليب المراعي طازج قليل الدسم ١ لتر', 1, 'L', 1, 0.42, 'milk_low_fat_1L', ['ALM LF MLK 1L', 'حليب المراعي قليل الدسم ١ لتر']],
    ['kdd-milk-lf-1l', 'KDD', 'KDD Fresh Milk Low Fat 1L', 'حليب كي دي دي طازج قليل الدسم ١ لتر', 1, 'L', 1, 0.4, 'milk_low_fat_1L', ['KDD L/F MILK 1LTR', 'KDD LF MILK 1L']],
    ['almarai-laban-1l', 'Almarai', 'Almarai Laban Full Fat 1L', 'لبن المراعي كامل الدسم ١ لتر', 1, 'L', 1, 0.38, 'laban_1L', ['ALM LABAN FF 1L', '~لبن المراعي']],
    ['kdd-laban-1l', 'KDD', 'KDD Laban 1L', 'لبن كي دي دي ١ لتر', 1, 'L', 1, 0.36, 'laban_1L', ['KDD LABAN 1LTR', '~لبن كي دي دي']],
    ['almarai-yoghurt-1kg', 'Almarai', 'Almarai Full Fat Yoghurt 1kg', 'زبادي المراعي كامل الدسم ١ كيلو', 1, 'kg', 1, 0.65, 'yoghurt_1kg', ['ALM YOG FF 1KG', '~روب المراعي']],
    ['kdd-yoghurt-1kg', 'KDD', 'KDD Full Fat Yoghurt 1kg', 'زبادي كي دي دي كامل الدسم ١ كيلو', 1, 'kg', 1, 0.62, 'yoghurt_1kg', ['KDD YOGHURT 1KG', '~روب كي دي دي']],
    ['almarai-labneh-400g', 'Almarai', 'Almarai Labneh 400g', 'لبنة المراعي ٤٠٠ غرام', 400, 'g', 1, 0.85, 'labneh_400g', ['ALM LABNEH 400G', '~لبنة المراعي']],
    ['puck-cream-cheese-500g', 'Puck', 'Puck Cream Cheese Spread 500g', 'جبنة بوك كريمية قابلة للدهن ٥٠٠ غرام', 500, 'g', 1, 1.95, 'cream_cheese_500g', ['PUCK CRM CHS 500G', '~جبنة بوك', 'PUCK CREAM CHEESE JAR 500G']],
    ['almarai-cream-cheese-500g', 'Almarai', 'Almarai Cream Cheese Spread 500g', 'جبنة المراعي كريمية قابلة للدهن ٥٠٠ غرام', 500, 'g', 1, 1.75, 'cream_cheese_500g', ['ALM CRM CHEESE 500G']],
    ['kiri-cheese-12p', 'Kiri', 'Kiri Cream Cheese 12 Portions 216g', 'جبنة كيري ١٢ قطعة ٢١٦ غرام', 216, 'g', 1, 1.35, 'cheese_portions', ['KIRI 12P 216G', '~جبنة كيري']],
    ['lurpak-butter-200g', 'Lurpak', 'Lurpak Unsalted Butter 200g', 'زبدة لورباك غير مملحة ٢٠٠ غرام', 200, 'g', 1, 1.25, 'butter_200g', ['LURPAK UNSLT BTR 200G', '~زبدة لورباك']],
    ['president-butter-200g', 'Président', 'Président Unsalted Butter 200g', 'زبدة بريزيدنت غير مملحة ٢٠٠ غرام', 200, 'g', 1, 1.05, 'butter_200g', ['PRESIDENT BUTTER 200G', 'PRES UNSLT BTR 200G']],
    ['eggs-white-30', null, 'White Eggs Large 30 pcs', 'بيض أبيض كبير ٣٠ حبة', 30, 'pcs', 1, 1.6, 'eggs_30', ['EGGS WHITE 30PCS', 'EGG WHT L 30S', '~طبق بيض']],
    ['eggs-brown-30', null, 'Brown Eggs Large 30 pcs', 'بيض بني كبير ٣٠ حبة', 30, 'pcs', 1, 1.75, 'eggs_30', ['EGGS BROWN 30PCS', 'EGG BRWN L 30S', '~طبق بيض بني']],
  ]),
  ...cat('bakery', [
    ['kfm-arabic-bread-white', 'KFM', 'KFM Arabic Bread White 5 pcs', 'خبز عربي أبيض مطاحن الدقيق الكويتية ٥ حبات', 5, 'pcs', 1, 0.15, 'arabic_bread_white', ['KFM ARABIC BREAD WHT', 'KFM AR BREAD 5PCS', '~خبز مطاحن', '~خبز عربي']],
    ['kfm-arabic-bread-brown', 'KFM', 'KFM Arabic Bread Brown 5 pcs', 'خبز عربي أسمر مطاحن الدقيق الكويتية ٥ حبات', 5, 'pcs', 1, 0.15, 'arabic_bread_brown', ['KFM ARABIC BREAD BRN', '~خبز أسمر']],
    ['kfm-toast-white-600g', 'KFM', 'KFM White Toast Bread 600g', 'خبز توست أبيض مطاحن الدقيق الكويتية ٦٠٠ غرام', 600, 'g', 1, 0.35, 'toast_white', ['KFM TOAST WHT 600G', '~توست مطاحن']],
    ['lusine-toast-white-600g', "L'usine", "L'usine White Sliced Bread 600g", 'خبز لوزين أبيض شرائح ٦٠٠ غرام', 600, 'g', 1, 0.45, 'toast_white', ['L USINE TOAST 600G', 'LUSINE WHT BREAD 600G', '~توست لوزين']],
    ['kfm-samoon-6', 'KFM', 'KFM Samoon Bread 6 pcs', 'صمون مطاحن الدقيق الكويتية ٦ حبات', 6, 'pcs', 1, 0.25, 'samoon', ['KFM SAMOON 6PCS', '~صمون']],
    ['kfm-burger-buns-6', 'KFM', 'KFM Burger Buns 6 pcs', 'خبز برجر مطاحن الدقيق الكويتية ٦ حبات', 6, 'pcs', 1, 0.3, 'burger_buns_6', ['KFM BURGER BUN 6S']],
    ['lusine-burger-buns-6', "L'usine", "L'usine Burger Buns 6 pcs", 'خبز برجر لوزين ٦ حبات', 6, 'pcs', 1, 0.4, 'burger_buns_6', ['LUSINE BURGER BUNS 6PC']],
    ['mission-tortilla-8', 'Mission', 'Mission Plain Tortilla Wraps 8 pcs', 'خبز تورتيلا ميشن سادة ٨ حبات', 8, 'pcs', 1, 0.85, 'tortilla_8', ['MISSION TORTILLA 8S', 'MISSION WRAPS PLAIN 8PC']],
  ]),
  ...cat('rice_grains', [
    ['tilda-basmati-5kg', 'Tilda', 'Tilda Pure Basmati Rice 5kg', 'أرز تيلدا بسمتي ٥ كيلو', 5, 'kg', 1, 4.95, 'rice_basmati_5kg', ['TILDA BSMTI 5KG', 'TILDA PURE BASMATI 5KG', '~عيش تيلدا', 'رز تيلدا ٥ كيلو'], true],
    ['abukass-basmati-5kg', 'Abu Kass', 'Abu Kass Basmati Rice 5kg', 'أرز أبو كاس بسمتي ٥ كيلو', 5, 'kg', 1, 4.25, 'rice_basmati_5kg', ['ABU KAS RICE 5KG', 'ABUKASS BSMT 5KG', '~عيش ابو كاس'], true],
    ['mahmood-basmati-5kg', 'Mahmood', 'Mahmood Basmati Rice 5kg', 'أرز محمود بسمتي ٥ كيلو', 5, 'kg', 1, 3.9, 'rice_basmati_5kg', ['MAHMOOD BSMT 5KG', '~عيش محمود'], true],
    ['tilda-basmati-2kg', 'Tilda', 'Tilda Pure Basmati Rice 2kg', 'أرز تيلدا بسمتي ٢ كيلو', 2, 'kg', 1, 2.15, 'rice_basmati_2kg', ['TILDA BSMTI 2KG', 'TILDA BASMATI 2KG']],
    ['abukass-basmati-2kg', 'Abu Kass', 'Abu Kass Basmati Rice 2kg', 'أرز أبو كاس بسمتي ٢ كيلو', 2, 'kg', 1, 1.85, 'rice_basmati_2kg', ['ABU KAS RICE 2KG']],
    ['royal-umbrella-jasmine-5kg', 'Royal Umbrella', 'Royal Umbrella Thai Jasmine Rice 5kg', 'أرز رويال أمبريلا ياسمين تايلندي ٥ كيلو', 5, 'kg', 1, 3.75, 'rice_jasmine_5kg', ['ROYAL UMBRELLA JASMINE 5KG', 'RU JASMINE RICE 5KG'], true],
    ['sunwhite-calrose-5kg', 'Sunwhite', 'Sunwhite Calrose Rice 5kg', 'أرز صن وايت كالروز ٥ كيلو', 5, 'kg', 1, 3.45, 'rice_calrose_5kg', ['SUNWHITE CALROSE 5KG', '~عيش مصري صن وايت'], true],
    ['barilla-spaghetti-500g', 'Barilla', 'Barilla Spaghetti No.5 500g', 'سباغيتي باريلا رقم ٥ ٥٠٠ غرام', 500, 'g', 1, 0.45, 'pasta_spaghetti_500g', ['BARILLA SPAG N5 500G', '~معكرونة باريلا']],
    ['kfm-spaghetti-500g', 'KFM', 'KFM Spaghetti 500g', 'سباغيتي مطاحن الدقيق الكويتية ٥٠٠ غرام', 500, 'g', 1, 0.25, 'pasta_spaghetti_500g', ['KFM SPAGHETTI 500G', '~معكرونة مطاحن']],
    ['kfm-vermicelli-400g', 'KFM', 'KFM Vermicelli 400g', 'شعيرية مطاحن الدقيق الكويتية ٤٠٠ غرام', 400, 'g', 1, 0.2, 'vermicelli_400g', ['KFM VERMICELLI 400G', '~شعيرية']],
    ['red-lentils-1kg', null, 'Red Lentils 1kg', 'عدس أحمر ١ كيلو', 1, 'kg', 1, 0.75, 'lentils_red_1kg', ['RED LENTILS 1KG', '~عدس']],
  ]),
  ...cat('oil_ghee', [
    ['afia-corn-oil-1.8l', 'Afia', 'Afia Pure Corn Oil 1.8L', 'زيت ذرة عافية نقي ١٫٨ لتر', 1.8, 'L', 1, 1.65, 'oil_corn_1.8L', ['AFIA CORN OIL 1.8L', 'AFIA CRN OIL 1.8LTR', '~زيت عافية'], true],
    ['mazola-corn-oil-1.8l', 'Mazola', 'Mazola Corn Oil 1.8L', 'زيت ذرة مازولا ١٫٨ لتر', 1.8, 'L', 1, 1.75, 'oil_corn_1.8L', ['MAZOLA CORN OIL 1.8L', '~زيت مازولا'], true],
    ['noor-sunflower-1.8l', 'Noor', 'Noor Sunflower Oil 1.8L', 'زيت دوار الشمس نور ١٫٨ لتر', 1.8, 'L', 1, 1.45, 'oil_sunflower_1.8L', ['NOOR SUNFLWR OIL 1.8L', '~زيت نور'], true],
    ['afia-sunflower-1.8l', 'Afia', 'Afia Sunflower Oil 1.8L', 'زيت دوار الشمس عافية ١٫٨ لتر', 1.8, 'L', 1, 1.55, 'oil_sunflower_1.8L', ['AFIA SUNFLOWER 1.8L'], true],
    ['borges-olive-oil-500ml', 'Borges', 'Borges Extra Virgin Olive Oil 500ml', 'زيت زيتون بورجيس بكر ممتاز ٥٠٠ مل', 500, 'ml', 1, 1.95, 'oil_olive_500ml', ['BORGES EV OLIVE OIL 500ML', '~زيت زيتون بورجيس']],
    ['bertolli-olive-oil-500ml', 'Bertolli', 'Bertolli Extra Virgin Olive Oil 500ml', 'زيت زيتون بيرتولي بكر ممتاز ٥٠٠ مل', 500, 'ml', 1, 2.25, 'oil_olive_500ml', ['BERTOLLI EVOO 500ML']],
    ['dalda-veg-ghee-1l', 'Dalda', 'Dalda Vegetable Ghee 1L', 'سمن نباتي Dalda ١ لتر', 1, 'L', 1, 1.25, 'ghee_veg_1L', ['DALDA VEG GHEE 1L', '~سمن دالدا']],
  ]),
  ...cat('sugar_flour_baking', [
    ['khaleej-sugar-2kg', 'Al Khaleej', 'Al Khaleej White Sugar 2kg', 'سكر الخليج أبيض ناعم ٢ كيلو', 2, 'kg', 1, 0.65, 'sugar_white_2kg', ['KHALEEJ SUGAR 2KG', 'AL KHALEEJ SGR 2KG', '~شكر الخليج']],
    ['savola-sugar-2kg', 'Savola', 'Savola White Sugar 2kg', 'سكر صافولا أبيض ٢ كيلو', 2, 'kg', 1, 0.7, 'sugar_white_2kg', ['SAVOLA SUGAR 2KG', '~شكر صافولا']],
    ['kfm-flour-no1-2kg', 'KFM', 'KFM Patent Flour No.1 2kg', 'طحين مطاحن الدقيق الكويتية رقم ١ ٢ كيلو', 2, 'kg', 1, 0.5, 'flour_white_2kg', ['KFM FLOUR NO1 2KG', '~طحين مطاحن']],
    ['kfm-flour-brown-2kg', 'KFM', 'KFM Whole Wheat Flour 2kg', 'طحين أسمر مطاحن الدقيق الكويتية ٢ كيلو', 2, 'kg', 1, 0.55, 'flour_brown_2kg', ['KFM FLOUR BRN 2KG', '~طحين أسمر']],
    ['fosterclark-custard-300g', "Foster Clark's", "Foster Clark's Custard Powder 300g", 'مسحوق كاسترد فوستر كلاركس ٣٠٠ غرام', 300, 'g', 1, 0.65, 'custard_300g', ['FOSTER CLARK CUSTARD 300G', '~كاسترد']],
    ['fosterclark-baking-powder-100g', "Foster Clark's", "Foster Clark's Baking Powder 100g", 'بيكنج باودر فوستر كلاركس ١٠٠ غرام', 100, 'g', 1, 0.35, 'baking_powder_100g', ['FOSTER CLARK BAKING PWD 100G']],
    ['table-salt-1kg', null, 'Iodised Table Salt 1kg', 'ملح طعام مدعم باليود ١ كيلو', 1, 'kg', 1, 0.15, 'salt_1kg', ['TABLE SALT 1KG', '~ملح']],
  ]),
  ...cat('canned_jars', [
    ['alalali-tuna-185g', 'Al Alali', 'Al Alali Light Meat Tuna in Oil 185g', 'تونة العلالي قطع خفيفة بالزيت ١٨٥ غرام', 185, 'g', 1, 0.55, 'tuna_185g', ['ALALI TUNA 185G', 'AL ALALI LT TUNA OIL 185G', '~تونة العلالي']],
    ['goody-tuna-185g', 'Goody', 'Goody Light Meat Tuna in Oil 185g', 'تونة قودي قطع خفيفة بالزيت ١٨٥ غرام', 185, 'g', 1, 0.5, 'tuna_185g', ['GOODY TUNA 185G', '~تونة قودي']],
    ['alalali-tomato-paste-135g', 'Al Alali', 'Al Alali Tomato Paste 135g', 'معجون طماطم العلالي ١٣٥ غرام', 135, 'g', 1, 0.15, 'tomato_paste_135g', ['ALALI TOM PASTE 135G', '~معجون طماط']],
    ['heinz-ketchup-570g', 'Heinz', 'Heinz Tomato Ketchup 570g', 'كاتشب هاينز ٥٧٠ غرام', 570, 'g', 1, 0.95, 'ketchup', ['HEINZ KETCHUP 570G', '~كاتشب هاينز']],
    ['alalali-sweetcorn-400g', 'Al Alali', 'Al Alali Sweet Corn 400g', 'ذرة حلوة العلالي ٤٠٠ غرام', 400, 'g', 1, 0.35, 'sweetcorn_400g', ['ALALI SWEET CORN 400G']],
    ['alalali-chickpeas-400g', 'Al Alali', 'Al Alali Chickpeas 400g', 'حمص حب العلالي ٤٠٠ غرام', 400, 'g', 1, 0.25, 'chickpeas_400g', ['ALALI CHICKPEAS 400G', '~نخي']],
    ['californiagarden-foul-400g', 'California Garden', 'California Garden Fava Beans 400g', 'فول مدمس كاليفورنيا جاردن ٤٠٠ غرام', 400, 'g', 1, 0.25, 'foul_400g', ['CAL GARDEN FOUL 400G', 'CG FAVA BEANS 400G', '~فول']],
    ['alalali-foul-400g', 'Al Alali', 'Al Alali Fava Beans 400g', 'فول مدمس العلالي ٤٠٠ غرام', 400, 'g', 1, 0.23, 'foul_400g', ['ALALI FOUL MEDAMES 400G']],
    ['hellmanns-mayo-400ml', "Hellmann's", "Hellmann's Real Mayonnaise 400ml", 'مايونيز هيلمانز ٤٠٠ مل', 400, 'ml', 1, 1.15, 'mayonnaise', ['HELLMANNS MAYO 400ML', '~مايونيز']],
  ]),
  ...cat('beverages_water', [
    ['rawdatain-water-1.5l-6', 'Rawdatain', 'Rawdatain Water 1.5L × 6', 'مياه الروضتين ١٫٥ لتر × ٦', 1.5, 'L', 6, 0.55, 'water_1.5L_6pk', ['RAWDATAIN 1.5L*6', 'RAWDATAIN WATER 6X1.5L', '~ماي روضتين'], true],
    ['abraaj-water-1.5l-6', 'Abraaj', 'Abraaj Water 1.5L × 6', 'مياه أبراج ١٫٥ لتر × ٦', 1.5, 'L', 6, 0.5, 'water_1.5L_6pk', ['ABRAAJ 1.5L X6', 'ABRAAJ WATER 6X1.5L', '~ماي أبراج'], true],
    ['aquafina-water-1.5l-6', 'Aquafina', 'Aquafina Water 1.5L × 6', 'مياه أكوافينا ١٫٥ لتر × ٦', 1.5, 'L', 6, 0.65, 'water_1.5L_6pk', ['AQUAFINA 6X1.5L'], true],
    ['rawdatain-water-330ml-12', 'Rawdatain', 'Rawdatain Water 330ml × 12', 'مياه الروضتين ٣٣٠ مل × ١٢', 330, 'ml', 12, 0.75, 'water_330ml_12pk', ['RAWDATAIN 330ML*12', '~ماي روضتين صغير']],
    ['vimto-710ml', 'Vimto', 'Vimto Fruit Cordial 710ml', 'شراب فيمتو ٧١٠ مل', 710, 'ml', 1, 0.95, 'cordial_710ml', ['VIMTO 710ML', 'VIMTO CORDIAL 710ML', '~فيمتو']],
    ['pepsi-can-330-6', 'Pepsi', 'Pepsi Cans 330ml × 6', 'بيبسي علب ٣٣٠ مل × ٦', 330, 'ml', 6, 1.2, 'cola_can_6pk', ['PEPSI CAN 6X330ML', 'PEPSI 330ML*6', '~بيبسي']],
    ['cocacola-can-330-6', 'Coca-Cola', 'Coca-Cola Cans 330ml × 6', 'كوكاكولا علب ٣٣٠ مل × ٦', 330, 'ml', 6, 1.25, 'cola_can_6pk', ['COCA COLA CAN 6X330ML', 'COKE 330ML*6', '~كوكاكولا']],
    ['7up-can-330-6', '7UP', '7UP Cans 330ml × 6', 'سفن أب علب ٣٣٠ مل × ٦', 330, 'ml', 6, 1.15, 'lemon_soda_6pk', ['7UP CAN 6X330ML', '~سفن اب']],
    ['almarai-orange-juice-1l', 'Almarai', 'Almarai Orange Juice 1L', 'عصير برتقال المراعي ١ لتر', 1, 'L', 1, 0.65, 'juice_orange_1L', ['ALM ORNG JUICE 1L', '~عصير المراعي برتقال']],
    ['kdd-orange-juice-1l', 'KDD', 'KDD Orange Juice 1L', 'عصير برتقال كي دي دي ١ لتر', 1, 'L', 1, 0.6, 'juice_orange_1L', ['KDD ORANGE JCE 1L', '~عصير كي دي دي برتقال']],
  ]),
  ...cat('tea_coffee', [
    ['lipton-yellow-label-100', 'Lipton', 'Lipton Yellow Label Tea 100 Bags', 'شاي ليبتون العلامة الصفراء ١٠٠ كيس', 100, 'pcs', 1, 1.2, 'tea_bags_100', ['LIPTON YL TEA 100S', 'LIPTON YELLOW LBL 100 BAGS', '~شاي ليبتون']],
    ['rabea-tea-100', 'Rabea', 'Rabea Tea 100 Bags', 'شاي ربيع ١٠٠ كيس', 100, 'pcs', 1, 1.05, 'tea_bags_100', ['RABEA TEA 100S', '~شاي ربيع']],
    ['ahmad-tea-100', 'Ahmad Tea', 'Ahmad Tea English Breakfast 100 Bags', 'شاي أحمد إفطار إنجليزي ١٠٠ كيس', 100, 'pcs', 1, 1.15, 'tea_bags_100', ['AHMAD TEA ENG BRKFST 100S']],
    ['alwazah-tea-400g', 'Alwazah', 'Alwazah Loose Ceylon Tea 400g', 'شاي الوزة سيلاني ٤٠٠ غرام', 400, 'g', 1, 2.25, 'tea_loose_400g', ['ALWAZAH TEA 400G', '~شاي الوزة']],
    ['nescafe-classic-200g', 'Nescafé', 'Nescafé Classic Instant Coffee 200g', 'نسكافيه كلاسيك قهوة سريعة التحضير ٢٠٠ غرام', 200, 'g', 1, 3.45, 'coffee_instant_200g', ['NESCAFE CLASSIC 200G', 'NESC CLSC 200G', '~نسكافيه']],
    ['nescafe-gold-100g', 'Nescafé', 'Nescafé Gold Instant Coffee 100g', 'نسكافيه جولد قهوة سريعة التحضير ١٠٠ غرام', 100, 'g', 1, 3.25, 'coffee_instant_gold_100g', ['NESCAFE GOLD 100G']],
    ['nescafe-3in1-30', 'Nescafé', 'Nescafé 3in1 Classic 30 Sticks', 'نسكافيه ٣ في ١ كلاسيك ٣٠ كيس', 30, 'pcs', 1, 2.1, 'coffee_3in1_30', ['NESCAFE 3IN1 30S', '~نسكافيه ثري ان ون']],
    ['coffeemate-400g', 'Nestlé', 'Nestlé Coffee-mate Creamer 400g', 'مبيض القهوة كوفي ميت من نستله ٤٠٠ غرام', 400, 'g', 1, 1.55, 'creamer_400g', ['COFFEEMATE 400G', '~كوفي ميت']],
  ]),
  ...cat('snacks_breakfast', [
    ['indomie-chicken-5', 'Indomie', 'Indomie Chicken Noodles 75g × 5', 'إندومي نودلز بنكهة الدجاج ٧٥ غرام × ٥', 75, 'g', 5, 0.45, 'noodles_5pk', ['INDOMIE CHKN 5X75G', 'INDOMIE CHICKEN 5PK', '~اندومي']],
    ['maggi-chicken-5', 'Maggi', 'Maggi Chicken Noodles 77g × 5', 'ماجي نودلز بنكهة الدجاج ٧٧ غرام × ٥', 77, 'g', 5, 0.5, 'noodles_5pk', ['MAGGI NOODLES CHKN 5X77G', '~ماجي']],
    ['nutella-350g', 'Nutella', 'Nutella Hazelnut Spread 350g', 'نوتيلا كريمة البندق ٣٥٠ غرام', 350, 'g', 1, 1.65, 'choc_spread_350g', ['NUTELLA 350G', '~نوتيلا']],
    ['kelloggs-cornflakes-375g', "Kellogg's", "Kellogg's Corn Flakes 375g", 'كورن فليكس كيلوجز ٣٧٥ غرام', 375, 'g', 1, 1.25, 'cornflakes', ['KELLOGGS CORN FLAKES 375G', '~كورن فليكس']],
    ['nestle-cornflakes-375g', 'Nestlé', 'Nestlé Corn Flakes 375g', 'كورن فليكس نستله ٣٧٥ غرام', 375, 'g', 1, 1.1, 'cornflakes', ['NESTLE CORNFLAKES 375G']],
    ['lays-salted-160g', "Lay's", "Lay's Salted Chips 160g", 'شيبس ليز بالملح ١٦٠ غرام', 160, 'g', 1, 0.55, 'chips', ['LAYS SALTED 160G', '~شيبس ليز']],
    ['pringles-original-165g', 'Pringles', 'Pringles Original 165g', 'برينجلز الأصلي ١٦٥ غرام', 165, 'g', 1, 0.75, 'chips', ['PRINGLES ORIG 165G', '~برينجلز']],
    ['hero-strawberry-jam-450g', 'Hero', 'Hero Strawberry Jam 450g', 'مربى فراولة هيرو ٤٥٠ غرام', 450, 'g', 1, 0.95, 'jam_strawberry', ['HERO STRWB JAM 450G', '~مربى فراولة']],
    ['quaker-oats-500g', 'Quaker', 'Quaker Oats 500g', 'شوفان كويكر ٥٠٠ غرام', 500, 'g', 1, 0.95, 'oats_500g', ['QUAKER OATS 500G', '~شوفان']],
  ]),
  ...cat('frozen', [
    ['sadia-whole-chicken-1000g', 'Sadia', 'Sadia Frozen Whole Chicken 1000g', 'دجاج كامل مجمد ساديا ١٠٠٠ غرام', 1000, 'g', 1, 0.95, 'chicken_frozen_whole_1kg', ['SADIA CHKN 1000G', 'SADIA WHOLE CHICKEN 1KG', '~دياي ساديا']],
    ['seara-whole-chicken-1000g', 'Seara', 'Seara Frozen Whole Chicken 1000g', 'دجاج كامل مجمد Seara ١٠٠٠ غرام', 1000, 'g', 1, 0.9, 'chicken_frozen_whole_1kg', ['SEARA CHKN 1000G', '~دياي سيارا']],
    ['sadia-chicken-breast-1kg', 'Sadia', 'Sadia Frozen Chicken Breast 1kg', 'صدور دجاج مجمدة ساديا ١ كيلو', 1, 'kg', 1, 2.25, 'chicken_breast_frozen_1kg', ['SADIA CHKN BREAST 1KG', '~صدور دياي ساديا']],
    ['alkabeer-nuggets-750g', 'Al Kabeer', 'Al Kabeer Chicken Nuggets 750g', 'ناجتس دجاج الكبير ٧٥٠ غرام', 750, 'g', 1, 1.65, 'nuggets_750g', ['AL KABEER NUGGETS 750G', '~ناجتس الكبير']],
    ['americana-nuggets-750g', 'Americana', 'Americana Chicken Nuggets 750g', 'ناجتس دجاج أمريكانا ٧٥٠ غرام', 750, 'g', 1, 1.55, 'nuggets_750g', ['AMERICANA NUGGETS 750G', '~ناجتس امريكانا']],
    ['americana-mixed-veg-400g', 'Americana', 'Americana Mixed Vegetables 400g', 'خضار مشكلة أمريكانا ٤٠٠ غرام', 400, 'g', 1, 0.45, 'frozen_veg_mixed_400g', ['AMERICANA MIXED VEG 400G']],
    ['alkabeer-mixed-veg-400g', 'Al Kabeer', 'Al Kabeer Mixed Vegetables 400g', 'خضار مشكلة الكبير ٤٠٠ غرام', 400, 'g', 1, 0.42, 'frozen_veg_mixed_400g', ['AL KABEER MIX VEG 400G', '~خضار مشكل']],
    ['mccain-fries-1kg', 'McCain', 'McCain Straight Cut Fries 1kg', 'بطاطس مقلية ماكين ١ كيلو', 1, 'kg', 1, 0.95, 'fries_1kg', ['MCCAIN FRIES 1KG', '~بطاط ماكين']],
    ['americana-fries-1kg', 'Americana', 'Americana French Fries 1kg', 'بطاطس مقلية أمريكانا ١ كيلو', 1, 'kg', 1, 0.85, 'fries_1kg', ['AMERICANA FRIES 1KG']],
  ]),
  ...cat('meat_poultry', [
    ['kupco-fresh-chicken-1kg', 'KUPCO', 'KUPCO Fresh Whole Chicken 1kg', 'دجاج طازج كامل KUPCO ١ كيلو', 1, 'kg', 1, 1.35, 'chicken_fresh_whole_1kg', ['KUPCO FRSH CHKN 1KG', '~دياي طازج']],
    ['alwataniya-fresh-chicken-1kg', 'Al Wataniya', 'Al Wataniya Fresh Whole Chicken 1kg', 'دجاج الوطنية طازج كامل ١ كيلو', 1, 'kg', 1, 1.3, 'chicken_fresh_whole_1kg', ['WATANIYA FRESH CHKN 1KG', '~دياي الوطنية']],
    ['kupco-chicken-breast-500g', 'KUPCO', 'KUPCO Fresh Chicken Breast 500g', 'صدور دجاج طازجة KUPCO ٥٠٠ غرام', 500, 'g', 1, 1.35, 'chicken_breast_fresh_500g', ['KUPCO BREAST 500G', '~صدور دياي طازج']],
    ['beef-mince-500g', null, 'Fresh Minced Beef 500g', 'لحم بقري مفروم طازج ٥٠٠ غرام', 500, 'g', 1, 1.65, 'beef_mince_500g', ['BEEF MINCE 500G', '~لحم مفروم']],
    ['alkabeer-beef-burger-12', 'Al Kabeer', 'Al Kabeer Beef Burgers 12 pcs', 'برجر لحم بقري الكبير ١٢ حبة', 12, 'pcs', 1, 1.75, 'beef_burger_12', ['AL KABEER BEEF BURGER 12S', '~برجر الكبير']],
    ['siniora-franks-340g', 'Siniora', 'Siniora Chicken Franks 340g', 'نقانق دجاج سنيورة ٣٤٠ غرام', 340, 'g', 1, 0.75, 'franks_340g', ['SINIORA CHKN FRANKS 340G', '~نقانق سنيورة']],
    ['siniora-mortadella-500g', 'Siniora', 'Siniora Chicken Mortadella 500g', 'مرتديلا دجاج سنيورة ٥٠٠ غرام', 500, 'g', 1, 0.85, 'mortadella_500g', ['SINIORA MORTADELLA 500G', '~مرتديلا']],
  ]),
  ...cat('produce', [
    ['tomato-1kg', null, 'Tomatoes 1kg', 'طماطم ١ كيلو', 1, 'kg', 1, 0.35, 'tomato_kg', ['TOMATO KG', 'TOMATOES LOOSE 1KG', '~طماط']],
    ['cucumber-1kg', null, 'Cucumbers 1kg', 'خيار ١ كيلو', 1, 'kg', 1, 0.4, 'cucumber_kg', ['CUCUMBER KG', '~خيار']],
    ['onion-red-1kg', null, 'Red Onions 1kg', 'بصل أحمر ١ كيلو', 1, 'kg', 1, 0.25, 'onion_kg', ['ONION RED KG', '~بصل']],
    ['potato-1kg', null, 'Potatoes 1kg', 'بطاطا ١ كيلو', 1, 'kg', 1, 0.3, 'potato_kg', ['POTATO KG', '~بطاط']],
    ['carrot-1kg', null, 'Carrots 1kg', 'جزر ١ كيلو', 1, 'kg', 1, 0.35, 'carrot_kg', ['CARROT KG', '~جزر']],
    ['garlic-1kg', null, 'Garlic 1kg', 'ثوم ١ كيلو', 1, 'kg', 1, 0.9, 'garlic_kg', ['GARLIC KG', '~ثوم']],
    ['banana-1kg', null, 'Bananas 1kg', 'موز ١ كيلو', 1, 'kg', 1, 0.45, 'banana_kg', ['BANANA KG', '~موز']],
    ['apple-red-1kg', null, 'Red Apples 1kg', 'تفاح أحمر ١ كيلو', 1, 'kg', 1, 0.65, 'apple_red_kg', ['APPLE RED KG', '~تفاح']],
    ['orange-1kg', null, 'Oranges 1kg', 'برتقال ١ كيلو', 1, 'kg', 1, 0.45, 'orange_kg', ['ORANGE KG', '~برتقال']],
    ['lemon-1kg', null, 'Lemons 1kg', 'ليمون ١ كيلو', 1, 'kg', 1, 0.55, 'lemon_kg', ['LEMON KG', '~لومي اخضر']],
    ['lettuce-iceberg', null, 'Iceberg Lettuce 1 pc', 'خس آيسبرغ حبة واحدة', 1, 'pcs', 1, 0.3, 'lettuce_pc', ['LETTUCE ICEBERG PC', '~خس']],
    ['parsley-bunch', null, 'Parsley 1 bunch', 'بقدونس ربطة واحدة', 1, 'pcs', 1, 0.1, 'parsley_bunch', ['PARSLEY BUNCH', '~بقدونس']],
  ]),
  ...cat('household_cleaning', [
    ['fairy-lemon-750ml', 'Fairy', 'Fairy Lemon Dishwashing Liquid 750ml', 'سائل غسيل الصحون فيري بالليمون ٧٥٠ مل', 750, 'ml', 1, 0.95, 'dish_liquid_750ml', ['FAIRY LEMON 750ML', 'FAIRY DISH LIQ LMN 750ML', '~فيري']],
    ['pril-lemon-750ml', 'Pril', 'Pril Lemon Dishwashing Liquid 750ml', 'سائل غسيل الصحون بريل بالليمون ٧٥٠ مل', 750, 'ml', 1, 0.75, 'dish_liquid_750ml', ['PRIL LEMON 750ML', '~بريل']],
    ['ariel-powder-2.5kg', 'Ariel', 'Ariel Automatic Laundry Powder 2.5kg', 'مسحوق غسيل آريال أوتوماتيك ٢٫٥ كيلو', 2.5, 'kg', 1, 3.25, 'laundry_powder_2.5kg', ['ARIEL AUTO 2.5KG', 'ARIEL AUT PWD 2.5KG', '~تايد آريال'], true],
    ['tide-powder-2.5kg', 'Tide', 'Tide Automatic Laundry Powder 2.5kg', 'مسحوق غسيل تايد أوتوماتيك ٢٫٥ كيلو', 2.5, 'kg', 1, 2.95, 'laundry_powder_2.5kg', ['TIDE AUTO 2.5KG', '~تايد'], true],
    ['persil-gel-3l', 'Persil', 'Persil Power Gel 3L', 'برسيل باور جل ٣ لتر', 3, 'L', 1, 3.45, 'laundry_gel_3L', ['PERSIL GEL 3L', '~برسيل جل'], true],
    ['ariel-gel-3l', 'Ariel', 'Ariel Liquid Detergent 3L', 'سائل غسيل آريال ٣ لتر', 3, 'L', 1, 3.65, 'laundry_gel_3L', ['ARIEL LIQUID 3L'], true],
    ['clorox-bleach-3.78l', 'Clorox', 'Clorox Original Bleach 3.78L', 'مبيض كلوركس الأصلي ٣٫٧٨ لتر', 3.78, 'L', 1, 1.25, 'bleach_3.78L', ['CLOROX 3.78L', 'CLOROX BLEACH ORIG 3.78L', '~كلوركس'], true],
    ['dettol-antiseptic-500ml', 'Dettol', 'Dettol Antiseptic Liquid 500ml', 'سائل ديتول مطهر ٥٠٠ مل', 500, 'ml', 1, 1.75, 'antiseptic_500ml', ['DETTOL ANTISEP 500ML', '~ديتول']],
    ['harpic-750ml', 'Harpic', 'Harpic Toilet Cleaner 750ml', 'منظف المراحيض هاربيك ٧٥٠ مل', 750, 'ml', 1, 0.85, 'toilet_cleaner_750ml', ['HARPIC 750ML', '~هاربيك']],
    ['downy-softener-1.5l', 'Downy', 'Downy Fabric Softener 1.5L', 'منعم الأقمشة داوني ١٫٥ لتر', 1.5, 'L', 1, 1.25, 'softener_1.5L', ['DOWNY 1.5L', '~داوني']],
    ['comfort-softener-1.5l', 'Comfort', 'Comfort Fabric Softener 1.5L', 'منعم الأقمشة كومفورت ١٫٥ لتر', 1.5, 'L', 1, 1.15, 'softener_1.5L', ['COMFORT SOFTENER 1.5L', '~كومفورت']],
  ]),
  ...cat('paper_tissue', [
    ['fine-facial-tissue-5x200', 'Fine', 'Fine Facial Tissues 200 × 5 boxes', 'مناديل فاين للوجه ٢٠٠ منديل × ٥ علب', 200, 'pcs', 5, 1.35, 'tissue_facial_5pk', ['FINE TISSUE 5X200', 'FINE FACIAL 200S*5', '~كلينكس فاين', '~محارم فاين']],
    ['sanita-facial-tissue-5x200', 'Sanita', 'Sanita Facial Tissues 200 × 5 boxes', 'مناديل سانيتا للوجه ٢٠٠ منديل × ٥ علب', 200, 'pcs', 5, 1.15, 'tissue_facial_5pk', ['SANITA TISSUE 5X200', '~محارم سانيتا']],
    ['fine-toilet-roll-20', 'Fine', 'Fine Toilet Rolls 20 rolls', 'ورق تواليت فاين ٢٠ لفة', 20, 'pcs', 1, 2.65, 'toilet_roll_20', ['FINE TOILET 20ROLL', 'FINE TOILET ROLL 20S', '~كلينكس حمام فاين'], true],
    ['sanita-toilet-roll-20', 'Sanita', 'Sanita Toilet Rolls 20 rolls', 'ورق تواليت سانيتا ٢٠ لفة', 20, 'pcs', 1, 2.35, 'toilet_roll_20', ['SANITA TOILET 20ROLL'], true],
    ['fine-kitchen-towel-4', 'Fine', 'Fine Kitchen Towels 4 rolls', 'مناشف مطبخ فاين ٤ لفات', 4, 'pcs', 1, 1.25, 'kitchen_towel_4', ['FINE KITCHEN TWL 4ROLL', '~كلينكس مطبخ']],
    ['sanita-kitchen-towel-4', 'Sanita', 'Sanita Kitchen Towels 4 rolls', 'مناشف مطبخ سانيتا ٤ لفات', 4, 'pcs', 1, 1.05, 'kitchen_towel_4', ['SANITA KITCHEN TWL 4ROLL']],
    ['sanita-garbage-bags-30', 'Sanita', 'Sanita Garbage Bags 30 pcs', 'أكياس قمامة سانيتا ٣٠ كيس', 30, 'pcs', 1, 0.65, 'garbage_bags_30', ['SANITA GARBAGE BAGS 30S', '~أكياس زبالة']],
  ]),
  ...cat('personal_care', [
    ['headshoulders-shampoo-400ml', 'Head & Shoulders', 'Head & Shoulders Classic Clean Shampoo 400ml', 'شامبو هيد آند شولدرز كلاسيك ٤٠٠ مل', 400, 'ml', 1, 1.95, 'shampoo_400ml', ['H&S SHAMPOO CLASSIC 400ML', 'HEAD SHOULDERS 400ML', '~شامبو هيد اند شولدرز']],
    ['pantene-shampoo-400ml', 'Pantene', 'Pantene Pro-V Shampoo 400ml', 'شامبو بانتين برو-ڤي ٤٠٠ مل', 400, 'ml', 1, 1.85, 'shampoo_400ml', ['PANTENE SHAMPOO 400ML', '~شامبو بانتين']],
    ['lux-soap-4x170g', 'Lux', 'Lux Soap Bar 170g × 4', 'صابون لوكس ١٧٠ غرام × ٤', 170, 'g', 4, 0.95, 'soap_bar_4pk', ['LUX SOAP 4X170G', '~صابون لوكس']],
    ['dettol-soap-4x165g', 'Dettol', 'Dettol Original Soap 165g × 4', 'صابون ديتول الأصلي ١٦٥ غرام × ٤', 165, 'g', 4, 1.05, 'soap_bar_4pk', ['DETTOL SOAP 4X165G', '~صابون ديتول']],
    ['colgate-maxfresh-100ml', 'Colgate', 'Colgate MaxFresh Toothpaste 100ml', 'معجون أسنان كولجيت ماكس فريش ١٠٠ مل', 100, 'ml', 1, 0.75, 'toothpaste_100ml', ['COLGATE MAXFRESH 100ML', '~معجون كولجيت']],
    ['signal-toothpaste-100ml', 'Signal', 'Signal Cavity Fighter Toothpaste 100ml', 'معجون أسنان سيجنال ١٠٠ مل', 100, 'ml', 1, 0.65, 'toothpaste_100ml', ['SIGNAL TOOTHPASTE 100ML', '~معجون سيجنال']],
    ['dove-bodywash-500ml', 'Dove', 'Dove Deeply Nourishing Body Wash 500ml', 'غسول الجسم دوف ٥٠٠ مل', 500, 'ml', 1, 1.65, 'bodywash_500ml', ['DOVE BODY WASH 500ML', '~شاور دوف']],
    ['nivea-deo-150ml', 'Nivea', 'Nivea Dry Deodorant Spray 150ml', 'مزيل عرق نيفيا بخاخ ١٥٠ مل', 150, 'ml', 1, 1.1, 'deodorant_150ml', ['NIVEA DEO 150ML', '~مزيل عرق نيفيا']],
  ]),
  ...cat('baby', [
    ['pampers-s4-64', 'Pampers', 'Pampers Baby-Dry Size 4 64 diapers', 'حفاضات بامبرز بيبي دراي مقاس ٤ ٦٤ حفاضة', 64, 'pcs', 1, 6.95, 'diapers_s4', ['PAMPERS S4 64S', 'PAMPERS BABY DRY SZ4 64', '~حفاظات بامبرز ٤'], true],
    ['huggies-s4-66', 'Huggies', 'Huggies Extra Care Size 4 66 diapers', 'حفاضات هجيز مقاس ٤ ٦٦ حفاضة', 66, 'pcs', 1, 6.75, 'diapers_s4', ['HUGGIES S4 66S', '~حفاظات هجيز ٤'], true],
    ['molfix-s4-64', 'Molfix', 'Molfix Size 4 64 diapers', 'حفاضات Molfix مقاس ٤ ٦٤ حفاضة', 64, 'pcs', 1, 5.25, 'diapers_s4', ['MOLFIX S4 64S'], true],
    ['pampers-wipes-64', 'Pampers', 'Pampers Baby Wipes 64 pcs', 'مناديل مبللة بامبرز للأطفال ٦٤ منديل', 64, 'pcs', 1, 0.95, 'baby_wipes', ['PAMPERS WIPES 64S', '~مناديل مبللة']],
    ['fine-baby-wipes-72', 'Fine', 'Fine Baby Wipes 72 pcs', 'مناديل مبللة فاين للأطفال ٧٢ منديل', 72, 'pcs', 1, 0.85, 'baby_wipes', ['FINE BABY WIPES 72S']],
    ['johnsons-baby-shampoo-500ml', "Johnson's", "Johnson's Baby Shampoo 500ml", 'شامبو جونسون للأطفال ٥٠٠ مل', 500, 'ml', 1, 1.65, 'baby_shampoo_500ml', ['JOHNSONS BABY SHMP 500ML', '~شامبو جونسون']],
    ['nido-powder-1.8kg', 'Nido', 'Nido Fortified Milk Powder 1.8kg', 'حليب نيدو مجفف مدعم ١٫٨ كيلو', 1.8, 'kg', 1, 5.95, 'milk_powder_1.8kg', ['NIDO FORTIFIED 1.8KG', 'NIDO MILK PWD 1800G', '~حليب نيدو']],
  ]),
];

/** A few store-specific receipt shorthands (some chains print their own abbreviations). */
export const STORE_ALIASES: { product: string; store: string; text: string }[] = [
  { product: 'almarai-milk-ff-1l', store: 'lulu-alrai', text: 'ALMARAI FRSH MLK FF 1L LULU' },
  { product: 'tilda-basmati-5kg', store: 'lulu-alrai', text: 'TILDA PURE BAS RICE 5K' },
  { product: 'kdd-milk-ff-1l', store: 'coop-mishref', text: 'حليب ك.د.د كامل 1ل' },
  { product: 'fairy-lemon-750ml', store: 'carrefour-avenues', text: 'FAIRY LEM DW 750' },
  { product: 'sadia-whole-chicken-1000g', store: 'coop-salwa', text: 'دجاج ساديا ١٠٠٠غ' },
];

export interface DemoUserSeed { displayName: string; homeLat: number; homeLng: number; trustWeight: number }

export const DEMO_USERS: DemoUserSeed[] = [
  { displayName: 'Umm Khalid (Salwa)', homeLat: 29.2985, homeLng: 48.0725, trustWeight: 1.1 },
  { displayName: 'Abu Faisal (Jabriya)', homeLat: 29.3185, homeLng: 48.0215, trustWeight: 1.0 },
  { displayName: 'Noura (Khaldiya)', homeLat: 29.3215, homeLng: 47.9715, trustWeight: 0.9 },
];

/** Shopping lists: [productSlug, qty, allowSubstitute]. */
export const DEMO_LISTS: { user: number; name: string; items: [string, number, boolean][] }[] = [
  {
    user: 0,
    name: 'Weekly family basket',
    items: [
      ['almarai-milk-ff-1l', 4, true], ['kdd-laban-1l', 2, true], ['eggs-white-30', 1, true],
      ['kfm-arabic-bread-white', 3, true], ['tilda-basmati-5kg', 1, true], ['afia-corn-oil-1.8l', 1, true],
      ['khaleej-sugar-2kg', 1, true], ['alalali-tuna-185g', 4, true], ['lipton-yellow-label-100', 1, true],
      ['sadia-whole-chicken-1000g', 2, true], ['tomato-1kg', 2, false], ['cucumber-1kg', 1, false],
      ['banana-1kg', 1, false], ['fairy-lemon-750ml', 1, true], ['fine-facial-tissue-5x200', 1, true],
    ],
  },
  {
    user: 1,
    name: 'Quick top-up',
    items: [
      ['kdd-milk-ff-1l', 2, true], ['kfm-toast-white-600g', 1, true], ['puck-cream-cheese-500g', 1, true],
      ['rawdatain-water-1.5l-6', 1, true], ['indomie-chicken-5', 2, true], ['tomato-1kg', 1, false],
    ],
  },
];

/**
 * Watchlist: [userIndex, productSlug, targetPriceKwd].
 * The Tilda 5kg target is set so that fixture receipt #2 (Salwa co-op promo, 4.450 KWD) fires an alert.
 */
export const DEMO_WATCHLIST: [number, string, number][] = [
  [0, 'tilda-basmati-5kg', 4.6],
  [1, 'nescafe-classic-200g', 2.9],
  [2, 'pampers-s4-64', 5.75],
];
