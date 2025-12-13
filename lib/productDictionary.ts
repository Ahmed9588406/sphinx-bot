/**
 * Product Dictionary for Arabic-English Matching
 * 
 * This file contains comprehensive mappings between Arabic product names/terms
 * and their English equivalents as stored in the database.
 * 
 * Used for:
 * 1. Chat product search - matching Arabic queries to English product titles
 * 2. Order extraction - understanding Arabic product requests
 * 3. Embeddings - generating bilingual embeddings for better semantic search
 */

// ============================================
// Product Type Mappings
// ============================================

/**
 * Maps Arabic product names to English product titles as stored in DB
 * Format: 'arabic term' -> ['english db title match 1', 'english db title match 2', ...]
 */
export const productTypeMap: Record<string, string[]> = {
  // Performance Tee / T-Shirt
  'تيشيرت': ['Performance Tee', 'Tee', 'T-Shirt'],
  'تي شيرت': ['Performance Tee', 'Tee', 'T-Shirt'],
  'تيشرت': ['Performance Tee', 'Tee', 'T-Shirt'],
  'التيشيرت': ['Performance Tee', 'Tee', 'T-Shirt'],
  'تيشيرت رياضي': ['Performance Tee', 'Squat Tee'],
  'تيشيرت بيرفورمانس': ['Performance Tee'],
  'بيرفورمانس تي': ['Performance Tee'],
  
  // Squat Tee
  'سكوات تي': ['Squat Tee'],
  'تيشيرت سكوات': ['Squat Tee'],
  'سكوات': ['Squat Tee'],
  
  // Training Tank / Tank Top
  'تانك': ['Training Tank', 'Tank'],
  'تانك توب': ['Training Tank', 'Tank'],
  'التانك': ['Training Tank', 'Tank'],
  'تانك تدريب': ['Training Tank'],
  'ترينينج تانك': ['Training Tank'],
  'فانلة': ['Training Tank', 'Tank'],
  'فانلة رياضية': ['Training Tank'],
  
  // Compression Short
  'شورت ضاغط': ['Compression Short'],
  'كومبريشن شورت': ['Compression Short'],
  'شورت كومبريشن': ['Compression Short'],
  'شورت ضغط': ['Compression Short'],
  
  // Gym Shorts
  'شورت': ['Gym Shorts', 'Shorts', 'Running Shorts', 'Compression Short'],
  'شورتس': ['Gym Shorts', 'Shorts'],
  'الشورت': ['Gym Shorts', 'Shorts'],
  'شورت جيم': ['Gym Shorts'],
  'شورت رياضي': ['Gym Shorts', 'Running Shorts'],
  'جيم شورتس': ['Gym Shorts'],
  
  // Running Shorts
  'شورت جري': ['Running Shorts'],
  'رانينج شورتس': ['Running Shorts'],
  'شورت رانينج': ['Running Shorts'],
  
  // Workout Hoodie
  'هودي': ['Workout Hoodie', 'Hoodie'],
  'هوديز': ['Workout Hoodie', 'Hoodie'],
  'الهودي': ['Workout Hoodie', 'Hoodie'],
  'هودي تمرين': ['Workout Hoodie'],
  'ووركاوت هودي': ['Workout Hoodie'],
  'سويت شيرت': ['Workout Hoodie', 'Hoodie'],
  'سويتشيرت': ['Workout Hoodie', 'Hoodie'],
  
  // Track Pants
  'تراك': ['Track Pants', 'Track'],
  'التراك': ['Track Pants', 'Track'],
  'تراك بانتس': ['Track Pants'],
  'التراك بانتس': ['Track Pants'],
  'بانتس': ['Track Pants', 'Pants'],
  'بنطلون تراك': ['Track Pants'],
  'بنطلون رياضي': ['Track Pants', 'Athletic Joggers'],
  'تراك بنطلون': ['Track Pants'],
  
  // Athletic Joggers
  'جوجر': ['Athletic Joggers', 'Joggers'],
  'جوجرز': ['Athletic Joggers', 'Joggers'],
  'الجوجر': ['Athletic Joggers', 'Joggers'],
  'اثليتك جوجرز': ['Athletic Joggers'],
  'بنطلون جوجر': ['Athletic Joggers'],
  
  // Warm-Up Jacket
  'جاكيت': ['Warm-Up Jacket', 'Jacket'],
  'جاكت': ['Warm-Up Jacket', 'Jacket'],
  'الجاكيت': ['Warm-Up Jacket', 'Jacket'],
  'جاكيت تسخين': ['Warm-Up Jacket'],
  'وارم اب جاكيت': ['Warm-Up Jacket'],
  'جاكيت رياضي': ['Warm-Up Jacket'],
};

