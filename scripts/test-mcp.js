/**
 * Test script for Firebase MCP
 * Usage: node scripts/test-mcp.js
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get npx path - on Windows it may not be in PATH when spawned from Node
function getNpxPath() {
    const nodeDir = path.dirname(process.execPath);
    if (process.platform === 'win32') {
        return path.join(nodeDir, 'npx.cmd');
    }
    return 'npx';
}

// Check for service account key
const serviceAccountPath = path.join(__dirname, '..', '.firebase', 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Service account key not found at:', serviceAccountPath);
    console.error('Please run: node scripts/setup-mcp.js');
    process.exit(1);
}

console.log('🔧 Testing Firebase MCP connection...\n');

const npxPath = getNpxPath();
console.log('Using npx at:', npxPath);

// Start MCP server
const mcp = spawn(npxPath, ['-y', '@gannonh/firebase-mcp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: path.join(__dirname, '..')
});

let buffer = '';
let testComplete = false;

// Handle MCP output
mcp.stdout.on('data', (data) => {
    buffer += data.toString();
    
    // Process complete JSON-RPC messages
    let lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer
    
    for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
            const response = JSON.parse(line);
            console.log('📥 MCP Response:', JSON.stringify(response, null, 2));
            
            if (response.result && !testComplete) {
                testComplete = true;
                console.log('\n✅ Firebase MCP is working!');
                
                // Clean shutdown
                setTimeout(() => {
                    mcp.stdin.write(JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'exit',
                        id: 999
                    }) + '\n');
                    mcp.kill();
                    process.exit(0);
                }, 500);
            }
        } catch (e) {
            console.log('Raw output:', line);
        }
    }
});

mcp.stderr.on('data', (data) => {
    console.error('⚠️  MCP Error:', data.toString());
});

mcp.on('error', (err) => {
    console.error('❌ Failed to start MCP:', err.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure Node.js is installed');
    console.error('2. Try running: npm install -g @gannonh/firebase-mcp');
    console.error('3. Check that the service account key exists at .firebase/serviceAccountKey.json');
    process.exit(1);
});

mcp.on('close', (code) => {
    if (!testComplete) {
        console.log(`\nMCP process exited with code ${code}`);
    }
});

// Send initialize request
setTimeout(() => {
    console.log('📤 Sending initialize request...');
    mcp.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' }
        },
        id: 1
    }) + '\n');
}, 100);

// Send test request
setTimeout(() => {
    console.log('📤 Sending firestore_list_collections request...');
    mcp.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
            name: 'firestore_list_collections',
            arguments: {}
        },
        id: 2
    }) + '\n');
}, 500);

// Timeout
setTimeout(() => {
    if (!testComplete) {
        console.error('\n❌ Test timed out');
        mcp.kill();
        process.exit(1);
    }
}, 10000);
