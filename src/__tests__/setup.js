/**
 * Vitest Test Setup
 */

import { vi } from 'vitest';

// Mock Firebase
global.firebase = {
    initializeApp: vi.fn(),
    auth: vi.fn(() => ({
        onAuthStateChanged: vi.fn(),
        signOut: vi.fn()
    })),
    firestore: vi.fn(() => ({
        collection: vi.fn(),
        doc: vi.fn()
    })),
    functions: vi.fn(() => ({
        httpsCallable: vi.fn()
    })),
    storage: vi.fn(),
    apps: []
};

// Mock window.google
global.google = {
    maps: {
        Map: vi.fn(),
        Marker: vi.fn(),
        Circle: vi.fn(),
        LatLng: vi.fn(),
        places: {
            Autocomplete: vi.fn()
        },
        geometry: {
            spherical: {
                computeDistanceBetween: vi.fn(() => 10000)
            }
        },
        Animation: {
            DROP: 'drop'
        }
    }
};

// Mock Chart.js
global.Chart = vi.fn();

// Mock Cropper.js
global.Cropper = vi.fn();

// Mock navigator.geolocation
global.navigator.geolocation = {
    getCurrentPosition: vi.fn((success) => {
        success({
            coords: {
                latitude: 17.385,
                longitude: 78.4867
            }
        });
    })
};

// Clean up after each test
afterEach(() => {
    document.body.innerHTML = '';
});
