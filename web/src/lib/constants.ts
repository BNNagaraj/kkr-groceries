/**
 * Product categories are organised into top-level groups.
 *
 * Products store only the leaf id (`category: "leafy"`, `"rice"`, …).
 * The group is derived at render time via CATEGORY_LOOKUP, so existing
 * product docs need no migration when this list changes.
 */

export interface CategoryDef {
  id: string;
  label: string;
}

export interface CategoryGroup extends CategoryDef {
  categories: CategoryDef[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: "vegetables",
    label: "Vegetables",
    categories: [
      { id: "leafy", label: "Leafy & Herbs" },
      { id: "roots", label: "Roots, Tubers & Bulbs" },
      { id: "fruit_veg", label: "Fruit Vegetables" },
      { id: "gourds", label: "Gourds & Beans" },
      { id: "cruciferous", label: "Cruciferous & Others" },
      { id: "sweet", label: "Sweet Fruits" },
    ],
  },
  {
    id: "groceries",
    label: "Groceries",
    categories: [
      { id: "rice", label: "Rice" },
      { id: "flour", label: "Flour & Atta" },
      { id: "pulses", label: "Pulses & Dals" },
      { id: "oil", label: "Cooking Oil & Ghee" },
      { id: "spices", label: "Spices & Masalas" },
      { id: "sugar_salt", label: "Sugar, Salt & Sweeteners" },
    ],
  },
  {
    id: "dairy",
    label: "Dairy",
    categories: [
      { id: "milk", label: "Milk" },
      { id: "curd", label: "Curd & Yogurt" },
      { id: "butter_cream", label: "Butter & Cream" },
      { id: "paneer_cheese", label: "Paneer & Cheese" },
      { id: "buttermilk", label: "Buttermilk & Lassi" },
    ],
  },
];

/** Flat list of every leaf category — used by admin product forms and search. */
export const PRODUCT_CATEGORIES: CategoryDef[] = CATEGORY_GROUPS.flatMap(
  (g) => g.categories
);

/** Lookup: leaf id → { label, groupId, groupLabel }. O(1) parent resolution. */
export const CATEGORY_LOOKUP: Record<
  string,
  { label: string; groupId: string; groupLabel: string }
> = CATEGORY_GROUPS.reduce(
  (acc, group) => {
    for (const c of group.categories) {
      acc[c.id] = { label: c.label, groupId: group.id, groupLabel: group.label };
    }
    return acc;
  },
  {} as Record<string, { label: string; groupId: string; groupLabel: string }>
);

/** Returns the group id for a leaf category id, or "vegetables" as a safe default. */
export function getGroupForCategory(categoryId: string | undefined): string {
  if (!categoryId) return "vegetables";
  return CATEGORY_LOOKUP[categoryId]?.groupId || "vegetables";
}

export const UNIT_OPTIONS = [
  "Kg",
  "Piece",
  "Bunch",
  "Dozen",
  "Packet",
  "Litre",
  "Bag",
];
