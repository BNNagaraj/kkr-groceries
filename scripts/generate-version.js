/**
 * Generate version.json for cache busting
 * Run this before building: node scripts/generate-version.js
 */

const fs = require('fs');
const path = require('path');

// Generate version based on timestamp
const version = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const versionData = {
    version: version,
    buildTime: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || 'dev'
};

// Write to public/version.json (will be copied to dist)
fs.writeFileSync(
    path.join(__dirname, '../public/version.json'),
    JSON.stringify(versionData, null, 2)
);

console.log(`[Version] Generated: ${version}`);
