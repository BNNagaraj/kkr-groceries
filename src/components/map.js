import { showToast } from '../utils/dom.js';
import { state } from '../store.js';

let autocomplete, geocoder;
const HYDERABAD_CENTER = { lat: 17.385, lng: 78.4867 };

// Initialize empty globals to share with addressing script naturally.
window.deliveryMap = null;
window.deliveryMarker = null;
window.deliveryCircle = null;

// Custom Brand Styling for the map (Dark Green UI elements)
const customMapStyles = [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
    { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9e8e2" }] }, // Soft teal for water
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#ecfdf5" }] } // Light emerald land
];

// Helper to check geofence distance
window.checkGeofence = function (pos) {
    if (!window.google || !window.google.maps.geometry) return true;

    const center = new window.google.maps.LatLng(HYDERABAD_CENTER.lat, HYDERABAD_CENTER.lng);
    const current = new window.google.maps.LatLng(typeof pos.lat === 'function' ? pos.lat() : pos.lat, typeof pos.lng === 'function' ? pos.lng() : pos.lng);

    const distanceMeters = window.google.maps.geometry.spherical.computeDistanceBetween(center, current);
    const distanceKilo = distanceMeters / 1000;

    const maxRadius = state.geofenceRadiusKm || 50;

    if (distanceKilo > maxRadius) {
        showToast(`Selected location is ${distanceKilo.toFixed(1)}km away. Max delivery radius is ${maxRadius}km.`, 'error');
        document.getElementById('submitBtn').disabled = true;
        document.getElementById('submitBtn').style.opacity = '0.5';
        document.getElementById('submitBtn').querySelector('span').textContent = 'Out of Delivery Zone';
        return false;
    }
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitBtn').style.opacity = '1';
    document.getElementById('submitBtn').querySelector('span').textContent = 'Send Order Request';
    return true;
}

export function initMapServices() {
    if (typeof window.google === 'undefined' || !window.google.maps) {
        console.warn('Google Maps API not loaded. Address autocomplete will be disabled.');
        return;
    }
    
    try {
        geocoder = new window.google.maps.Geocoder();
    } catch (e) {
        console.error('Failed to initialize Geocoder:', e);
        return;
    }

    const input = document.getElementById('deliveryLocation');
    if (!input) return;
    
    // Initialize legacy Autocomplete (stable API)
    if (window.google?.maps?.places) {
        initLegacyAutocomplete(input);
    }
}

// Legacy Autocomplete fallback function
function initLegacyAutocomplete(input) {
    try {
        autocomplete = new window.google.maps.places.Autocomplete(input, {
            componentRestrictions: { country: 'in' },
            fields: ['formatted_address', 'geometry', 'address_components', 'name'],
        });
        
        autocomplete.addListener('place_changed', function () {
            const place = autocomplete.getPlace();
            if (!place.geometry || !place.geometry.location) {
                showToast('Could not find that place, try again', 'error');
                return;
            }
            const loc = place.geometry.location;
            if (window.deliveryMap && window.deliveryMarker) {
                window.deliveryMap.setCenter(loc);
                window.deliveryMap.setZoom(16);
                window.deliveryMarker.setPosition(loc);
                window.deliveryMarker.setAnimation(window.google.maps.Animation.DROP);
            }
            input.value = place.formatted_address || place.name;
            extractAddressComponents(place.address_components);
            updateMapHint(place.formatted_address || place.name);
            window.checkGeofence(loc);
        });
    } catch (e) {
        console.warn('Legacy Autocomplete also failed:', e);
        // Continue without autocomplete - manual entry still works
    }
}

export function initDeliveryMap() {
    if (typeof window.google === 'undefined' || !window.google.maps) {
        // Show fallback message when Google Maps is not available
        const mapDiv = document.getElementById('deliveryMap');
        if (mapDiv) {
            mapDiv.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f8fafc;padding:1rem;text-align:center;">
                    <div style="color:#64748b;">
                        <div style="font-size:2rem;margin-bottom:0.5rem;">🗺️</div>
                        <div style="font-size:0.9rem;font-weight:600;margin-bottom:0.25rem;">Map Unavailable</div>
                        <div style="font-size:0.8rem;">Please enter your address manually below</div>
                    </div>
                </div>
            `;
        }
        return;
    }
    const mapDiv = document.getElementById('deliveryMap');
    if (!mapDiv) return;

    if (window.deliveryMap) {
        window.google.maps.event.trigger(window.deliveryMap, 'resize');
        window.deliveryMap.setCenter(window.deliveryMarker.getPosition());
        return;
    }

    // Option 2: Custom Brand Styling applied
    window.deliveryMap = new window.google.maps.Map(mapDiv, {
        center: HYDERABAD_CENTER,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        styles: customMapStyles
    });

    // Option 5: Serviceability Radius geofence circle
    if (window.google.maps.Circle) {
        const currentRadius = state.geofenceRadiusKm || 50;
        window.deliveryCircle = new window.google.maps.Circle({
            strokeColor: "#059669",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#10b981",
            fillOpacity: 0.1,
            map: window.deliveryMap,
            center: HYDERABAD_CENTER,
            radius: currentRadius * 1000,
            clickable: false
        });
    }

    window.deliveryMarker = new window.google.maps.Marker({
        position: HYDERABAD_CENTER,
        map: window.deliveryMap,
        draggable: true,
        animation: window.google.maps.Animation.DROP,
        title: 'Drag me to your delivery location'
    });

    window.deliveryMarker.addListener('dragend', function () {
        const pos = window.deliveryMarker.getPosition();
        reverseGeocode({ lat: pos.lat(), lng: pos.lng() });
        window.checkGeofence(pos);
    });

    window.deliveryMap.addListener('click', function (e) {
        const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        window.deliveryMarker.setPosition(pos);
        window.deliveryMarker.setAnimation(window.google.maps.Animation.DROP);
        reverseGeocode(pos);
        window.checkGeofence(pos);
    });
}

async function reverseGeocode(latlng) {
    if (!geocoder) return;
    const input = document.getElementById('deliveryLocation');
    try {
        const response = await geocoder.geocode({ location: latlng });
        if (response.results && response.results[0]) {
            input.value = response.results[0].formatted_address;
            extractAddressComponents(response.results[0].address_components); // Structured parsing
            updateMapHint(response.results[0].formatted_address);
        }
    } catch (e) {
        showToast('Could not resolve address', 'error');
    }
}

// Option 3: Structured Form Autofill
function extractAddressComponents(components) {
    if (!components) return;

    let street = "", city = "", state = "", pincode = "";

    components.forEach((c) => {
        if (c.types.includes("route") || c.types.includes("sublocality")) street += c.long_name + ", ";
        if (c.types.includes("locality")) city = c.long_name;
        if (c.types.includes("administrative_area_level_1")) state = c.long_name;
        if (c.types.includes("postal_code")) pincode = c.long_name;
    });

    street = street.replace(/,\s*$/, "");

    // Attempt to inject parsed structured data into hidden fields or DOM attributes
    // so `main.js` can attach it to Firebase
    const form = document.getElementById('enquiryForm');
    if (form) {
        form.setAttribute('data-street', street);
        form.setAttribute('data-city', city);
        form.setAttribute('data-state', state);
        form.setAttribute('data-pincode', pincode);
    }

    if (pincode) {
        const input = document.getElementById('pincode');
        // Legacy support if there was a separate static input for it
        if (input) input.value = pincode;
    }
}

function updateMapHint(addr) {
    const hint = document.getElementById('mapHint');
    if (hint && addr) {
        const short = addr.length > 50 ? addr.substring(0, 50) + '...' : addr;
        hint.textContent = '✅ ' + short;
    }
}

export function getCurrentLocation() {
    const btn = document.getElementById('locateBtn');
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'error');
        return;
    }
    if (typeof window.google === 'undefined') {
        showToast('Google Maps not loaded. Check your API Key.', 'error');
        return;
    }

    btn.innerHTML = '⏳ Locating precisely...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
            if (window.deliveryMap && window.deliveryMarker) {
                window.deliveryMap.setCenter(pos);
                window.deliveryMap.setZoom(16);
                window.deliveryMarker.setPosition(pos);
                window.deliveryMarker.setAnimation(window.google.maps.Animation.DROP);
            }
            reverseGeocode(pos);
            window.checkGeofence(pos);
            showToast('High-Precision Location locked!', 'success');
            btn.innerHTML = '📍 Use Current Location';
            btn.disabled = false;
        },
        (error) => {
            showToast('Unable to retrieve your location. Please allow location access.', 'error');
            btn.innerHTML = '📍 Use Current Location';
            btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Option 1: Locate Me Accuracy
    );
}

export function updateMapCircle() {
    if (window.deliveryCircle) {
        const rad = (state.geofenceRadiusKm || 50) * 1000;
        window.deliveryCircle.setRadius(rad);
    }
}
