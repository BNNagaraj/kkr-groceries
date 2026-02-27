#!/usr/bin/env node
/**
 * Firebase MCP Connection Test Script
 * 
 * This script tests the Firebase MCP connection
 * Usage: node scripts/test-firebase-mcp.cjs
 */

const { spawn } = require('child_process');
const path = require('path');
const { promisify } = require('util');
const fs = require('fs');

const SERVICE_ACCOUNT_KEY_PATH = path.resolve(__dirname, '../.firebase/serviceAccountKey.json');
const STORAGE_BUCKET = 'kkr-groceries-02.firebasestorage.app';

console.log('🔥 Firebase MCP Connection Test\n');
console.log('Service Account:', SERVICE_ACCOUNT_KEY_PATH);
console.log('Storage Bucket:', STORAGE_BUCKET);

// Verify service account exists
if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
  console.error('\n❌ Service account key not found!');
  console.log('\n💡 Please download it from Firebase Console:');
  console.log('   https://console.firebase.google.com/project/kkr-groceries-02/settings/serviceaccounts');
  console.log('\n   Save it to: .firebase/serviceAccountKey.json');
  process.exit(1);
}

console.log('\n✅ Service account key found');
console.log('⏳ Starting Firebase MCP server...\n');

// Start the Firebase MCP server
const mcpProcess = spawn('node', [
  'C:/Program Files/nodejs/node_modules/npm/bin/npx-cli.js',
  '-y',
  '@gannonh/firebase-mcp'
], {
  env: {
    ...process.env,
    SERVICE_ACCOUNT_KEY_PATH,
    FIREBASE_STORAGE_BUCKET: STORAGE_BUCKET,
    DEBUG_LOG_FILE: 'true'
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

let requestId = 0;
const pendingRequests = new Map();

function sendRequest(method, params = {}) {
  requestId++;
  const request = {
    jsonrpc: '2.0',
    id: requestId,
    method,
    params
  };
  const requestStr = JSON.stringify(request);
  console.log('📤 Sending:', method);
  mcpProcess.stdin.write(requestStr + '\n');
  
  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error(`Request ${requestId} timed out`));
      }
    }, 10000);
  });
}

// Handle output
let buffer = '';
mcpProcess.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();
  
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      
      if (msg.id && pendingRequests.has(msg.id)) {
        const { resolve } = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        resolve(msg);
      } else if (msg.method === 'notifications/message') {
        // Server notification
        if (msg.params && msg.params.message) {
          console.log('📢', msg.params.message);
        }
      }
    } catch (e) {
      // Not JSON - log it
      console.log('>', line.substring(0, 100));
    }
  }
});

mcpProcess.stderr.on('data', (data) => {
  const str = data.toString().trim();
  if (str.includes('[INFO]')) {
    console.log('ℹ️ ', str.replace(/\[INFO\]\s*/i, ''));
  } else if (str.includes('[DEBUG]')) {
    // Suppress debug messages
  } else {
    console.error('⚠️ ', str);
  }
});

mcpProcess.on('error', (err) => {
  console.error('❌ Failed to start MCP server:', err.message);
  process.exit(1);
});

// Run tests
async function runTests() {
  try {
    // Wait for server to initialize
    console.log('Waiting for server initialization...\n');
    await new Promise(r => setTimeout(r, 3000));
    
    // Initialize MCP connection
    const initResponse = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });
    console.log('✅ MCP initialized\n');
    
    // List available tools
    const toolsResponse = await sendRequest('tools/list', {});
    if (toolsResponse.result && toolsResponse.result.tools) {
      console.log('🔧 Available Tools:');
      toolsResponse.result.tools.forEach(tool => {
        console.log(`   • ${tool.name} - ${tool.description?.substring(0, 60) || 'No description'}...`);
      });
      console.log();
    }
    
    // List Firestore collections
    const collectionsResponse = await sendRequest('tools/call', {
      name: 'firestore_list_collections',
      arguments: {}
    });
    
    console.log('📂 Firestore Collections:');
    if (collectionsResponse.result && collectionsResponse.result.content) {
      collectionsResponse.result.content.forEach(item => {
        console.log('   •', item.text);
      });
    }
    
    // Get orders count
    const ordersResponse = await sendRequest('tools/call', {
      name: 'firestore_list_documents',
      arguments: {
        collection: 'orders',
        limit: 5
      }
    });
    
    console.log('\n📋 Sample Orders (first 5):');
    if (ordersResponse.result && ordersResponse.result.content) {
      ordersResponse.result.content.forEach(item => {
        const lines = item.text.split('\n');
        const orderId = lines[0]?.replace('Document ID: ', '') || 'Unknown';
        console.log(`   • ${orderId}`);
      });
    }
    
    console.log('\n🎉 Firebase MCP is working correctly!\n');
    console.log('You can now use Firebase MCP in your AI assistant.');
    
    mcpProcess.kill();
    process.exit(0);
    
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    mcpProcess.kill();
    process.exit(1);
  }
}

// Start tests after a brief delay
setTimeout(runTests, 2000);

// Timeout after 60 seconds
setTimeout(() => {
  console.error('\n⏱️ Connection test timed out');
  mcpProcess.kill();
  process.exit(1);
}, 60000);
