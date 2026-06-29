const KNOWN_BROKEN_IMAGE_PATTERNS = [
    'photo-1604568102377-f273edcfebbc',
    'photo-1596639556108-7a544df8bb3f',
    'photo-1568584711462-24cc6ad04aa6',
    'photo-1597362925123-77861d3bfac1',
    'Green_chilli_closeup.jpg',
    'Okra_%28Abelmoschus_esculentus%29_%283%29',
    'Vegetable-Ede-carrot.jpg',
    'Spinach_leaves.jpg/220px',
    'Bottle_gourd.jpg/220px'
];

export function isKnownBrokenImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const normalizedUrl = url.toLowerCase();
    return KNOWN_BROKEN_IMAGE_PATTERNS.some((pattern) => normalizedUrl.includes(pattern.toLowerCase()));
}

export function isRenderableImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('data:image/')) return true;

    try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.toLowerCase();
        if (host.includes('wikimedia.org') || host.includes('wikipedia.org')) {
            return false;
        }
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch (_) {
        return false;
    }
}

export function getWikimediaFallbackForProduct(productOrName) {
    // Wikimedia fallback removed. Product images should be uploaded manually.
    void productOrName;
    return '';
}

export function resolveProductImage(productOrName, imageUrl) {
    void productOrName;
    const trimmedImage = typeof imageUrl === 'string' ? imageUrl.trim() : '';

    if (trimmedImage && !isKnownBrokenImageUrl(trimmedImage) && isRenderableImageUrl(trimmedImage)) {
        return trimmedImage;
    }

    return '';
}
