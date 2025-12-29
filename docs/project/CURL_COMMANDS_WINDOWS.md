# 🧪 Service Integration Framework - Windows CMD Curl Commands

## Prerequisites

Make sure your API server is running:
```cmd
cd packages\api
npm run dev
```

Server should be running on: http://localhost:3000

---

## 1️⃣ SERVICE REGISTRY TESTS

### List All Services
```cmd
curl -X GET http://localhost:3000/api/v1/services
```

### Get Service Statistics
```cmd
curl -X GET http://localhost:3000/api/v1/services/stats
```

### Get Supabase Details
```cmd
curl -X GET http://localhost:3000/api/v1/services/supabase
```

### Search for Database Services
```cmd
curl -X GET "http://localhost:3000/api/v1/services/search?q=database"
```

### Get All Database Category Services
```cmd
curl -X GET http://localhost:3000/api/v1/services/category/database
```

### Get All Categories
```cmd
curl -X GET http://localhost:3000/api/v1/services/categories
```

### Get Supabase Code Templates
```cmd
curl -X GET http://localhost:3000/api/v1/services/supabase/templates
```

---

## 2️⃣ INTERACTIVE SERVICE SELECTION (No Services)

### Test 1: Request Code Generation (User has NO services)
```cmd
curl -X POST http://localhost:3000/api/v1/orchestrator/generate-interactive ^
-H "Content-Type: application/json" ^
-d "{\"prompt\":\"Build a task management API with authentication\",\"userId\":\"test-user-no-services\"}"
```

**Expected:** Returns questions asking which services to use

### Test 2: Submit Answers with AI Recommendations
```cmd
curl -X POST http://localhost:3000/api/v1/orchestrator/generate-interactive/submit ^
-H "Content-Type: application/json" ^
-d "{\"prompt\":\"Build a task management API\",\"userId\":\"test-user-no-services\",\"answers\":{\"database\":\"recommend\",\"monitoring\":\"recommend\"}}"
```

**Expected:** AI selects Supabase + Sentry, generates code + setup guide

### Test 3: Submit Answers with User Selection
```cmd
curl -X POST http://localhost:3000/api/v1/orchestrator/generate-interactive/submit ^
-H "Content-Type: application/json" ^
-d "{\"prompt\":\"Build a blog API\",\"userId\":\"test-user-no-services-2\",\"answers\":{\"database\":\"supabase\",\"monitoring\":\"none\"}}"
```

**Expected:** Uses Supabase (user specified), skips monitoring

---

## 3️⃣ QUICK MODE (No Service Integration - Existing Endpoint)

### Generate Code Without Service Setup
```cmd
curl -X POST http://localhost:3000/api/v1/orchestrator/execute ^
-H "Content-Type: application/json" ^
-d "{\"prompt\":\"Build a simple REST API for todos\"}"
```

**Expected:** Code generated immediately with generic templates (no questions)

---

## 4️⃣ CONNECTION MANAGEMENT (Requires Auth)

**Note:** Replace `YOUR_AUTH_TOKEN` with your actual token

### Create a Supabase Connection
```cmd
curl -X POST http://localhost:3000/api/v1/connections ^
-H "Content-Type: application/json" ^
-H "Authorization: Bearer YOUR_AUTH_TOKEN" ^
-d "{\"serviceId\":\"supabase\",\"connectionName\":\"My Supabase Project\",\"credentials\":{\"url\":\"https://test-project.supabase.co\",\"anonKey\":\"test-anon-key-1234567890\"}}"
```

**Expected:** Returns connection ID (save this for next commands)