// ============================================
// Brand / Character / Anime Names (Transliterations)
// ============================================

export const brandCharacterMap: Record<string, string[]> = {
  // Anime - Dragon Ball
  'دراجون بول': ['Dragon Ball', 'Dragonball'],
  'دراغون بول': ['Dragon Ball', 'Dragonball'],
  'دراقون بول': ['Dragon Ball', 'Dragonball'],
  'دراجن بول': ['Dragon Ball', 'Dragonball'],
  
  // Anime - Naruto
  'ناروتو': ['Naruto'],
  'نارتو': ['Naruto'],
  
  // Anime - One Piece
  'ون بيس': ['One Piece'],
  'وان بيس': ['One Piece'],
  
  // Anime - Attack on Titan
  'اتاك اون تايتن': ['Attack on Titan', 'AOT'],
  'هجوم العمالقة': ['Attack on Titan', 'AOT'],
  
  // Anime - Demon Slayer
  'ديمون سلاير': ['Demon Slayer'],
  'قاتل الشياطين': ['Demon Slayer'],
  
  // Anime - My Hero Academia
  'ماي هيرو اكاديميا': ['My Hero Academia', 'MHA'],
  'بطل اكاديميتي': ['My Hero Academia'],
  
  // Anime - Jujutsu Kaisen
  'جوجوتسو كايسن': ['Jujutsu Kaisen'],
  'جوجتسو': ['Jujutsu Kaisen'],
  
  // Anime - Death Note
  'ديث نوت': ['Death Note'],
  
  // Anime - Hunter x Hunter
  'هنتر اكس هنتر': ['Hunter x Hunter', 'HxH'],
  'هانتر': ['Hunter'],
  
  // Anime - Tokyo Ghoul
  'طوكيو غول': ['Tokyo Ghoul'],
  'توكيو غول': ['Tokyo Ghoul'],
  
  // Sports Brands
  'نايك': ['Nike'],
  'اديداس': ['Adidas'],
  'بوما': ['Puma'],
  'اندر ارمور': ['Under Armour'],
  'ريبوك': ['Reebok'],
  'نيو بالانس': ['New Balance'],
  
  // Other popular characters/brands
  'مارفل': ['Marvel'],
  'دي سي': ['DC'],
  'باتمان': ['Batman'],
  'سوبرمان': ['Superman'],
  'سبايدرمان': ['Spiderman', 'Spider-Man'],
  'ايرون مان': ['Iron Man'],
  'كابتن امريكا': ['Captain America'],
  
  // Gaming
  'بلايستيشن': ['PlayStation', 'PS'],
  'اكس بوكس': ['Xbox'],
  'نينتندو': ['Nintendo'],
  'فورتنايت': ['Fortnite'],
  'ببجي': ['PUBG'],
  'فيفا': ['FIFA'],
};

// ============================================
// Color Mappings
// ============================================

export const colorMap: Record<string, string[]> = {
  // Black
  'أسود': ['black'],
  'اسود': ['black'],
  'الأسود': ['black'],
  'الاسود': ['black'],
  'بلاك': ['black'],
  
  // Navy
  'كحلي': ['navy'],
  'الكحلي': ['navy'],
  'نيفي': ['navy'],
  'ازرق غامق': ['navy'],
  'أزرق غامق': ['navy'],
  
  // Gray
  'رمادي': ['gray', 'grey'],
  'الرمادي': ['gray', 'grey'],
  'جراي': ['gray', 'grey'],
  'رصاصي': ['gray', 'grey'],
  
  // Olive
  'زيتي': ['olive'],
  'الزيتي': ['olive'],
  'اوليف': ['olive'],
  'أخضر زيتي': ['olive'],
  'اخضر زيتي': ['olive'],
  
  // Red
  'أحمر': ['red'],
  'احمر': ['red'],
  'الأحمر': ['red'],
  'الاحمر': ['red'],
  'ريد': ['red'],
  
  // White
  'أبيض': ['white'],
  'ابيض': ['white'],
  'الأبيض': ['white'],
  'الابيض': ['white'],
  'وايت': ['white'],
  
  // Charcoal
  'فحمي': ['charcoal'],
  'الفحمي': ['charcoal'],
  'تشاركول': ['charcoal'],
  'رمادي غامق': ['charcoal'],
};

