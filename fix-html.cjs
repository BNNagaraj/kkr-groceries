const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Strip all style tags and their contents
html = html.replace(/<style>[\s\S]*?<\/style>/g, '');

// Strip the main script tag (the one containing FIREBASE CONFIG)
html = html.replace(/<script>[\s\S]*?\/\/ ===== FIREBASE CONFIG =====[\s\S]*?<\/script>/, '<script type="module" src="/src/main.js"></script>');

// Update Google Maps key placeholder
html = html.replace('AIzaSyCcVIg-biOWJHDatqjifBLeHdchX95ncwc', '%VITE_GOOGLE_MAPS_KEY%');

fs.writeFileSync('index.html', html, 'utf8');
console.log('Fixed index.html size:', html.length);
