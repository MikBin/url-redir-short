# Functional Requirements: Universal Redirector System

## 1. Introduction
This document outlines the functional requirements for the Universal Redirector System, a high-performance, distributed URL redirection platform. It integrates a central Admin Service for management and distributed Edge Redirector Engines for low-latency traffic handling.

## 2. Core System Architecture Requirements

### 2.1. Distributed Architecture
*   **FR-01:** The system MUST consist of a centralized **Admin Service** (Source of Truth) and multiple distributed **Redirector Engines** (Edge Nodes).
*   **FR-02:** The Admin Service MUST be database-agnostic, supporting adapters for PostgreSQL and PocketBase.
*   **FR-03:** The Redirector Engines MUST maintain a local, in-memory state of active rules to minimize latency.
*   **FR-04:** State changes (Create, Update, Delete) MUST be broadcast from the Admin Service to Redirector Engines via **Server-Sent Events (SSE)**.
*   **FR-05:** Redirector Engines MUST prioritize low latency and high throughput.

### 2.2. Edge Routing & Caching
*   **FR-06:** Redirector Engines MUST use a **Cuckoo Filter** as a mutable "Allow List" to instantly reject 404 traffic without database or router lookups.
*   **FR-07:** Redirector Engines MUST use a **Radix Tree** for efficient route lookup.
*   **FR-08:** The Cuckoo Filter MUST support dynamic insertions and deletions to reflect state changes without requiring a full reload.

### 2.3. Analytics & Referrer Tracking
*   **FR-09:** The system MUST implement a **Hybrid Priority Strategy** for identifying traffic sources.
*   **FR-10:** **Priority 1 (Explicit):** The system MUST check for specific query parameters (e.g., `utm_source`, `ref`, `source`) and use their value as the referrer if present.
*   **FR-11:** **Priority 2 (Implicit):** If no explicit tags are found, the system MUST fallback to the HTTP `Referer` header.
*   **FR-12:** Analytics data (Source, User-Agent, Path, Timestamp) MUST be logged asynchronously to prevent blocking the redirect response.

---

## 3. Advanced Traffic Routing Requirements

### 3.1. A/B Testing (Split Testing)
*   **FR-13:** The system MUST support mapping a single short URL path to multiple destination URLs.
*   **FR-14:** Traffic distribution MUST be **probabilistic/random** to ensure statistical equality over large sample sizes while maintaining high edge performance.
*   **FR-15:** The system SHOULD track which variant (destination) a user was redirected to for analytics purposes.

### 3.2. Language Targeting
*   **FR-16:** The system MUST allow defining different destination URLs based on the user's browser language (parsed from the `Accept-Language` header).
*   **FR-17:** The system MUST support a **Fallback URL** that is used if the user's language does not match any specific rules or is undetectable.

### 3.3. Geo Targeting
*   **FR-18:** The system MUST support routing based on the user's geographic location.
*   **FR-19:** Location detection MUST rely on **Edge Platform Headers** (e.g., `cf-ipcountry`) to avoid the latency overhead of external IP-to-Geo lookup services.
*   **FR-20:** Supported granularity SHOULD include Country, with optional support for Region/City if provided by the edge platform.

### 3.4. Device-Based Targeting
*   **FR-21:** The system MUST support routing based on the user's device type.
*   **FR-22:** Required device categories are **iOS**, **Android**, and **Desktop**.
*   **FR-23:** Device detection MUST be performed by analyzing the `User-Agent` header.

### 3.5. Deep Linking
*   **FR-24:** The system MUST support **Mobile App Custom Schemes** (e.g., `myapp://product/123`) as valid destination URLs.
*   **FR-25:** The system SHOULD allow configuring fallback web URLs if the app scheme fails (note: this often requires an intermediate HTML page, but basic 301 to scheme is the primary requirement).

---

## 4. Link Management & Features

### 4.1. URL Generation & Management
*   **FR-26:** Users MUST be able to define custom aliases (paths) for their links (Manual Entry).
*   **FR-27:** The system MUST provide an **Autogeneration** feature to create short, random, collision-resistant aliases.

