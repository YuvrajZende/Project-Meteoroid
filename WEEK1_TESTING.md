# Week 1 API Testing Guide

## 🚀 Testing Instructions

### 1. Start the Application

```bash
npm run start:dev
```

The application will start on `http://localhost:3000`

### 2. Access Health Check Endpoint

**Request:**
```bash
curl http://localhost:3000/api/v1/health
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 123.456
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/health",
  "processingTimeMs": 2
}
```

### 3. Access Swagger Documentation

Open your browser and navigate to:
```
http://localhost:3000/api/docs
```

You should see:
- 📚 Interactive API documentation
- 🧪 Ability to test endpoints directly
- 📝 Request/response schemas
- 🔒 Authentication documentation

### 4. Test Generate API Endpoint

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "User Management API",
    "type": "rest",
    "entities": ["User", "Post", "Comment"],
    "features": ["validation", "pagination"],
    "database": "postgresql",
    "authentication": ["jwt"]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "API generation initiated successfully",
    "jobId": "job_1704067200000",
    "estimatedTime": "35 seconds"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/generate",
  "processingTimeMs": 15
}
```

### 5. Test Validation Error

**Request (Invalid):**
```bash
curl -X POST http://localhost:3000/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "type": "invalid",
    "entities": []
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/generate",
  "method": "POST",
  "message": "Validation failed",
  "details": {
    "name": ["name should not be empty"],
    "type": ["type must be one of the following values: rest, graphql, trpc"],
    "entities": ["entities must be an array"]
  }
}
```

### 6. Test Templates Endpoint

**Request:**
```bash
curl http://localhost:3000/api/v1/templates
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      "rest-crud",
      "graphql-api",
      "trpc-endpoints",
      "microservice",
      "serverless",
      "auth-module",
      "database-module"
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/templates",
  "processingTimeMs": 1
}
```

## ✅ Verification Checklist

### Development Environment
- [x] Node.js v20+ installed ✓
- [x] NestJS CLI installed globally ✓
- [x] Project created successfully ✓
- [x] Dependencies installed without errors ✓
- [x] TypeScript compilation working ✓

### API Functionality
- [x] Health endpoint responding correctly ✓
- [x] Generate endpoint accepting requests ✓
- [x] Templates endpoint returning data ✓
- [x] Error responses properly formatted ✓
- [x] Validation working for DTOs ✓

### Documentation
- [x] Swagger UI accessible at `/api/docs` ✓
- [x] All endpoints documented ✓
- [x] Request/response schemas defined ✓
- [x] Authentication methods documented ✓
- [x] Example requests working ✓

### Error Handling
- [x] Validation errors caught and formatted ✓
- [x] 404 errors handled gracefully ✓
- [x] 500 errors logged properly ✓
- [x] Response format consistent ✓
- [x] Development stack traces available ✓

## 🎯 Next Steps (Week 2)

1. Implement WebSocket for real-time updates
2. Add comprehensive API documentation system
3. Setup rate limiting
4. Implement request/response logging improvements
5. Add performance monitoring foundation

## 📝 Notes

- Application runs in development mode with hot-reload
- Swagger UI provides interactive testing interface
- All responses wrapped in consistent format with metadata
- Global validation pipe ensures input data integrity
- Error handling provides detailed information in development
- CORS enabled for frontend integration
