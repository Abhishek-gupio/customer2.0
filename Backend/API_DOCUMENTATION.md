# Gupio Backend API Documentation (Version 2.0)

This document provides a comprehensive overview of the Gupio Backend APIs, including their purpose, endpoints, request payloads, and response structures.

---

## 🏗️ 1. Core AI Agent (Chat)
The AI Agent is the "Brain" of Gupio, capable of reasoning, calling tools, and remembering past interactions.

### **Start/Continue Chat**
*   **Endpoint**: `POST /api/v1/chat`
*   **Auth**: Required (Bearer Token)
*   **Payload**:
    ```json
    {
      "message": "I spent 500 on fuel yesterday at Shell",
      "sessionId": "optional-uuid-to-continue-conversation"
    }
    ```
*   **Response Response**:
    ```json
    {
      "success": true,
      "data": {
        "message": "I've logged your fuel expense...",
        "voiceUrl": "https://translate.google.com/...",
        "sessionId": "uuid"
      }
    }
    ```
*   **Capabilities**:
    *   **Tool Calling**: Automatically calls `add_expense`, `get_vehicle_status`, etc.
    *   **Memory**: Remembers last 10 messages of the session.
    *   **RAG**: Searches your entire vehicle history for context.

### **List Chat Sessions**
*   **Endpoint**: `GET /api/v1/chat/sessions`
*   **Response**: Returns titles and IDs of recent conversations.

---

## 💸 2. Expense Management
Gupio provides 4 distinct ways to log expenses safely.

### **Manual / Receipt Capture**
*   **Endpoint**: `POST /api/v1/expenses`
*   **Format**: `multipart/form-data`
*   **Fields**: `amount`, `category`, `vehicleId`, `merchantName`, `receipt (file)`.

### **AI Voice Command**
*   **Endpoint**: `POST /api/v1/expenses/parse/voice`
*   **Format**: `multipart/form-data` (Audio file)
*   **Behavior**: Gemini 2.0 listens to the audio, extracts amount/category, and creates the record. It also handles Hinglish.

### **SMS / Notification Parsing**
*   **Endpoint**: `POST /api/v1/expenses/parse/text`
*   **Payload**: `{ "text": "SMS from Bank..." }`
*   **Behavior**: High-precision parsing of bank/UPI messages into structured expenses.

---

## ⛽ 3. Fuel Price Intelligence
Real-time pricing data and savings advice across 35+ Indian cities.

### **Get Current Prices**
*   **Endpoint**: `GET /api/v1/expenses/fuel-prices?city=Delhi`

### **Nearby Price Comparison**
*   **Endpoint**: `GET /api/v1/expenses/fuel-prices/compare`
*   **Output**: Compares your city with nearby hubs (e.g. Noida vs Delhi) to find savings.

---

## 🛡️ 4. Warranty & Service Tracking
Automatically tracks every part in your car from the moment you log an expense.

### **Log Service Record**
*   **Endpoint**: `POST /api/v1/expenses/warranty/service-records`
*   **Payload**:
    ```json
    {
      "vehicleId": "uuid",
      "serviceType": "REGULAR_SERVICE",
      "parts": [
        { "partType": "ENGINE_OIL", "cost": 1200, "warrantyMonths": 6 }
      ]
    }
    ```

### **Warranty Checklist**
*   **Endpoint**: `GET /api/v1/expenses/warranty/vehicles/{id}/status`
*   **Output**: Lists all parts currently under warranty, expiring soon, or overdue for replacement.

---

## 🧠 5. Driver Insights & Efficiency
Smart analytics that help you lower your car's total cost of ownership.

### **TCO Analysis (Cost per KM)**
*   **Endpoint**: `GET /api/v1/expenses/vehicles/{id}/cost-per-km`
*   **Logic**: Uses Odometer readings and total spending to calculate exactly how much your car costs you per kilometer.

### **Weekly Intelligence Digest**
*   **Endpoint**: `GET /api/v1/expenses/insights`
*   **Output**: Personalized tips, recurring expense detection, and spending trends.

---

## 🚦 6. Vehicle Compliance & Legal
Checking the legal health of your car in real-time.

### **Document Status**
*   **Endpoint**: `GET /api/v1/expenses/document-status` (via AI Agent)
*   **Behavior**: Checks RC, Insurance, and PUC expiry dates and flags compliance issues.

---

### **Integration Notes**
- **Base URL**: `http://localhost:5000/api/v1`
- **Swagger Documentation**: Accessible at `/api-docs` when the server is running.
- **Error Handling**: Standard JSON errors with `400`, `401`, `404`, and `500` status codes.
