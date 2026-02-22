// Global State Management
export const state = {
    cart: {},
    currentCategory: 'all',
    searchTerm: '',
    currentUser: null,
    confirmationResult: null,
    commissionPercent: 15,
    apmcPrices: null,
    selectedApmcMarket: 'Bowenpally',
    isAdminClaim: false
};

// Constant data
export const ADMIN_EMAILS = ['raju2uraju@gmail.com', 'kanthati.chakri@gmail.com']; // fallback list
export const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

export const products = [
    { id: 1, name: 'Tomato', telugu: '\u0C1F\u0C2E\u0C3E\u0C1F\u0C4B', hindi: 'Tamatar', price: 24, unit: 'kg', moq: 100, category: 'daily', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/220px-Tomato_je.jpg', hot: true },
    { id: 2, name: 'Onion', telugu: '\u0C09\u0C32\u0C4D\u0C32\u0C3F\u0C2A\u0C3E\u0C2F', hindi: 'Pyaz', price: 32, unit: 'kg', moq: 50, category: 'daily', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Onion_on_White.JPG/220px-Onion_on_White.JPG', hot: true },
    { id: 3, name: 'Potato', telugu: '\u0C2C\u0C02\u0C17\u0C3E\u0C33\u0C3E\u0C26\u0C41\u0C02\u0C2A', hindi: 'Aloo', price: 28, unit: 'kg', moq: 50, category: 'daily', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Patates.jpg/220px-Patates.jpg' },
    { id: 4, name: 'Green Chilli', telugu: '\u0C2A\u0C1A\u0C4D\u0C1A\u0C3F \u0C2E\u0C3F\u0C30\u0C4D\u0C1A\u0C3F', hindi: 'Hari Mirch', price: 45, unit: 'kg', moq: 25, category: 'daily', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Green_chilli_closeup.jpg/220px-Green_chilli_closeup.jpg', hot: true },
    { id: 5, name: "Lady's Finger", telugu: '\u0C2C\u0C46\u0C02\u0C21\u0C15\u0C3E\u0C2F', hindi: 'Bhindi', price: 38, unit: 'kg', moq: 30, category: 'rotate', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Okra_%28Abelmoschus_esculentus%29_%283%29.jpg/220px-Okra_%28Abelmoschus_esculentus%29_%283%29.jpg' },
    { id: 6, name: 'Brinjal', telugu: '\u0C35\u0C02\u0C15\u0C3E\u0C2F', hindi: 'Baingan', price: 32, unit: 'kg', moq: 40, category: 'rotate', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%281%29.JPG/220px-Solanum_melongena_24_08_2012_%281%29.JPG' },
    { id: 7, name: 'Cauliflower', telugu: '\u0C2B\u0C41\u0C32\u0C35\u0C30\u0C4D', hindi: 'Phool Gobi', price: 28, unit: 'piece', moq: 20, category: 'rotate', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Chou-fleur_02.jpg/220px-Chou-fleur_02.jpg', fresh: true },
    { id: 8, name: 'Cabbage', telugu: '\u0C15\u0C4D\u0C2F\u0C3E\u0C2C\u0C47\u0C1C\u0C40', hindi: 'Patta Gobi', price: 22, unit: 'piece', moq: 20, category: 'rotate', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Cabbage_and_cross_section_on_white.jpg/220px-Cabbage_and_cross_section_on_white.jpg' },
    { id: 9, name: 'Carrot', telugu: '\u0C15\u0C3E\u0C30\u0C46\u0C1F\u0C4D', hindi: 'Gajar', price: 42, unit: 'kg', moq: 25, category: 'rotate', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Vegetable-Ede-carrot.jpg/220px-Vegetable-Ede-carrot.jpg' },
    { id: 10, name: 'Spinach', telugu: '\u0C2A\u0C3E\u0C32\u0C15\u0C42\u0C30', hindi: 'Palak', price: 18, unit: 'bunch', moq: 50, category: 'regional', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Spinach_leaves.jpg/220px-Spinach_leaves.jpg', fresh: true },
    { id: 11, name: 'Bottle Gourd', telugu: '\u0C38\u0C4A\u0C30\u0C15\u0C3E\u0C2F', hindi: 'Lauki', price: 35, unit: 'piece', moq: 15, category: 'regional', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Bottle_gourd.jpg/220px-Bottle_gourd.jpg' },
    { id: 12, name: 'Ridge Gourd', telugu: '\u0C2C\u0C40\u0C30\u0C15\u0C3E\u0C2F', hindi: 'Turiya', price: 40, unit: 'kg', moq: 25, category: 'regional', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Luffa_aegyptiaca_fruit.jpg/220px-Luffa_aegyptiaca_fruit.jpg' }
];

// Helper to determine admin status
export function isAdmin() {
    return state.isAdminClaim || (state.currentUser && state.currentUser.email && ADMIN_EMAILS.includes(state.currentUser.email.toLowerCase()));
}
