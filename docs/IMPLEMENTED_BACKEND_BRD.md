# Business Requirements Document (BRD) - Gupio Customer App (Implemented Backend)

## 1. Introduction
This Business Requirements Document (BRD) outlines the features and functionalities currently implemented in the Gupio Customer App backend. This document serves as the source of truth for the active backend architecture, built focusing exclusively on the documented database schema and API routes.

## 2. Core Implemented Modules

### 2.1 Customer & Authentication Module
* **Customer Profile:** Account creation and profile management capturing phone number, email, full name, and profile picture.
* **Device Management:** Tracking and management of customer devices (iOS/Android) including device tokens for push notifications and tracking the last active timestamp.
* **Authentication Flow:** API structure supports OTP-based signup/login, token refresh, and profile management.

### 2.2 Vehicle Management Module
* **Vehicle Digital Garage:** CRUD operations for vehicles, capturing registration number, make, model, variant, year, fuel type, engine, and chassis numbers. Supports primary vehicle tagging and RC verification status.
* **Vehicle Health:** Automated health scoring (Overall, Age, Mileage, Maintenance, Driving) with system-generated recommendations and explanations.
* **Odometer Tracking:** Independent odometer logging and historical tracking over time.
* **Challan Management:** Tracking vehicle challans, violation types, amounts, issuing locations, and payment statuses.
* **Service & Maintenance:** Detailed service records including garage name, service dates, and next service predictions based on date or kilometers.
* **Parts Tracking:** Tracking individual replaced parts (e.g., Engine Oil, Brake Pads, Battery) with associated costs, brand, and warranty tracking (months/km or expiry date).

### 2.3 Document & Wallet Module
* **Digital Document Storage:** Support for RC, Insurance, PUC, FASTag, Driving License, and other documents.
* **Document Attributes:** Captures issue dates, expiry dates, issuer name, and verification status (Pending, Verified, Rejected).
* **OCR Integration:** Capability to store OCR-parsed data and structured extracted fields from uploaded files.
* **DigiLocker Integration:** OAuth-based connection to DigiLocker, storing access/refresh tokens, consent status, and data sync timestamps.

### 2.4 Expense & Budget Module
* **Expense Tracking:** Logging of vehicle expenses across distinct categories (Fuel, Toll, Parking, Service, Insurance, Challan, EMI, etc.).
* **Multi-Source Ingestion:** Expenses can be marked via specific sources: Manual, SMS, Push Notification, Voice, or Parsed from Receipts.
* **Budgets:** Category-wise customizable budgets (e.g., monthly) with active threshold limits (e.g., alert at 80% consumption).
* **Fuel Price Tracking:** Centralized caching of city/state fuel prices fetched from external APIs (e.g., IOCL) with historical tracking.

### 2.5 Driving & Telematics Module
* **Device Association:** Support for Damoov/telematics instances tied to specific vehicles.
* **Trip Logging:** Rich tracking of driving trips including start/end times, distance, duration, speed (max/avg), fuel consumed, and an aggregated safety score (0-100). Captures start and end location geometries.
* **Driving Events:** Detailed telemetry events during trips such as Harsh Braking, Harsh Acceleration, Phone Usage, and Speeding, along with timestamps, GPS coordinates, and severity metrics.

### 2.6 AI Assistant & Chat Module
* **Conversational AI:** Persistent AI chat sessions with message history context, tracking user, system, and assistant roles.
* **Embeddings & Context Engine:** Document Embedding models designed to vectorize user records (Expenses, Documents, Vehicles) to provide RAG (Retrieval-Augmented Generation) capabilities to the AI assistant.

### 2.7 Emergency & SOS Module
* **SOS Triggers:** Active SOS requests capturing real-time GPS coordinates and explicit emergency types (Medical, Police, Mechanical, Accident).
* **Emergency Contacts:** Priority-based emergency contacts list per customer (name, phone, relationship).
* **Resolution Workflow:** Tracking the operational status of SOS requests (Active, Resolved, Cancelled).

### 2.8 Collaboration & Sharing Module
* **Vehicle Access Sharing:** Granular role-based access control (Owner, Editor, Viewer) to share specific vehicles and their data across multiple customer accounts securely.

### 2.9 Communication & Notifications Module
* **In-App Notifications:** System-generated alerts (e.g., Document Expiry, System Alerts) with link metadata and read-receipt tracking.

## 3. Technical Foundation Notes
* **Database Base:** PostgreSQL via Prisma ORM (`customer` schema).
* **API Structure:** RESTful JSON APIs organized by domains (e.g., `/v1/vehicles`, `/v1/expenses`, `/v1/telematics`).
* **Vector Readiness:** The schema architecture includes preparation for vector embeddings (e.g., `pgvector`) to support advanced semantic search and AI capabilities in the future.
