# IPFS API Documentation

This document describes the IPFS integration endpoints in the CredVerse platform.

## 🌐 Base URL
```
/api/ipfs
```

## 📡 Endpoints

### 1. Upload Content to IPFS

**POST** `/upload`

Upload JSON payloads, files, or Verifiable Credentials to IPFS.

#### Request Types

##### Option A: JSON Payload (Recommended for VCs)
```bash
curl -X POST http://localhost:3001/api/ipfs/upload \
  -H "Content-Type: application/json" \
  -d '{
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "id": "urn:uuid:credential-123",
    "type": ["VerifiableCredential", "BachelorDegree"],
    "issuer": "did:ethr:0x123...",
    "credentialSubject": {
      "id": "did:ethr:0xstudent...",
      "name": "John Doe",
      "degree": "Computer Science"
    }
  }'
```

##### Option B: File Upload (multipart/form-data)
```bash
curl -X POST http://localhost:3001/api/ipfs/upload \
  -F "file=@/path/to/document.pdf"
```

#### Response
```json
{
  "success": true,
  "data": {
    "type": "json_payload",
    "cid": "bafkreiabcd1234567890...",
    "url": "https://ipfs.infura.io/ipfs/bafkreiabcd1234567890...",
    "size": 1024,
    "mimetype": "application/json",
    "uploadedAt": "2025-01-20T10:30:00.000Z",
    "content": { ... }
  },
  "message": "JSON payload uploaded to IPFS successfully"
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Invalid JSON payload"
}
```

### 2. Retrieve Content from IPFS

**GET** `/:cid`

Fetch and return content from IPFS using its Content Identifier (CID).

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `cid` | string | IPFS Content Identifier (required) |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `auto` | Response format: `auto` or `raw` |
| `download` | boolean | `false` | Force download as attachment |

#### Examples

##### Basic Retrieval
```bash
curl http://localhost:3001/api/ipfs/bafkreiabcd1234567890...
```

##### Raw Content
```bash
curl http://localhost:3001/api/ipfs/bafkreiabcd1234567890...?format=raw
```

##### Download as File
```bash
curl http://localhost:3001/api/ipfs/bafkreiabcd1234567890...?download=true
```

#### Response Types

##### JSON Content
```json
{
  "success": true,
  "data": {
    "cid": "bafkreiabcd1234567890...",
    "type": "json",
    "content": {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      "id": "urn:uuid:credential-123",
      ...
    },
    "retrievedAt": "2025-01-20T10:30:00.000Z",
    "size": 1024
  }
}
```

##### Text Content
```json
{
  "success": true,
  "data": {
    "cid": "bafkreiabcd1234567890...",
    "type": "text",
    "contentType": "text/plain",
    "content": "Hello, IPFS World!",
    "retrievedAt": "2025-01-20T10:30:00.000Z",
    "size": 18
  }
}
```

##### Binary Content
```json
{
  "success": true,
  "data": {
    "cid": "bafkreiabcd1234567890...",
    "type": "binary",
    "contentType": "application/pdf",
    "content": "<Binary data: 1048576 bytes>",
    "retrievedAt": "2025-01-20T10:30:00.000Z",
    "size": 1048576
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Content not found on IPFS",
  "cid": "bafkreiabcd1234567890...",
  "details": "timeout of 30000ms exceeded"
}
```

### 3. Upload Credential Metadata (Legacy)

**POST** `/metadata`

Upload structured credential metadata to IPFS. This is a legacy endpoint - use `/upload` for new implementations.

#### Request
```json
{
  "metadata": {
    "studentName": "John Doe",
    "courseName": "Computer Science",
    "institutionName": "Tech University",
    "graduationDate": "2024-06-15"
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "cid": "bafkreiabcd1234567890...",
    "url": "https://ipfs.infura.io/ipfs/bafkreiabcd1234567890...",
    "metadata": { ... }
  }
}
```

## 🔧 IPFS Service Methods

The following methods are available in `ipfsService.js`:

### Core Methods

#### `addFile(data, fileName)`
Upload any data to IPFS.

```javascript
const ipfsService = require('./services/ipfsService');

// Upload JSON object
const result = await ipfsService.addFile(jsonObject, 'credential.json');

// Upload buffer
const result = await ipfsService.addFile(buffer, 'document.pdf');

// Upload string
const result = await ipfsService.addFile('Hello World', 'hello.txt');
```

#### `getFile(cid, options)`
Retrieve file from IPFS as buffer.

```javascript
// Basic retrieval
const buffer = await ipfsService.getFile('bafkreiabcd...');

// With options
const buffer = await ipfsService.getFile('bafkreiabcd...', {
  timeout: 30000,
  maxSize: 10 * 1024 * 1024 // 10MB limit
});
```

### Convenience Methods

#### `getFileAsJson(cid)`
Retrieve and parse JSON content.

```javascript
const jsonData = await ipfsService.getFileAsJson('bafkreiabcd...');
```

