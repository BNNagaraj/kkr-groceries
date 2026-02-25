/**
 * Global Type Definitions
 * @module types
 */

/**
 * Product type definition
 * @typedef {Object} Product
 * @property {number} id - Product ID
 * @property {string} name - Product name (English)
 * @property {string} telugu - Product name (Telugu)
 * @property {string} hindi - Product name (Hindi)
 * @property {number} price - Base price
 * @property {number} [overridePrice] - Override price (if set)
 * @property {string} unit - Unit (kg, piece, bunch)
 * @property {number} moq - Minimum order quantity
 * @property {string} category - Category (daily, rotate, regional)
 * @property {string} image - Image URL
 * @property {boolean} [hot] - Hot selling flag
 * @property {boolean} [fresh] - Fresh arrival flag
 * @property {boolean} [isHidden] - Visibility flag
 */

/**
 * Cart item type definition
 * @typedef {Object} CartItem
 * @property {number} id - Product ID
 * @property {string} name - Product name
 * @property {string} telugu - Telugu name
 * @property {string} hindi - Hindi name
 * @property {number} price - Selling price
 * @property {string} unit - Unit
 * @property {number} moq - Minimum order quantity
 * @property {number} qty - Current quantity in cart
 * @property {string} category - Category
 * @property {string} image - Image URL
 */

/**
 * Order type definition
 * @typedef {Object} Order
 * @property {string} id - Order ID
 * @property {string} status - Order status (Pending, Accepted, Fulfilled, Rejected)
 * @property {string} customerName - Customer name
 * @property {string} phone - Customer phone
 * @property {string} location - Delivery location
 * @property {Object} [locationDetails] - Structured location details
 * @property {string} businessType - Business type
 * @property {Array<CartItem>} cart - Cart items
 * @property {string} orderSummary - Summary string
 * @property {number} productCount - Number of products
 * @property {string} totalValue - Formatted total value
 * @property {string} timestamp - Human readable timestamp
 * @property {Object} createdAt - Firestore timestamp
 * @property {string} userId - User ID who placed order
 */

/**
 * APMC Price type definition
 * @typedef {Object} APMCPrice
 * @property {string} commodity - Commodity name
 * @property {number} minPrice - Minimum price
 * @property {number} maxPrice - Maximum price
 * @property {number} modalPrice - Modal (average) price
 * @property {string} date - Date string
 */

/**
 * User type definition
 * @typedef {Object} User
 * @property {string} uid - User ID
 * @property {string|null} displayName - Display name
 * @property {string|null} email - Email address
 * @property {string|null} phoneNumber - Phone number
 * @property {string|null} photoURL - Profile photo URL
 */

/**
 * Address type definition
 * @typedef {Object} Address
 * @property {string} id - Address ID
 * @property {string} name - Contact name
 * @property {string} phone - Contact phone
 * @property {string} loc - Location string
 * @property {string} pin - Pincode
 * @property {Object} [coords] - Geographic coordinates
 * @property {number} coords.lat - Latitude
 * @property {number} coords.lng - Longitude
 * @property {Object} createdAt - Firestore timestamp
 */

/**
 * Validation result type
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string|null} error - Error message if invalid
 */

/**
 * Route handler type
 * @typedef {Function} RouteHandler
 * @param {Object} params - Route parameters
 * @param {string} hash - Current hash
 * @returns {void|Promise<void>}
 */

/**
 * Toast type
 * @typedef {'success'|'error'|'info'} ToastType
 */

/**
 * State keys
 * @typedef {'cart'|'currentCategory'|'searchTerm'|'currentUser'|'confirmationResult'|'commissionPercent'|'apmcPrices'|'selectedApmcMarket'|'isAdminClaim'|'enableOrderRequests'|'minOrderValue'|'geofenceRadiusKm'|'settingsLoaded'} StateKey
 */

// Export empty object since this is just for types
export default {};
