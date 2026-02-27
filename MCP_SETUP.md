# Firebase MCP Setup Guide

This project uses [Firebase MCP](https://github.com/gannonh/firebase-mcp) to enable AI assistants to interact with Firebase services directly.

## ✅ Current Status

**Last verified:** 2026-02-26

| Component | Status |
|-----------|--------|
| Service Account Key | ✅ Configured |
| Firestore Connection | ✅ Working |
| Storage Connection | ✅ Working |
| Auth Connection | ✅ Working |

## ⚡ Quick Start

### 1. Verify Setup

```bash
npm run mcp:test
```

This will test the connection and list your Firestore collections.

### 2. Manual Connection (for debugging)

```bash
npm run mcp:connect
```

## 🔧 Configuration

### Service Account Key

The service account key is already configured at:
```
.firebase/serviceAccountKey.json
```

If you need to regenerate it:
1. Go to [Firebase Console → Service Accounts](https://console.firebase.google.com/project/kkr-groceries-02/settings/serviceaccounts)
2. Click **"Generate new private key"**
3. Save the JSON file to `.firebase/serviceAccountKey.json`

### Environment Variables

| Variable | Value |
|----------|-------|
| `SERVICE_ACCOUNT_KEY_PATH` | `D:/AI/kkr-groceries-02/.firebase/serviceAccountKey.json` |
| `FIREBASE_STORAGE_BUCKET` | `kkr-groceries-02.firebasestorage.app` |
| `DEBUG_LOG_FILE` | `true` |

### IDE Configuration

#### Cursor IDE
Config: `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "firebase-mcp": {
      "command": "npx",
      "args": ["-y", "@gannonh/firebase-mcp"],
      "env": {
        "SERVICE_ACCOUNT_KEY_PATH": "D:/AI/kkr-groceries-02/.firebase/serviceAccountKey.json",
        "FIREBASE_STORAGE_BUCKET": "kkr-groceries-02.firebasestorage.app"
      }
    }
  }
}
```

#### VS Code  
Config: `.vscode/mcp.json`

```json
{
  "servers": {
    "firebase-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@gannonh/firebase-mcp"],
      "env": {
        "SERVICE_ACCOUNT_KEY_PATH": "D:/AI/kkr-groceries-02/.firebase/serviceAccountKey.json",
        "FIREBASE_STORAGE_BUCKET": "kkr-groceries-02.firebasestorage.app"
      }
    }
  }
}
```

## 🛠️ Available Tools

### Firestore Tools

| Tool | Description |
|------|-------------|
| `firestore_add_document` | Add a document to a collection |
| `firestore_list_documents` | List documents with filtering |
| `firestore_get_document` | Get a specific document |
| `firestore_update_document` | Update an existing document |
| `firestore_delete_document` | Delete a document |
| `firestore_list_collections` | List root collections |
| `firestore_query_collection_group` | Query across subcollections |

### Storage Tools

| Tool | Description |
|------|-------------|
| `storage_list_files` | List files in a directory |
| `storage_get_file_info` | Get file metadata and URL |
| `storage_upload` | Upload file from content |
| `storage_upload_from_url` | Upload file from URL |

### Authentication Tools

| Tool | Description |
|------|-------------|
| `auth_get_user` | Get user by ID or email |

## 💡 Usage Examples

### Query Orders

```
"List all orders from the orders collection"
"Get order ORD-123456 from Firestore"
"Update order status to 'Fulfilled' for order ORD-123456"
"Delete order ORD-123456"
```

### Manage Products

```
"Get all products from the products collection"
"Add a new product with name 'Carrot' and price 30"
"Update product price to 35 for product id 5"
"List all collections in Firestore"
```

### Storage Operations

```
"List all files in the images folder"
"Upload this image to storage/products/"
"Get download URL for file images/tomato.jpg"
```

### User Management

```
"Get user details for user ID abc123"
"Find user by email raju@example.com"
```

## 🔍 Troubleshooting

### Test Connection

```bash
node scripts/test-firebase-mcp.cjs
```

### View Logs

```bash
# View logs in real-time
npm run mcp:logs
```

Or check the log file: `debug.log` (in project root)

### Common Issues

**"Service account key not found"**
- Run `npm run mcp:setup` to generate the key
- Or manually download from Firebase Console

**"Firebase is not initialized"**
- Check that `serviceAccountKey.json` is valid
- Verify the service account has Firebase Admin role

**"The specified bucket does not exist"**
- Verify bucket name in Firebase Console → Storage
- Default bucket: `kkr-groceries-02.firebasestorage.app`

**"Missing or insufficient permissions"**
- Service account needs `Firebase Admin` role
- Go to Firebase Console → IAM & Admin → Service Accounts

### Debug Mode

Set `DEBUG_LOG_FILE=true` to enable detailed logging.

## 🔒 Security Notes

- ✅ Service account key is in `.firebase/` which is gitignored
- ✅ Never commit `serviceAccountKey.json` to Git
- ✅ Service account has admin privileges - keep it secure
- ✅ Use environment-specific service accounts for production

## 📊 Project Info

| Property | Value |
|----------|-------|
| **Project ID** | `kkr-groceries-02` |
| **Storage Bucket** | `kkr-groceries-02.firebasestorage.app` |
| **Region** | `asia-south1` |
| **Collections** | `mail`, `orders`, `presence`, `products`, `settings`, `users` |

## 📚 Additional Resources

- [Firebase MCP GitHub](https://github.com/gannonh/firebase-mcp)
- [Firebase Documentation](https://firebase.google.com/docs)
- [MCP Documentation](https://modelcontextprotocol.io/)