// ============================================
// Gender Mappings
// ============================================

export const genderMap: Record<string, string[]> = {
  'رجالي': ["Men's", 'Men', 'male'],
  'للرجال': ["Men's", 'Men'],
  'رجال': ["Men's", 'Men'],
  'حريمي': ["Women's", 'Women', 'female'],
  'للسيدات': ["Women's", 'Women'],
  'نسائي': ["Women's", 'Women'],
  'ستات': ["Women's", 'Women'],
};

// ============================================
// Size Mappings
// ============================================

export const sizeMap: Record<string, string[]> = {
  'سمول': ['S', 'Small'],
  'صغير': ['S', 'Small'],
  'اس': ['S', 'Small'],
  'ميديم': ['M', 'Medium'],
  'وسط': ['M', 'Medium'],
  'ام': ['M', 'Medium'],
  'لارج': ['L', 'Large'],
  'كبير': ['L', 'Large'],
  'ال': ['L', 'Large'],
  'اكس لارج': ['XL', 'Extra Large'],
  'اكسترا لارج': ['XL', 'Extra Large'],
  'اكس ال': ['XL'],
  'دبل اكس': ['XXL', '2XL'],
  'تربل اكس': ['XXXL', '3XL'],
};

// ============================================
// Material Mappings
// ============================================

export const materialMap: Record<string, string[]> = {
  'بوليستر': ['polyester'],
  'قطن': ['cotton', 'cotton blend'],
  'نايلون': ['nylon'],
  'سباندكس': ['spandex'],
  'ليكرا': ['spandex', 'lycra'],
  'صوف': ['merino', 'merino blend'],
};

// ============================================
// Common Fitness Terms
// ============================================

export const fitnessTermsMap: Record<string, string[]> = {
  'جيم': ['gym', 'workout'],
  'الجيم': ['gym', 'workout'],
  'تمرين': ['workout', 'training'],
  'تدريب': ['training'],
  'رياضة': ['sports', 'athletic'],
  'رياضي': ['sports', 'athletic', 'gym'],
  'رياضية': ['sports', 'athletic'],
  'فيتنس': ['fitness'],
  'كارديو': ['cardio', 'running'],
  'جري': ['running'],
  'رفع اثقال': ['weightlifting', 'gym'],
  'حديد': ['weightlifting', 'gym'],
};

// ============================================
// Combined Translation Function
// ============================================

/**
 * Translates Arabic text to English product search terms
 * Checks all dictionaries and returns all possible matches
 */
export function translateToEnglish(arabicText: string): string[] {
  const normalizedText = arabicText.trim().toLowerCase();
  const results: Set<string> = new Set();
  
  // Check all dictionaries (including brand/character names)
  const allMaps = [
    productTypeMap,
    brandCharacterMap,
    colorMap,
    genderMap,
    sizeMap,
    materialMap,
    fitnessTermsMap,
  ];
  
  // First check for exact phrase matches (longer phrases first)
  for (const map of allMaps) {
    const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);
    for (const arabicTerm of sortedKeys) {
      if (normalizedText.includes(arabicTerm.toLowerCase())) {
        map[arabicTerm].forEach(eng => results.add(eng));
      }
    }
  }
  
  // Also check individual words
  const words = normalizedText.split(/\s+/);
  for (const word of words) {
    for (const map of allMaps) {
      if (map[word]) {
        map[word].forEach(eng => results.add(eng));
      }
    }
  }
  
  return Array.from(results);
}

/**
 * Builds a search query from Arabic input
 * Returns an array of English search terms to try
 */