#### `getFileAsText(cid, encoding)`
Retrieve as text content.

```javascript
const textContent = await ipfsService.getFileAsText('bafkreiabcd...', 'utf8');
```

#### `fileExists(cid)`
Check if content exists on IPFS.

```javascript
const exists = await ipfsService.fileExists('bafkreiabcd...');
```

### Legacy Methods

#### `uploadCredentialMetadata(metadata)`
Upload structured credential metadata.

#### `getCredentialMetadata(cid)`
Retrieve credential metadata.

#### `uploadImage(buffer, fileName)`
Upload image or binary data.

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Start the server first
npm run server:dev

# In another terminal, run tests
node scripts/test-ipfs.js
```

### Test Coverage

The test suite verifies:
- ✅ JSON payload upload
- ✅ JSON content retrieval 
- ✅ Raw content retrieval
- ✅ Text file upload/retrieval
- ✅ Error handling for non-existent files
- ✅ Content verification integrity

### Sample Test Output
```
🚀 Starting IPFS functionality tests...
🔗 Testing against: http://localhost:3001/api/ipfs

🧪 Testing JSON payload upload...
✅ JSON upload successful!
📄 CID: bafkreif4zsrxs7w3z2rk4xj7q8ybxm...
🔗 URL: https://ipfs.infura.io/ipfs/bafkreif4zsrxs7w3z2rk4xj7q8ybxm...
📏 Size: 987 bytes

🧪 Testing JSON retrieval for CID: bafkreif4zsrxs7w3z2rk4xj7q8ybxm...
✅ JSON retrieval successful!
📄 Type: json
📏 Size: 987 bytes
✅ Content verification successful - uploaded and retrieved data match!

📊 Test Summary:
✅ Passed: 6/6
❌ Failed: 0/6
🎉 All tests passed! IPFS functionality is working correctly.
```

## ⚙️ Configuration

### Environment Variables

```bash
# IPFS Configuration
IPFS_PROJECT_ID=your_infura_project_id
IPFS_PROJECT_SECRET=your_infura_project_secret
IPFS_GATEWAY_URL=https://ipfs.infura.io/ipfs

# Alternative: Local IPFS node
# (if Infura credentials not provided)
IPFS_HOST=localhost
IPFS_PORT=5001
IPFS_PROTOCOL=http
```

### File Upload Limits

- **Maximum file size**: 10MB
- **Supported MIME types**:
  - `image/jpeg`, `image/png`, `image/gif`, `image/webp`
  - `application/pdf`
  - `application/json`
  - `text/plain`
  - `application/octet-stream`

### IPFS Retrieval Limits

- **Default timeout**: 30 seconds
- **Default max size**: 50MB
- **Configurable per request** via options parameter

## 🚨 Error Handling

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid CID format | CID doesn't match expected pattern |
| 400 | Invalid JSON payload | Malformed JSON in request body |
| 400 | File type not allowed | MIME type not in allowed list |
| 404 | Content not found on IPFS | CID doesn't exist or not reachable |
| 413 | File too large | Exceeds maximum size limits |
| 500 | IPFS client not initialized | Service configuration error |
| 500 | Upload failed | Network or IPFS service error |

### Error Response Format

```json
{
  "success": false,
  "error": "Content not found on IPFS",
  "cid": "bafkreiabcd1234567890...",
  "details": "Additional error information"
}
```

## 🔐 Security & Best Practices

### Access Control
- Upload endpoints use `optionalAuth` middleware
- No authentication required for public retrieval
- Institution-specific uploads when authenticated

### Content Validation
- JSON payloads are validated before upload
- File types are restricted via MIME type filtering
- Size limits prevent abuse

### Performance Optimization
- Content is automatically pinned on upload
- CID version 1 used for better performance
- Streaming for large file retrieval

### Privacy Considerations
- All uploaded content is **public** on IPFS
- Don't upload sensitive data without encryption
- Consider using private IPFS networks for sensitive credentials

---

## 💡 Usage Examples

### Complete Credential Flow

```javascript
// 1. Issue a credential and upload to IPFS
const credential = await veramoService.issueCredential(credentialData);
const uploadResult = await ipfsService.addFile(credential, 'credential.json');

// 2. Store CID on blockchain
await contractService.issueCredential(
  credentialId, 
  studentAddress, 
  uploadResult.cid, 
  'BachelorDegree', 
  expirationDate
);

// 3. Later: Retrieve and verify
const retrievedCredential = await ipfsService.getFileAsJson(uploadResult.cid);
const isValid = await veramoService.verifyCredential(retrievedCredential);
```

### Integration with Frontend

```typescript
// Upload credential from frontend
const uploadCredential = async (credentialData: any) => {
  const response = await fetch('/api/ipfs/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentialData)
  });
  
  const result = await response.json();
  return result.data.cid;
};

// Retrieve credential for verification
const retrieveCredential = async (cid: string) => {
  const response = await fetch(`/api/ipfs/${cid}`);
  const result = await response.json();
  return result.data.content;
};
```