#!/usr/bin/env node
/**
 * Firebase MCP Setup Script
 * Generates serviceAccountKey.json from environment or manual input
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const serviceAccountPath = path.join(rootDir, '.firebase', 'serviceAccountKey.json');

console.log('🔥 Firebase MCP Setup\n');

// Check if already exists
if (fs.existsSync(serviceAccountPath)) {
  console.log('✅ Service account key already exists at:');
  console.log(`   ${serviceAccountPath}`);
  console.log('\nYou can now use Firebase MCP tools!');
  process.exit(0);
}

console.log('📋 To set up Firebase MCP, you need a service account key.');
console.log('\nOption 1: Generate from Firebase Console (Recommended)');
console.log('   1. Go to: https://console.firebase.google.com/project/kkr-groceries-02/settings/serviceaccounts');
console.log('   2. Click "Generate new private key"');
console.log('   3. Save the JSON file to:');
console.log(`      ${serviceAccountPath}`);
console.log('\nOption 2: If you have the service account JSON, paste it below:');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\nPaste service account JSON (or press Enter to skip): ', (json) => {
  if (json.trim()) {
    try {
      // Validate JSON
      const parsed = JSON.parse(json);
      if (!parsed.project_id || !parsed.private_key) {
        throw new Error('Invalid service account JSON');
      }
      
      // Write file
      fs.mkdirSync(path.dirname(serviceAccountPath), { recursive: true });
      fs.writeFileSync(serviceAccountPath, JSON.stringify(parsed, null, 2));
      
      console.log('\n✅ Service account key saved!');
      console.log(`   ${serviceAccountPath}`);
      console.log('\nYou can now use Firebase MCP tools!');
    } catch (e) {
      console.error('\n❌ Error:', e.message);
      console.log('\nPlease try again with valid JSON.');
      process.exit(1);
    }
  } else {
    console.log('\n⏭️  Skipped. Please manually add the service account key to:');
    console.log(`   ${serviceAccountPath}`);
  }
  
  rl.close();
});
