# Firebase MCP Setup Guide

This project uses [Firebase MCP](https://github.com/gannonh/firebase-mcp) to enable AI assistants to interact with Firebase services directly.

## ⚡ Quick Setup

### 1. Generate Service Account Key

The Firebase MCP server requires a service account key with admin privileges.

```bash
# Run setup wizard
npm run mcp:setup
```

Or manually:

1. Go to [Firebase Console → Service Accounts](https://console.firebase.google.com/project/kkr-groceries-02/settings/serviceaccounts)
2. Click **"Generate new private key"**
3. Save the JSON file to `.firebase/serviceAccountKey.json`

### 2. Test Connection

```bash
npm run mcp:test
```

### 3. View Logs (if needed)

```bash
npm run mcp:logs
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVICE_ACCOUNT_KEY_PATH` | Path to service account JSON | `.firebase/serviceAccountKey.json` |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket | `kkr-groceries-02.firebasestorage.app` |
| `DEBUG_LOG_FILE` | Enable debug logging | `true` |

### IDE Configuration

#### Cursor IDE
Config: `.cursor/mcp.json`

#### VS Code  
Config: `.vscode/mcp.json`

#### Claude Desktop (macOS/Linux)
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "firebase-mcp": {
      "command": "npx",
      "args": ["-y", "@gannonh/firebase-mcp"],
      "env": {
        "SERVICE_ACCOUNT_KEY_PATH": "/absolute/path/to/kkr-groceries-02/.firebase/serviceAccountKey.json",
        "FIREBASE_STORAGE_BUCKET": "kkr-groceries-02.firebasestorage.app"
      }
    }
  }
}
```

## Available MCP Tools

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

## Usage Examples

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

## Troubleshooting

### Debug Logs

```bash
# View logs in real-time
npm run mcp:logs
```

Logs are also saved to: `~/.firebase-mcp/debug.log`

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

### Test All Tools

Ask your AI assistant:
```
"Please test all Firebase MCP tools and list my Firestore collections"
```

## Security Notes

- ✅ Service account key is in `.firebase/` which is gitignored
- ✅ Never commit `serviceAccountKey.json` to Git
- ✅ Service account has admin privileges - keep it secure
- ✅ Use environment-specific service accounts for production

## Project Info

- **Project ID:** `kkr-groceries-02`
- **Storage Bucket:** `kkr-groceries-02.firebasestorage.app`
- **Region:** `asia-south1`

## Additional Resources

- [Firebase MCP GitHub](https://github.com/gannonh/firebase-mcp)
- [Firebase Documentation](https://firebase.google.com/docs)
- [MCP Documentation](https://modelcontextprotocol.io/)
