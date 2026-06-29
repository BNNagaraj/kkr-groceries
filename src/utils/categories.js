/**
 * Product category definitions and helpers.
 * Keeps legacy categories compatible while moving to 5 compact groups.
 */

export const PRODUCT_CATEGORIES = [
    { id: 'leafy-herbs', label: 'Leafy & Herbs', color: '#10b981' },
    { id: 'roots-tubers-bulbs', label: 'Roots, Tubers & Bulbs', color: '#8b5cf6' },
    { id: 'fruit-vegetables', label: 'Fruit Vegetables', color: '#3b82f6' },
    { id: 'gourds-beans', label: 'Gourds & Beans', color: '#f59e0b' },
    { id: 'cruciferous-others', label: 'Cruciferous & Others', color: '#0ea5e9' }
];

const CATEGORY_BY_ID = new Map(PRODUCT_CATEGORIES.map((c) => [c.id, c]));

const LEGACY_CATEGORY_MAP = {
    daily: 'fruit-vegetables',
    rotate: 'cruciferous-others',
    regional: 'gourds-beans'
};

const CATEGORY_RULES = [
    {
        id: 'leafy-herbs',
        keywords: [
            'spinach', 'palak', 'amaranth', 'mint', 'coriander', 'cilantro',
            'fenugreek', 'methi', 'curry leaf', 'dill', 'lettuce'
        ]
    },
    {
        id: 'roots-tubers-bulbs',
        keywords: [
            'potato', 'aloo', 'onion', 'pyaz', 'garlic', 'ginger', 'carrot',
            'gajar', 'radish', 'mooli', 'beet', 'turnip', 'sweet potato',
            'yam', 'colocasia', 'taro', 'turmeric'
        ]
    },
    {
        id: 'fruit-vegetables',
        keywords: [
            'tomato', 'brinjal', 'eggplant', 'okra', "lady's finger", 'bhindi',
            'capsicum', 'chilli', 'chili', 'pepper'
        ]
    },
    {
        id: 'gourds-beans',
        keywords: [
            'gourd', 'lauki', 'turiya', 'pumpkin', 'cucumber', 'zucchini',
            'beans', 'bean', 'peas', 'pea'
        ]
    },
    {
        id: 'cruciferous-others',
        keywords: [
            'cabbage', 'cauliflower', 'broccoli', 'knol-khol', 'drumstick',
            'moringa', 'banana flower', 'jackfruit', 'raw banana'
        ]
    }
];

function normalizeText(value) {
    return String(value || '').toLowerCase().trim();
}

export function classifyCategoryByName(name) {
    const normalizedName = normalizeText(name);
    if (!normalizedName) return null;

    const matchedRule = CATEGORY_RULES.find((rule) =>
        rule.keywords.some((keyword) => normalizedName.includes(keyword))
    );
    return matchedRule ? matchedRule.id : null;
}

/**
 * Normalize category from new IDs, legacy IDs, or name-based inference.
 */
export function normalizeProductCategory(category, productName = '') {
    if (!category && !productName) return 'fruit-vegetables';

    const normalizedCategory = normalizeText(category);
    if (CATEGORY_BY_ID.has(normalizedCategory)) {
        return normalizedCategory;
    }

    const inferredFromName = classifyCategoryByName(productName);
    if (inferredFromName) return inferredFromName;

    if (LEGACY_CATEGORY_MAP[normalizedCategory]) {
        return LEGACY_CATEGORY_MAP[normalizedCategory];
    }

    return 'fruit-vegetables';
}

export function getCategoryLabel(category, productName = '') {
    const key = normalizeProductCategory(category, productName);
    return CATEGORY_BY_ID.get(key)?.label || key;
}

export function getCategoryColor(category, productName = '') {
    const key = normalizeProductCategory(category, productName);
    return CATEGORY_BY_ID.get(key)?.color || '#64748b';
}
