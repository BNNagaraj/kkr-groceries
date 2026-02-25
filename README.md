# KKR Groceries

Hyderabad's trusted B2B vegetable wholesale partner. Fresh produce from APMC markets to hotels, restaurants, and retailers.

## 🔥 Firebase MCP Integration

This project includes Firebase MCP for AI-powered Firebase operations.

### Quick Start

```bash
# 1. Setup Firebase MCP (generates service account key)
npm run mcp:setup

# 2. Test the connection
npm run mcp:test

# 3. View logs if needed
npm run mcp:logs
```

### MCP Tools Available

| Service | Tools |
|---------|-------|
| **Firestore** | `firestore_add_document`, `firestore_list_documents`, `firestore_get_document`, `firestore_update_document`, `firestore_delete_document`, `firestore_list_collections` |
| **Storage** | `storage_list_files`, `storage_get_file_info`, `storage_upload`, `storage_upload_from_url` |
| **Auth** | `auth_get_user` |

### Example Queries

```
"List all orders from Firestore"
"Get product details for Tomato"
"Update order status to 'Fulfilled'"
"List files in the images folder"
```

📖 **Full Setup Guide:** [MCP_SETUP.md](MCP_SETUP.md)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

## Project Structure

```
├── .cursor/mcp.json      # Cursor IDE MCP config
├── .vscode/mcp.json      # VS Code MCP config
├── .firebase/            # Firebase service account key
├── src/                  # Source code
├── functions/            # Firebase Functions
├── scripts/              # Utility scripts
│   ├── setup-mcp.js     # MCP setup wizard
│   └── test-mcp.js      # MCP connection test
└── MCP_SETUP.md          # Detailed MCP setup guide
```

## Deployment

```bash
# Deploy to Firebase
npx firebase deploy

# Or with npm script
npm run build && npx firebase deploy --only hosting
```

Live at: https://kkr-groceries-02.web.app

## Firebase Project

- **Project ID:** `kkr-groceries-02`
- **Storage Bucket:** `kkr-groceries-02.firebasestorage.app`
- **Region:** `asia-south1`

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run test` | Run Vitest tests |
| `npm run mcp:setup` | Setup Firebase MCP |
| `npm run mcp:test` | Test MCP connection |
| `npm run mcp:logs` | View MCP debug logs |