### 4.2. Bulk Operations
*   **FR-28:** The system MUST support **Bulk Insert/Update** of URL rules.
*   **FR-29:** Supported formats for bulk import MUST include **JSON** and **CSV**.
*   **FR-30:** Bulk operations MUST be accessible via the **Admin API** and the **User Interface**.

### 4.3. QR Code Generation
*   **FR-31:** The system MUST generate QR codes for any managed link.
*   **FR-32:** QR Code generation MUST support **Advanced Customization** (e.g., custom colors, embedded logos, error correction levels).
*   **FR-33:** QR Codes SHOULD be available via an on-demand generation API.
*   **FR-34:** The system MAY support storing generated QR code images for caching purposes.

### 4.4. Link Expiration
*   **FR-35:** The system MUST support link expiration based on **Time-To-Live (TTL)** (specific date/time or duration).
*   **FR-36:** The system MUST support link expiration based on a **Maximum Click/Redirect Count**.
*   **FR-37:** For click-based expiration, **Eventual Consistency** is acceptable. The system does not require a globally locked counter; a slight margin of error (overshoot) is permitted to maintain edge performance.
*   **FR-38:** Expired links MUST return a 404 Not Found or redirect to a designated "Expired" page.

### 4.5. Password Protection
*   **FR-39:** The system MUST support password-protecting specific links.
*   **FR-40:** When a user accesses a password-protected link, the Redirector Engine MUST serve an **intermediate HTML page** containing a password input form.
*   **FR-41:** The actual redirection to the destination MUST only occur after successful validation of the entered password.

---

## 5. Analytics & Reporting Requirements

### 5.1. Real-Time Engagement
*   **FR-42:** The system MUST support **Click-Through Rate (CTR)** tracking for all links in real-time.
*   **FR-43:** Engagement metrics MUST include unique visitor counts and total clicks.

### 5.2. Geographic & Demographics
*   **FR-44:** The system MUST track **Geographic Data** at the Country and City level (where available from edge headers).
*   **FR-45:** The system MUST track **Device and Browser** profiles by parsing the User-Agent string.

### 5.3. Source Tracking
*   **FR-46:** The system MUST provide detailed **Referral Source** tracking, distinguishing between direct traffic, search engines, and social media based on the Referrer header and query parameters.
*   **FR-47:** The Admin Service MUST support **UTM Parameter Management**, allowing users to easily append and manage UTM tags (Source, Medium, Campaign) during link creation.

### 5.4. Reporting
*   **FR-48:** The Analytics Service MUST provide **Custom Dashboards** with configurable reporting interfaces.
*   **FR-49:** The Redirector Engine MUST decouple analytics processing by pushing data to the Analytics Service via a defined interface, ensuring edge performance is not compromised.

---

## 6. Non-Functional Requirements (Constraints)
*   **NFR-01:** **Latency:** The redirection overhead at the edge should be minimal (<50ms processing time excluding network).
*   **NFR-02:** **Scalability:** The architecture must support horizontal scaling of Edge Nodes without reconfiguration of the Admin Service.
*   **NFR-03:** **Memory Efficiency:** Edge Nodes must optimize memory usage (e.g., via Cuckoo Filters and Language Slicing) to run within constrained environments (e.g., Cloudflare Workers 128MB limit).

---

## 7. Security & Compliance

### 7.1. Redirection Types
*   **FR-50:** The system MUST allow configuring the HTTP redirection status code per link.
*   **FR-51:** Supported status codes MUST include **301 Moved Permanently** and **302 Found (Temporary)**.
*   **FR-52:** The default status code for new links MUST be **301 Moved Permanently**.

### 7.2. HSTS Compliance
*   **FR-53:** The system MUST enforce **HTTP Strict Transport Security (HSTS)** on all responses to ensure secure connections.
*   **FR-54:** The `Strict-Transport-Security` header MUST be set with `max-age=31536000` (1 year), `includeSubDomains`, and `preload`.

### 7.3. Data Privacy (GDPR / CCPA)
*   **FR-55:** The system MUST support **IP Address Anonymization** in analytics logs to comply with GDPR/CCPA.
*   **FR-56:** The anonymization strategy MUST be configurable, with **Hashing** as the default method.
