// ---------------------------------------------------------------------------
// Ingredient extraction utilities for the shopping list modal.
// Kept in a separate file so they can be unit-tested independently.
// ---------------------------------------------------------------------------

export const COOKING_WORDS = new Set([
  'grilled',
  'baked',
  'fried',
  'roasted',
  'steamed',
  'boiled',
  'scrambled',
  'poached',
  'smoked',
  'fresh',
  'mixed',
  'chopped',
  'sliced',
  'diced',
  'homemade',
  'seasonal',
  'stuffed',
  'marinated',
  'sautéed',
  'sauteed',
  'drizzled',
  'tossed',
  'filled',
  'topped',
  'garnished',
  'whipped',
  'crispy',
  'creamy',
  'spicy',
  'sweet',
  'savory',
  'hearty',
  'light',
  'warm',
  'cold',
  'lean',
  'low-fat',
  'high-protein',
  'wholegrain',
  'whole-grain',
]);

export const CATEGORIES: Record<string, string[]> = {
  Proteins: [
    'chicken',
    'beef',
    'salmon',
    'tuna',
    'turkey',
    'pork',
    'lamb',
    'shrimp',
    'tofu',
    'egg',
    'cod',
    'tilapia',
    'mackerel',
    'sea bass',
    'seabass',
    'sardine',
    'prawn',
    'venison',
    'duck',
    'tempeh',
    'edamame',
  ],
  Dairy: [
    'yogurt',
    'yoghurt',
    'cheese',
    'milk',
    'cream',
    'butter',
    'feta',
    'cottage',
    'parmesan',
    'mozzarella',
    'ricotta',
    'cheddar',
    'brie',
  ],
  'Grains & Carbs': [
    'rice',
    'bread',
    'pasta',
    'quinoa',
    'oat',
    'toast',
    'bagel',
    'wrap',
    'potato',
    'noodle',
    'couscous',
    'lentil',
    'chickpea',
    'tortilla',
    'pita',
    'rye',
    'barley',
    'buckwheat',
    'millet',
    'polenta',
  ],
  Vegetables: [
    'broccoli',
    'spinach',
    'salad',
    'avocado',
    'tomato',
    'cucumber',
    'carrot',
    'lettuce',
    'pepper',
    'onion',
    'zucchini',
    'asparagus',
    'kale',
    'celery',
    'pea',
    'corn',
    'mushroom',
    'cabbage',
    'cauliflower',
    'eggplant',
    'aubergine',
    'leek',
    'artichoke',
    'arugula',
    'rocket',
    'bok choy',
    'green bean',
    'sweet potato',
  ],
  Fruits: [
    'apple',
    'banana',
    'berr',
    'kiwi',
    'orange',
    'mango',
    'grape',
    'pineapple',
    'watermelon',
    'peach',
    'pear',
    'cherry',
    'lemon',
    'lime',
    'grapefruit',
    'pomegranate',
    'fig',
    'date',
  ],
};

export const CATEGORY_ORDER = ['Proteins', 'Dairy', 'Grains & Carbs', 'Vegetables', 'Fruits', 'Other'];

/**
 * Strip filler words, articles, and cooking adjectives from a raw token so
 * only the core ingredient name remains.
 */
export function cleanItem(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(a|an|the|some|of|side|bowl|plate|slice|piece|cup|handful)\b/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1 && !COOKING_WORDS.has(w))
    .join(' ')
    .trim();
}

/**
 * Split a meal description on common connective phrases and return the
 * cleaned ingredient tokens (≥ 3 characters after cleaning).
 */
export function extractItems(description: string): string[] {
  return description
    .split(
      /\s+with\s+|\s+and\s+|,\s*|\s+on\s+|\s+over\s+|\s+topped\s+with\s+|\s+served\s+with\s+|\s+drizzled\s+with\s+/,
    )
    .map(cleanItem)
    .filter(s => s.length > 2);
}

/**
 * Map a cleaned ingredient string to one of the predefined categories,
 * falling back to 'Other'.
 */
export function categorise(item: string): string {
  const lower = item.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'Other';
}
