import { showToast } from '../utils/dom.js';

let autocomplete, geocoder;
const HYDERABAD = { lat: 17.385, lng: 78.4867 };

// Initialize empty globals to share with addressing script naturally.
window.deliveryMap = null;
window.deliveryMarker = null;

export function initMapServices() {
    if (typeof window.google === 'undefined') return;
    geocoder = new window.google.maps.Geocoder();

    const input = document.getElementById('deliveryLocation');
    if (input) {
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
            extractPincode(place.address_components);
            updateMapHint(place.formatted_address || place.name);
        });
    }
}

export function initDeliveryMap() {
    if (typeof window.google === 'undefined') return;
    const mapDiv = document.getElementById('deliveryMap');
    if (!mapDiv) return;

    if (window.deliveryMap) {
        window.google.maps.event.trigger(window.deliveryMap, 'resize');
        window.deliveryMap.setCenter(window.deliveryMarker.getPosition());
        return;
    }

    window.deliveryMap = new window.google.maps.Map(mapDiv, {
        center: HYDERABAD,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] }
        ]
    });

    window.deliveryMarker = new window.google.maps.Marker({
        position: HYDERABAD,
        map: window.deliveryMap,
        draggable: true,
        animation: window.google.maps.Animation.DROP,
        title: 'Drag me to your delivery location'
    });

    window.deliveryMarker.addListener('dragend', function () {
        const pos = window.deliveryMarker.getPosition();
        reverseGeocode({ lat: pos.lat(), lng: pos.lng() });
    });

    window.deliveryMap.addListener('click', function (e) {
        const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        window.deliveryMarker.setPosition(pos);
        window.deliveryMarker.setAnimation(window.google.maps.Animation.DROP);
        reverseGeocode(pos);
    });
}

// Internal helper, shouldn't need export 
async function reverseGeocode(latlng) {
    if (!geocoder) return;
    const input = document.getElementById('deliveryLocation');
    try {
        const response = await geocoder.geocode({ location: latlng });
        if (response.results && response.results[0]) {
            input.value = response.results[0].formatted_address;
            extractPincode(response.results[0].address_components);
            updateMapHint(response.results[0].formatted_address);
        }
    } catch (e) {
        showToast('Could not resolve address', 'error');
    }
}

function extractPincode(components) {
    if (!components) return;
    const pin = components.find(c => c.types.includes('postal_code'));
    if (pin) document.getElementById('pincode').value = pin.long_name;
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

    btn.innerHTML = '⏳ Locating...';
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
            showToast('Location found!', 'success');
            btn.innerHTML = '📍 Use Current Location';
            btn.disabled = false;
        },
        (error) => {
            showToast('Unable to retrieve your location. Please allow location access.', 'error');
            btn.innerHTML = '📍 Use Current Location';
            btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}
