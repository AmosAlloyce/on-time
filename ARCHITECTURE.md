# On-Time Architecture & System Design

**On-Time** ("On Time all the time") is an autonomous, self-hostable appointment scheduling platform engineered for strict tenant isolation, zero-trust data segregation, verifiable TLS everywhere, and audited asynchronous job dispatch.

---

## 1. System Ingress & Network Topology

All public traffic terminates at Caddy, which manages automated Let's Encrypt TLS certificates, enforces HTTP/2 and modern cipher suites, and verifies reverse-proxy provenance via an authenticated shared secret header before requests ever touch application workers.

```mermaid
flowchart TD
    Client["Client Browser / Invitee / Organizer"] -->|"HTTPS :443 (TLS 1.3 / HTTP/2)"| DNS["DuckDNS Wildcard Resolution (*.alloyce.duckdns.org)"]
    DNS --> Caddy["Caddy Reverse Proxy (three-dollar-motel-caddy-1)"]
    
    subgraph Host_DMZ ["Oracle Cloud ARM64 Host Ingress"]
        Caddy -->|"Header: x-tempocove-proxy-secret"| ProxyCheck{"Proxy Secret Verified?"}
        ProxyCheck -->|Yes| NetBridge["Docker Network: three-dollar-motel_default"]
        ProxyCheck -->|No / Direct Ingress| Drop["403 Forbidden / Drop Request"]
    end

    subgraph Internal_Mesh ["Isolated Bridge Network (ontime-production_default)"]
        NetBridge --> WebApp["Next.js Standalone Container (ontime-web:3000)"]
        Worker["Dedicated Background Worker (ontime-worker)"]
        DB[("PostgreSQL 18.6 with mTLS (ontime-postgres-1)")]
        
        WebApp -->|"mTLS (tempocove_app role)"| DB
        Worker -->|"mTLS (tempocove_worker role)"| DB
    end

    subgraph External_Services ["External Service Integrations"]
        Worker -->|"OAuth2 REST API"| GoogleCal["Google Calendar API"]
        Worker -->|"TLS :587 STARTTLS"| SMTPRelay["Gmail SMTP Server"]
        WebApp -->|"Webhook Verification"| StripeAPI["Stripe Payments (Test Mode)"]
    end
```

---

## 2. Container Topology & Resource Boundary

Each component runs within a strictly constrained container boundary:
- **`ontime-web`**: Read-only root filesystem with an ephemeral 64MB `tmpfs` at `/tmp`. Non-root UID/GID 1000:1000 (`node:node`), all Linux capabilities dropped (`cap_drop: [ALL]`), `no-new-privileges: true`.
- **`worker`**: Dedicated background outbox processor (`worker.mjs`), non-root, read-only rootfs, isolated from public ingress.
- **`postgres`**: PostgreSQL 18.6 hardened container with certificate authority (CA), server certificate SAN enforcement (`DNS:postgres,DNS:localhost`), and 5 segregated SQL database roles.

```mermaid
flowchart LR
    subgraph Ingress ["Public Ingress"]
        CaddyProxy["Caddy :443"]
    end

    subgraph Application_Tier ["Application Tier (UID 1000)"]
        WebTier["ontime-web\n• Next.js 16 Standalone\n• Read-only rootfs\n• CPU Limit: 1 Core\n• RAM Limit: 768MB"]
        WorkerTier["ontime-worker\n• dist/worker.mjs\n• Dedicated Outbox Poller\n• Heartbeat Tick (5s)\n• RAM Limit: 768MB"]
    end

    subgraph Database_Tier ["Database Tier (PostgreSQL 18)"]
        PostgresDB[("PostgreSQL 18.6\n• mTLS Enforced\n• Forced Row-Level Security\n• AES-256 Keyring Secrets")]
    end

    CaddyProxy -->|"HTTP (Proxy Authenticated)"| WebTier
    WebTier -->|"mTLS Socket\nRole: tempocove_app"| PostgresDB
    WorkerTier -->|"mTLS Socket\nRole: tempocove_worker"| PostgresDB
```

---

## 3. Row-Level Security (RLS) & Signed Context Authority

Tenant segregation is enforced at the database kernel level using PostgreSQL Row-Level Security. Application queries cannot query across workspace boundaries even in the event of an application logic vulnerability.

```mermaid
flowchart TD
    subgraph Web_Request_Context ["Web Request Lifecycle"]
        HTTPReq["Incoming Authenticated Request"] --> CookieParse["Extract Session Cookie Token"]
        CookieParse --> ComputeHash["Compute SHA-256 Token Hash"]
        ComputeHash --> SignContext["HMAC-SHA256 Signature Generation\n(Key: TENANT_CONTEXT_SECRET)"]
    end

    subgraph SQL_Transaction ["Atomic PostgreSQL Transaction"]
        SignContext --> SetConfigs["SELECT set_config('tempocove.mode', ...)\nSELECT set_config('tempocove.workspace_id', ...)\nSELECT set_config('tempocove.user_id', ...)\nSELECT set_config('tempocove.action', ...)\nSELECT set_config('tempocove.signature', ...)"]
        SetConfigs --> RLSVerifier{"tempocove_context_valid()"}
        
        RLSVerifier -->|"Valid HMAC Signature &\nActive Membership"| Permit["Execute Query / Mutation"]
        RLSVerifier -->|"Invalid Signature /\nCross-Tenant Breach"| Deny["PostgreSQL RLS Denial (0 rows / empty set)"]
    end
```

