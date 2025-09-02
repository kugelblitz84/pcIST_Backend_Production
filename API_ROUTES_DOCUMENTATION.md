# API Routes Summary

## PAD Statement Routes

### 1. Send PAD Statement via Email
**POST** `/pad/send`
```json
{
  "receiverEmail": "recipient@example.com",
  "subject": "PAD Statement from pcIST",
  "statement": "This is the content of the PAD statement...",
  "authorizers": [
    {
      "name": "John Doe", 
      "role": "President"
    },
    {
      "name": "Jane Smith", 
      "role": "Secretary"
    }
  ],
  "contactEmail": "contact@pcist.org",
  "contactPhone": "+880-123-456-7890",
  "address": "Institute of Science & Technology (IST), Dhaka"
}
```

### 2. Download PAD Statement (Generate New)
**POST** `/pad/download`
```json
{
  "statement": "This is the content of the PAD statement...",
  "authorizers": [
    {
      "name": "John Doe", 
      "role": "President"
    }
  ],
  "contactEmail": "contact@pcist.org",
  "contactPhone": "+880-123-456-7890"
}
```
**Response:** PDF file download

### 3. Download PAD Statement by Serial
**GET** `/pad/download/:serial`

Example: `GET /pad/download/pcIST-2025-0001`

**Response:** PDF file download

### 4. Get PAD Statement History
**GET** `/pad/history`

**Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "_id": "...",
      "serial": "pcIST-2025-0001",
      "receiverEmail": "recipient@example.com",
      "statement": "...",
      "dateStr": "02 September 2025",
      "sent": true,
      "sentAt": "2025-09-02T10:30:00.000Z",
      "downloadedAt": "2025-09-02T11:00:00.000Z"
    }
  ]
}
```

---

## Invoice Routes

### 1. Send Invoice via Email
**POST** `/invoice/send`
```json
{
  "receiverEmail": "client@example.com",
  "subject": "Invoice from pcIST",
  "products": [
    {
      "description": "Website Development",
      "quantity": 1,
      "unitPrice": 15000
    },
    {
      "description": "Database Design",
      "quantity": 2,
      "unitPrice": 5000
    }
  ],
  "authorizerName": "John Doe",
  "authorizerDesignation": "President, Programming Club of IST",
  "contactEmail": "info@pcist.org",
  "contactPhone": "+880-123-456-7890"
}
```

### 2. Download Invoice (Generate New)
**POST** `/invoice/download`
```json
{
  "products": [
    {
      "description": "Website Development",
      "quantity": 1,
      "unitPrice": 15000
    }
  ],
  "authorizerName": "John Doe",
  "authorizerDesignation": "President, Programming Club of IST",
  "contactEmail": "info@pcist.org"
}
```
**Response:** PDF file download

### 3. Download Invoice by Serial
**GET** `/invoice/download/:serial`

Example: `GET /invoice/download/INV-2025-0001`

**Response:** PDF file download

### 4. Get Invoice History
**GET** `/invoice/history?page=1&limit=10`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "serial": "INV-2025-0001",
      "grandTotal": 25000,
      "authorizerName": "John Doe",
      "dateStr": "02 September 2025",
      "sentViaEmail": true,
      "downloadedAt": "2025-09-02T11:00:00.000Z",
      "createdAt": "2025-09-02T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

---

## Frontend Usage Examples

### JavaScript/React Example
```javascript
// Download invoice by serial
const downloadInvoice = async (serial) => {
  try {
    const response = await fetch(`/invoice/download/${serial}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token // if auth required
      }
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${serial}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Download failed:', error);
  }
};

// Get invoice history
const getInvoices = async (page = 1) => {
  const response = await fetch(`/invoice/history?page=${page}&limit=10`);
  const data = await response.json();
  return data;
};
```

### cURL Examples
```bash
# Download PAD statement by serial
curl -X GET "http://localhost:4000/pad/download/pcIST-2025-0001" \
  -H "Content-Type: application/json" \
  --output "pad-statement.pdf"

# Download invoice by serial
curl -X GET "http://localhost:4000/invoice/download/INV-2025-0001" \
  -H "Content-Type: application/json" \
  --output "invoice.pdf"

# Get invoice history
curl -X GET "http://localhost:4000/invoice/history?page=1&limit=5" \
  -H "Content-Type: application/json"
```

---

## Notes

1. **Serial Numbers:**
   - PAD statements: `pcIST-YYYY-NNNN` (e.g., pcIST-2025-0001)
   - Invoices: `INV-YYYY-NNNN` (e.g., INV-2025-0001)

2. **Authentication:**
   - Add authentication headers if your routes require authorization

3. **Error Handling:**
   - All routes return standard JSON error responses
   - HTTP status codes: 200 (success), 400 (bad request), 404 (not found), 500 (server error)

4. **File Downloads:**
   - PDF files are returned with appropriate headers
   - Content-Type: application/pdf
   - Content-Disposition: attachment; filename="serial.pdf"