### List User Connections
```cmd
curl -X GET http://localhost:3000/api/v1/connections ^
-H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Get Specific Connection (Replace CONNECTION_ID)
```cmd
curl -X GET http://localhost:3000/api/v1/connections/CONNECTION_ID ^
-H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Test Connection (Replace CONNECTION_ID)
```cmd
curl -X POST http://localhost:3000/api/v1/connections/CONNECTION_ID/test ^
-H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Update Connection (Replace CONNECTION_ID)
```cmd
curl -X PATCH http://localhost:3000/api/v1/connections/CONNECTION_ID ^
-H "Content-Type: application/json" ^
-H "Authorization: Bearer YOUR_AUTH_TOKEN" ^
-d "{\"connectionName\":\"Updated Connection Name\"}"
```

### Log Service Usage (Replace CONNECTION_ID)
```cmd
curl -X POST http://localhost:3000/api/v1/connections/CONNECTION_ID/log-usage ^
-H "Content-Type: application/json" ^
-H "Authorization: Bearer YOUR_AUTH_TOKEN" ^
-d "{\"operation\":\"select\",\"success\":true,\"durationMs\":150}"
```

### Get Usage Statistics
```cmd
curl -X GET http://localhost:3000/api/v1/connections/stats ^
-H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Delete Connection (Replace CONNECTION_ID)
```cmd
curl -X DELETE http://localhost:3000/api/v1/connections/CONNECTION_ID ^
-H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## 5️⃣ INTERACTIVE MODE (User WITH Services)

### Generate Code (User has services configured)
```cmd
curl -X POST http://localhost:3000/api/v1/orchestrator/generate-interactive ^
-H "Content-Type: application/json" ^
-d "{\"prompt\":\"Build E-commerce API\",\"userId\":\"user-with-services\"}"
```

**Expected:** If user has services configured, generates code immediately (no questions)

---

## 6️⃣ COMPREHENSIVE TEST FLOW

### Step 1: Check Available Services
```cmd
curl -X GET http://localhost:3000/api/v1/services
```

### Step 2: Search for Monitoring Services
```cmd
curl -X GET "http://localhost:3000/api/v1/services/search?q=monitoring"
```

### Step 3: Get Sentry Details
```cmd
curl -X GET http://localhost:3000/api/v1/services/sentry
```

### Step 4: Try Quick Mode First
```cmd
curl -X POST http://localhost:3000/api/v1/orchestrator/execute ^
-H "Content-Type: application/json" ^
-d "{\"prompt\":\"Create user authentication API\"}"
```

### Step 5: Try Interactive Mode (Get Questions)
```cmd
curl -X POST http://localhost:3000/api/v1/orchestrator/generate-interactive ^
-H "Content-Type: application/json" ^
-d "{\"prompt\":\"Create user authentication API with database\",\"userId\":\"demo-user-123\"}"
```

### Step 6: Submit with Recommendations
```cmd
curl -X POST http://localhost:3000/api/v1/orchestrator/generate-interactive/submit ^
-H "Content-Type: application/json" ^
-d "{\"prompt\":\"Create user authentication API\",\"userId\":\"demo-user-123\",\"answers\":{\"database\":\"recommend\",\"auth\":\"recommend\",\"monitoring\":\"recommend\"}}"
```

---

## 7️⃣ REAL-WORLD EXAMPLES

### Example 1: E-commerce Backend
```cmd
curl -X POST http://localhost:3000/api/v1/orchestrator/generate-interactive/submit ^
-H "Content-Type: application/json" ^
-d "{\"prompt\":\"Build e-commerce backend with products, cart, and checkout\",\"userId\":\"ecommerce-user\",\"answers\":{\"database\":\"recommend\",\"payment\":\"recommend\",\"email\":\"recommend\"}}"
```

### Example 2: SaaS Application
```cmd
curl -X POST http://localhost:3000/api/v1/orchestrator/generate-interactive/submit ^
-H "Content-Type: application/json" ^
-d "{\"prompt\":\"Build SaaS platform with subscriptions\",\"userId\":\"saas-user\",\"answers\":{\"database\":\"supabase\",\"auth\":\"recommend\",\"payment\":\"stripe\",\"monitoring\":\"sentry\"}}"
```

### Example 3: Blog Platform
```cmd
curl -X POST http://localhost:3000/api/v1/orchestrator/generate-interactive ^
-H "Content-Type: application/json" ^
-d "{\"prompt\":\"Create blog API with posts, comments, and users\",\"userId\":\"blog-user\"}"
```

---

## 8️⃣ PERFORMANCE & SECURITY TESTS

### Test Response Time
```cmd
curl -w "Time: %%{time_total}s\n" -X GET http://localhost:3000/api/v1/services
```

### Test Authentication Protection (Should return 401)
```cmd
curl -X GET http://localhost:3000/api/v1/connections
```

### Test Invalid Credentials (Should return 400)
```cmd
curl -X POST http://localhost:3000/api/v1/connections ^
-H "Content-Type: application/json" ^
-H "Authorization: Bearer YOUR_AUTH_TOKEN" ^
-d "{\"serviceId\":\"supabase\",\"connectionName\":\"Invalid\",\"credentials\":{\"anonKey\":\"missing-url-field\"}}"
```

---

## 📝 TIPS FOR WINDOWS CMD

### Save Response to File
```cmd
curl -X GET http://localhost:3000/api/v1/services > services.json
```

### Pretty Print JSON (Requires jq)
```cmd
curl -X GET http://localhost:3000/api/v1/services | jq .
```

### View Headers
```cmd
curl -i -X GET http://localhost:3000/api/v1/services
```

### Follow Redirects
```cmd
curl -L -X GET http://localhost:3000/api/v1/services
```

### Verbose Output (Debug)
```cmd
curl -v -X GET http://localhost:3000/api/v1/services
```

---

## 🎯 RECOMMENDED TEST SEQUENCE

### Quick 5-Minute Test:
```cmd
REM 1. List services
curl -X GET http://localhost:3000/api/v1/services

