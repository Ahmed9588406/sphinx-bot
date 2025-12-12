# n8n Workflows for Sphinx Fit Bot

## Available Workflows

### 1. `sphinx-bot-workflow.json` - Basic Integration
A simple workflow with:
- **Webhook Trigger**: Receives incoming messages
- **HTTP Request**: Calls your Sphinx Bot API
- **Response**: Returns the bot reply
- **Health Check**: Hourly ping to keep the bot warm

### 2. `sphinx-whatsapp-workflow.json` - WhatsApp Integration
Full WhatsApp Business API integration:
- Receives WhatsApp messages via webhook
- Extracts message and sender info
- Calls Sphinx Bot API
- Sends reply back to WhatsApp

---

## How to Import in n8n

1. Open your n8n instance
2. Go to **Workflows** → **Import from File**
3. Select the JSON file you want to import
4. Click **Import**

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `https://sphinx-bot.vercel.app/api/chat` | POST | Send message, get AI reply |
| `https://sphinx-bot.vercel.app/api/chat` | GET | Health check |

### Request Body (POST)
```json
{
  "message": "ايه المنتجات المتاحة؟",
  "userName": "Ahmed",
  "customerContext": "VIP Customer"
}
```

### Response
```json
{
  "reply": "أهلاً! عندنا المنتجات دي...",
  "docs": [...],
  "mode": "rag",
  "conversationId": "uuid"
}
```

---

## WhatsApp Setup Requirements

1. **Meta Business Account** with WhatsApp Business API access
2. **Environment Variables** in n8n:
   - `WHATSAPP_PHONE_NUMBER_ID`: Your WhatsApp phone number ID
   - `WHATSAPP_ACCESS_TOKEN`: Your permanent access token

3. **Webhook URL** to configure in Meta:
   ```
   https://your-n8n-instance.com/webhook/whatsapp-webhook
   ```

---

## Testing the API

### Using curl (Linux/Mac)
```bash
curl -X POST https://sphinx-bot.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "ايه المنتجات؟"}'
```

### Using PowerShell (Windows)
```powershell
Invoke-RestMethod -Uri "https://sphinx-bot.vercel.app/api/chat" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"message": "hello"}'
```

### Using n8n HTTP Request Node
Just import the workflow and test!

---

## Troubleshooting

### Cold Start Delays
Vercel free tier has cold starts. First request may take 10-15 seconds.
The health check workflow helps keep the function warm.

### CORS Issues
The API is configured for server-to-server calls. 
If calling from browser, you may need to add CORS headers.

### Missing Environment Variables
Check Vercel dashboard → Settings → Environment Variables:
- `CHAT_ANYWHERE_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `API_KEY`