### PostgreSQL Database Roles

| Role Name | Access Type | Responsibilities |
| :--- | :--- | :--- |
| `tempocove_owner` | Schema Owner | Baseline DDL migrations, trigger creation, extension management. Non-login in production app flow. |
| `tempocove_app` | Web Application | DML queries with signed tenant context (`tempocove_workspace_actor`, `tempocove_workspace_admin`). |
| `tempocove_worker` | Background Worker | Reads pending outbox jobs (`IntegrationOutbox`, `EmailOutbox`) and updates task status/leases. |
| `tempocove_migration`| Migrations | Applied schema upgrades with restricted table alters. |
| `tempocove_monitor` | Healthcheck / Probe | Read-only inspection of `WorkerHeartbeat` and database readiness function. |

---

## 4. Booking Lifecycle & Outbox State Machine

Bookings follow a strict transactional state machine. Outbox events are guaranteed to be delivered at least once with exponential backoff and lease timeouts.

```mermaid
stateDiagram-v2
    [*] --> SlotSelection: Invitee opens /book/:slug
    SlotSelection --> SlotReserved: Invitee picks available slot
    
    state SlotReserved {
        [*] --> FreeBooking: Price = $0
        [*] --> PaidBooking: Price > $0 (Stripe)
    }

    FreeBooking --> BookingConfirmed: Immediate confirmation
    PaidBooking --> AwaitingPayment: Stripe Checkout Session created
    AwaitingPayment --> BookingConfirmed: Stripe checkout.session.completed webhook
    AwaitingPayment --> PaymentFailed: Expired / Canceled

    BookingConfirmed --> OutboxEnqueued: IntegrationOutbox & EmailOutbox records created
    
    state OutboxProcessing {
        OutboxEnqueued --> WorkerLeased: Worker acquires leaseToken
        WorkerLeased --> GoogleCalendarSynced: Event created on Google Calendar
        WorkerLeased --> EmailDispatched: Invitee & Host confirmation sent via SMTP
        WorkerLeased --> WorkerRetry: External API failure (Backoff * 2)
    }

    WorkerRetry --> WorkerLeased: Attempt < MaxRetries
    WorkerRetry --> OutboxDead: Attempt >= MaxRetries

    GoogleCalendarSynced --> ActiveBooking: Confirmed & Synced
    EmailDispatched --> ActiveBooking
    ActiveBooking --> Rescheduled: /manage/:bookingId/reschedule
    ActiveBooking --> Canceled: /manage/:bookingId/cancel
    ActiveBooking --> [*]
```

---

## 5. Service Integrations & Webhook Ingestion

```mermaid
sequenceDiagram
    autonumber
    actor Invitee as Invitee
    participant Web as On-Time Web (Next.js)
    participant DB as PostgreSQL 18
    participant Worker as Background Worker
    participant Google as Google Calendar API
    participant SMTP as Gmail SMTP
    participant Stripe as Stripe API

    Invitee->>Web: Selects appointment slot & enters details
    Web->>DB: Atomic INSERT Booking & Outbox (PENDING)
    Web-->>Invitee: Displays Confirmation & ICS download link

    loop Every 5 Seconds (Worker Poll)
        Worker->>DB: Acquire lease on pending outbox items
        DB-->>Worker: Return batch of outbox tasks
        Worker->>Google: Create calendar event via OAuth2 token
        Google-->>Worker: Return external calendar event ID
        Worker->>SMTP: Dispatch transactional HTML confirmation email
        SMTP-->>Worker: 250 Message accepted
        Worker->>DB: Update Outbox status = COMPLETED, release lease
    end

    Note over Invitee,Stripe: For paid bookings:
    Invitee->>Web: Request checkout
    Web->>Stripe: Create Stripe Checkout Session (Test Mode)
    Stripe-->>Invitee: Redirect to Stripe hosted checkout
    Invitee->>Stripe: Submit test payment
    Stripe->>Web: POST /api/integrations/stripe/webhook (Signed payload)
    Web->>DB: Reconcile payment & transition booking to CONFIRMED
```

---

## 6. Cryptographic Key & Secret Hierarchy

```mermaid
flowchart TD
    MasterSecrets["Secret Storage (/home/ubuntu/ontime/secrets)"] --> TLS["PostgreSQL TLS Keys\n(ca.crt, server.crt, server.key)"]
    MasterSecrets --> AuthSecret["AUTH_SECRET\n(JWT / Auth Session Encryption)"]
    MasterSecrets --> TenantSecret["TENANT_CONTEXT_SECRET\n(PostgreSQL RLS HMAC Authority)"]
    MasterSecrets --> ProxySecret["PROXY_SHARED_SECRET\n(Ingress Header Authentication)"]
    MasterSecrets --> TokenEncKey["TOKEN_ENCRYPTION_KEY\n(AES-256-GCM for Google OAuth Tokens)"]
    MasterSecrets --> CapabilitySecret["BOOKING_CAPABILITY_SECRET\n(HMAC for Reschedule / Cancel Links)"]
    MasterSecrets --> ProviderSecrets["Provider Credentials\n(Stripe Test Keys, Google OAuth, SMTP App Pass)"]
```