REM 2. Get Supabase details
curl -X GET http://localhost:3000/api/v1/services/supabase

REM 3. Try Quick Mode
curl -X POST http://localhost:3000/api/v1/orchestrator/execute -H "Content-Type: application/json" -d "{\"prompt\":\"Build REST API\"}"

REM 4. Try Interactive Mode
curl -X POST http://localhost:3000/api/v1/orchestrator/generate-interactive -H "Content-Type: application/json" -d "{\"prompt\":\"Build task API\",\"userId\":\"test-123\"}"

REM 5. Submit with recommendations
curl -X POST http://localhost:3000/api/v1/orchestrator/generate-interactive/submit -H "Content-Type: application/json" -d "{\"prompt\":\"Build task API\",\"userId\":\"test-123\",\"answers\":{\"database\":\"recommend\"}}"
```

---

## ✅ EXPECTED RESULTS

### Service Registry Endpoints:
- **200 OK** with JSON containing services/stats
- Should see Supabase, Sentry, GitHub Actions, Resend, Stripe

### Interactive Endpoints (No Services):
- **First call:** Returns `mode: "interactive"` with questions
- **Second call:** Returns selected services + setup guide + generated code

### Quick Mode:
- **200 OK** with `success: true` and generated code
- No service questions asked

### Connection Endpoints:
- **Without auth:** 401 Unauthorized
- **With auth:** 200 OK (create/list/update/delete work)

---

## 🐛 Troubleshooting

### "Connection refused"
**Solution:** Make sure API server is running (`npm run dev`)

### "401 Unauthorized" on connections
**Solution:** Add `-H "Authorization: Bearer YOUR_TOKEN"`

### JSON parse error
**Solution:** Check quotes are escaped properly with `\"`

### Multi-line not working
**Solution:** Use `^` at line end for CMD continuation

---

## 📚 More Information

- **User Guide:** `docs\USER_GUIDE_SERVICE_INTEGRATION.md`
- **Testing Guide:** `docs\TESTING_GUIDE_SERVICE_INTEGRATION.md`
- **API Docs:** Visit http://localhost:3000/docs (when server running)

---

**Happy Testing! 🚀**