export function buildSearchQueries(arabicText: string): string[] {
  const translations = translateToEnglish(arabicText);
  const queries: string[] = [];
  
  // Add direct translations
  queries.push(...translations);
  
  // Try to build combined queries (e.g., "Track Pants - Men's black")
  const productTypes = translations.filter(t => 
    Object.values(productTypeMap).flat().includes(t)
  );
  const colors = translations.filter(t => 
    Object.values(colorMap).flat().includes(t)
  );
  const genders = translations.filter(t => 
    Object.values(genderMap).flat().includes(t)
  );
  
  // Build combined queries
  for (const product of productTypes) {
    for (const gender of genders) {
      for (const color of colors) {
        queries.push(`${product} - ${gender} ${color}`);
      }
      if (colors.length === 0) {
        queries.push(`${product} - ${gender}`);
      }
    }
    for (const color of colors) {
      queries.push(`${product} ${color}`);
    }
  }
  
  return [...new Set(queries)];
}

// ============================================
// Bilingual Product Descriptions for Embeddings
// ============================================

/**
 * Generates bilingual text for a product to improve embedding matching
 * This can be used when creating/updating product embeddings
 */
export function generateBilingualProductText(product: {
  title: string;
  description?: string;
  tags?: string[];
  metadata?: { color?: string; gender?: string; material?: string };
}): string {
  const parts: string[] = [];
  
  // English title and description
  parts.push(product.title);
  if (product.description) {
    parts.push(product.description);
  }
  
  // Add Arabic translations for the product type
  const titleLower = product.title.toLowerCase();
  for (const [arabic, englishTerms] of Object.entries(productTypeMap)) {
    if (englishTerms.some(eng => titleLower.includes(eng.toLowerCase()))) {
      parts.push(arabic);
    }
  }
  
  // Add Arabic translations for brand/character names (anime, etc.)
  for (const [arabic, englishTerms] of Object.entries(brandCharacterMap)) {
    if (englishTerms.some(eng => titleLower.includes(eng.toLowerCase()))) {
      parts.push(arabic);
    }
  }
  
  // Add Arabic color translations
  if (product.metadata?.color) {
    const colorLower = product.metadata.color.toLowerCase();
    for (const [arabic, englishTerms] of Object.entries(colorMap)) {
      if (englishTerms.some(eng => eng.toLowerCase() === colorLower)) {
        parts.push(arabic);
      }
    }
  }
  
  // Also check for colors in the title
  for (const [arabic, englishTerms] of Object.entries(colorMap)) {
    if (englishTerms.some(eng => titleLower.includes(eng.toLowerCase()))) {
      parts.push(arabic);
    }
  }
  
  // Add Arabic gender translations
  if (product.metadata?.gender || product.title.includes("Men's") || product.title.includes("Women's")) {
    const isMens = product.metadata?.gender === 'male' || product.title.includes("Men's");
    const isWomens = product.metadata?.gender === 'female' || product.title.includes("Women's");
    
    if (isMens) {
      parts.push('رجالي', 'للرجال');
    }
    if (isWomens) {
      parts.push('حريمي', 'نسائي', 'للسيدات');
    }
  }
  
  // Add Arabic material translations
  if (product.metadata?.material) {
    const materialLower = product.metadata.material.toLowerCase();
    for (const [arabic, englishTerms] of Object.entries(materialMap)) {
      if (englishTerms.some(eng => materialLower.includes(eng.toLowerCase()))) {
        parts.push(arabic);
      }
    }
  }
  
  // Add common Arabic fitness terms
  parts.push('جيم', 'رياضي', 'تمرين', 'فيتنس');
  
  return parts.join(' ');
}

// ============================================
// Reverse Mapping (English to Arabic) for Display
// ============================================

/**
 * Gets Arabic names for an English product title
 * Useful for displaying products in Arabic
 */
export function getArabicProductNames(englishTitle: string): string[] {
  const titleLower = englishTitle.toLowerCase();
  const arabicNames: string[] = [];
  
  for (const [arabic, englishTerms] of Object.entries(productTypeMap)) {
    if (englishTerms.some(eng => titleLower.includes(eng.toLowerCase()))) {
      // Only add clean Arabic names (without ال prefix for variety)
      if (!arabic.startsWith('ال')) {
        arabicNames.push(arabic);
      }
    }
  }
  
  return [...new Set(arabicNames)];
}

export default {
  productTypeMap,
  colorMap,
  genderMap,
  sizeMap,
  materialMap,
  fitnessTermsMap,
  translateToEnglish,
  buildSearchQueries,
  generateBilingualProductText,
  getArabicProductNames,
};
