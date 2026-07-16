# Vehicle Community Platform — Right-Sized Architecture Plan

A phased roadmap covering the full community-platform spec (communities, clubs, posts, comments, reactions, follows, events, reviews, roadside help, reputation/gamification, moderation, search, feed ranking) — right-sized to this app's actual architecture: a single Express monolith on Postgres + Redis, not the microservices/Kafka/Elasticsearch/Kubernetes stack the original brief specified.

**Marketplace (listings, saved items, negotiation, payments) is intentionally excluded from every phase below** — held back as a later idea at the user's explicit call, not sequenced yet. See §9 for what stays true when it's picked back up.

## 1. Reality check

The original brief specifies 16 microservices, Kafka, Elasticsearch, Kubernetes, and a 10M-user/100M-post/1B-comment design target. None of that matches what this codebase is today:

- **One Express process** runs everything — API and background jobs in the same deployment, no worker fleet (per `CLAUDE.md`).
- **Zero Kafka, zero Elasticsearch, zero Kubernetes** anywhere in this monorepo.
- The Postgres database is **shared with an unrelated B2B product**, with a migration history that isn't fully trustworthy from scratch.
- Every feature built this quarter — Parking, Payments, Vehicle Messaging — is a **module inside the same monolith**, not a separate service.

A 16-microservice split for an app with no measured concurrent load solves a problem that doesn't exist yet, at the cost of the one that does: shipping. Postgres + Redis (already deployed, already understood) comfortably serves this feature into the hundreds-of-thousands-to-low-millions range with correct indexing — see §8 for the actual scaling triggers.

The product idea itself is sound: vehicle-specific communities, clubs by make/model, local discovery, roadside help, and garage reviews plug directly into things this app already does (SOS, garage locator, vehicle profiles, messaging). This plan builds that idea the way everything else here has been built — right-sized, in the monolith, phased.

## 2. Phased scope

| Phase | Ships | 
|---|---|
| **A — Core** | Communities (topic + local), Posts (text/image/video/poll/question), nested comments, reactions, follow, home feed (following/latest/trending), hashtags, basic Postgres search, basic moderation (report/block/spam-limit), notifications |
| **B — Social layer** | Clubs (public/private, admins, membership requests, feed/chat/gallery), Events (RSVP, calendar, reminders), nearby-community discovery |
| **C — Transactional** | Reviews (garages/mechanics/parking/charging — extends the existing Garage Finder), Roadside Help (extends existing SOS, doesn't duplicate it) |
| **D — Retention** | Reputation (XP, levels, badges, trusted/verified tags), gamification (streaks, missions, leaderboards), AI features (toxic-comment detection, auto-tag, duplicate detection, AI search, summaries) — all via the existing Gemini/Groq model router |
| **Later** | Marketplace (listings, saved, negotiation, payments — parked, see §9), Voice Rooms, Live Streaming, Video Rooms, AR Vehicle Showcase, Vehicle Timeline, Insurance Claims, Roadside Booking |

**Why this order:** Phase A is the entire reason people would open the app daily — a feed with nothing to browse has no retention value. Clubs/Events need Phase A's post/comment primitives to exist first. Reviews/Roadside Help are valuable but transactional, not daily-habit-forming, so they follow. Reputation/Gamification need real activity data to reward — building XP before there's anything to earn XP for is pointless.

## 3. System overview

Community becomes `Backend/src/modules/community/` — a peer to `parking/`, `payments/`, and `messaging/`, reusing the same cross-cutting services those modules already reuse: notifications, S3 storage, the hardened Socket.io room system, the AI model router, BullMQ jobs, rate-limit middleware, and the Report/moderation shape built for Vehicle Messaging.

```
 MOBILE (React Native)                         ADMIN (React + Vite)
 ┌────────────────────────────┐                 ┌───────────────────────┐
 │ CommunityFeedScreen          │                │ Moderation queue       │
 │ CommunityDetailScreen        │                │ Reports dashboard      │
 │ PostComposer / PostDetail    │                │ Analytics (Phase D)    │
 │ ClubScreen / EventScreen     │                └───────────┬───────────┘
 └──────────────┬───────────────┘                             │
                │ HTTPS /v1/community/*                        │ HTTPS /v1/admin/community/*
                ▼                                              ▼
 ┌──────────────────────────── Backend (Express, same process) ─────────────────────────┐
 │  modules/community/                                                                    │
 │  ├─ community.routes.ts / .controller.ts / .service.ts / .validators.ts (topic+local)  │
 │  ├─ post.routes.ts / .controller.ts / .service.ts        (posts, hashtags, polls)       │
 │  ├─ comment.routes.ts / .controller.ts / .service.ts      (nested replies, reactions)    │
 │  ├─ feed.service.ts        (hybrid push/pull ranking — §6)                              │
 │  ├─ club.routes.ts / .service.ts            (Phase B)                                   │
 │  ├─ event.routes.ts / .service.ts           (Phase B)                                   │
 │  ├─ review.routes.ts / .service.ts          (Phase C)                                   │
 │  ├─ reputation.service.ts                   (Phase D)                                   │
 │  └─ moderation.service.ts   (reuses the Report pattern built for Vehicle Messaging)      │
 │           │                    │                    │                    │              │
 │           ▼                    ▼                    ▼                    ▼              │
 │   services/notification   services/storage    socket.ts (rooms,   services/ai-provider  │
 │   .service.ts (push)      .service.ts (S3)     hardened, reused)   .service.ts (mod. AI) │
 └──────────────────────────────────────────┬───────────────────────────────────────────────┘
                                             ▼
                                Postgres · schema "customer"  +  Redis (cache/rank/rate-limit)
```

## 4. Data model — Phase A (core)

Same conventions as every model built this quarter: `cuid()` ids, explicit `createdAt`/`updatedAt`, indexes before the trailing `@@schema("customer")`. Denormalized counters (`commentCount`, `reactionCount`) avoid a `COUNT(*)` on every feed render.

```prisma
model Community {
  id           String            @id @default(cuid())
  slug         String            @unique
  name         String
  type         CommunityType                     // TOPIC | LOCAL
  localKind    LocalCommunityKind?                // CITY | DISTRICT | COLLEGE | COMPANY | APARTMENT | HIGHWAY
  description  String?
  iconUrl      String?
  bannerUrl    String?
  memberCount  Int               @default(0)
  postCount    Int               @default(0)
  isOfficial   Boolean           @default(false)
  createdBy    String?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  members  CommunityMembership[]
  posts    Post[]

  @@index([type])
  @@index([localKind])
  @@schema("customer")
}

model CommunityMembership {
  id          String   @id @default(cuid())
  communityId String
  customerId  String
  role        CommunityRole @default(MEMBER)   // MEMBER | MODERATOR | ADMIN
  joinedAt    DateTime @default(now())

  community Community @relation(fields: [communityId], references: [id], onDelete: Cascade)
  customer  Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@unique([communityId, customerId])
  @@index([customerId])
  @@schema("customer")
}

model Hashtag {
  id        String   @id @default(cuid())
  tag       String   @unique
  postCount Int      @default(0)
  posts     PostHashtag[]

  @@schema("customer")
}

model Post {
  id            String     @id @default(cuid())
  authorId      String
  communityId   String?
  vehicleId     String?
  type          PostType    // TEXT IMAGE VIDEO POLL QUESTION LOCATION EVENT LOST_FOUND EMERGENCY ROAD_ALERT
  text          String?
  mediaUrls     String[]  @default([])
  latitude      Float?
  longitude     Float?
  pollOptions   Json?
  isPinned      Boolean   @default(false)
  status        PostStatus @default(PUBLISHED)   // PUBLISHED | REMOVED | SHADOW_HIDDEN
  commentCount  Int       @default(0)
  reactionCount Int       @default(0)
  shareCount    Int       @default(0)
  searchVector  Unsupported("tsvector")?          // Postgres full-text — see §7
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  author    Customer   @relation(fields: [authorId], references: [id], onDelete: Cascade)
  community Community? @relation(fields: [communityId], references: [id], onDelete: SetNull)
  comments  Comment[]
  reactions Reaction[]
  hashtags  PostHashtag[]

  @@index([communityId, createdAt])
  @@index([authorId, createdAt])
  @@index([vehicleId])
  @@index([status])
  @@schema("customer")
}

model PostHashtag {
  postId    String
  hashtagId String
  post      Post    @relation(fields: [postId], references: [id], onDelete: Cascade)
  hashtag   Hashtag @relation(fields: [hashtagId], references: [id], onDelete: Cascade)

  @@id([postId, hashtagId])
  @@schema("customer")
}

model Comment {
  id            String   @id @default(cuid())
  postId        String
  authorId      String
  parentId      String?                          // flat self-relation — see note below
  text          String?
  gifUrl        String?
  imageUrl      String?
  voiceUrl      String?
  isPinned      Boolean  @default(false)
  isAcceptedAnswer Boolean @default(false)        // for QUESTION-type posts
  reactionCount Int      @default(0)
  status        PostStatus @default(PUBLISHED)
  createdAt     DateTime @default(now())

  post   Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  author Customer  @relation(fields: [authorId], references: [id], onDelete: Cascade)
  parent Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies Comment[] @relation("CommentReplies")
  reactions Reaction[]

  @@index([postId, createdAt])
  @@index([parentId])
  @@schema("customer")
}

/// One row per (user, target, emoji) — covers post AND comment reactions via nullable targets.
model Reaction {
  id         String    @id @default(cuid())
  customerId String
  postId     String?
  commentId  String?
  emoji      String
  createdAt  DateTime  @default(now())

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  post     Post?    @relation(fields: [postId], references: [id], onDelete: Cascade)
  comment  Comment? @relation(fields: [commentId], references: [id], onDelete: Cascade)

  @@unique([customerId, postId, commentId])
  @@index([postId])
  @@index([commentId])
  @@schema("customer")
}

model Follow {
  id           String   @id @default(cuid())
  followerId   String
  followingId  String
  createdAt    DateTime @default(now())

  follower  Customer @relation("FollowerEdge", fields: [followerId], references: [id], onDelete: Cascade)
  following Customer @relation("FollowingEdge", fields: [followingId], references: [id], onDelete: Cascade)

  @@unique([followerId, followingId])
  @@index([followingId])
  @@schema("customer")
}

enum CommunityType       { TOPIC LOCAL                                              @@schema("customer") }
enum LocalCommunityKind  { CITY DISTRICT COLLEGE COMPANY APARTMENT HIGHWAY PARKING_AREA @@schema("customer") }
enum CommunityRole       { MEMBER MODERATOR ADMIN                                   @@schema("customer") }
enum PostType            { TEXT IMAGE VIDEO POLL QUESTION LOCATION EVENT LOST_FOUND EMERGENCY ROAD_ALERT @@schema("customer") }
enum PostStatus          { PUBLISHED REMOVED SHADOW_HIDDEN                          @@schema("customer") }
```

**Deliberate simplification:** comment nesting is flattened to one `parentId` self-relation, not a materialized path or closure table. Deep Reddit-style nesting is a moderation/UX headache more than a value-add here — 2–3 visual levels with client-side grouping covers the brief's own examples ("mention users," "accepted answer"). If deeper nesting turns out to matter, it's a query-pattern change, not a schema rewrite.

## 5. Data model — Phase B (clubs & events)

```prisma
model Club {
  id           String       @id @default(cuid())
  name         String
  slug         String       @unique
  description  String?
  bannerUrl    String?
  visibility   ClubVisibility @default(PUBLIC)     // PUBLIC | PRIVATE
  memberCount  Int          @default(0)
  createdBy    String
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  members  ClubMembership[]
  events   Event[]

  @@schema("customer")
}

model ClubMembership {
  id        String    @id @default(cuid())
  clubId    String
  customerId String
  role      ClubRole  @default(MEMBER)             // MEMBER | ADMIN
  status    MembershipStatus @default(APPROVED)     // PENDING | APPROVED | REJECTED
  joinedAt  DateTime  @default(now())

  club     Club     @relation(fields: [clubId], references: [id], onDelete: Cascade)
  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@unique([clubId, customerId])
  @@schema("customer")
}

model Event {
  id           String      @id @default(cuid())
  clubId       String?
  communityId  String?
  title        String
  description  String?
  coverUrl     String?
  startsAt     DateTime
  endsAt       DateTime?
  latitude     Float?
  longitude    Float?
  locationName String?
  capacity     Int?
  rsvpCount    Int         @default(0)
  createdBy    String
  createdAt    DateTime    @default(now())

  club  Club?  @relation(fields: [clubId], references: [id], onDelete: Cascade)
  rsvps EventRSVP[]

  @@index([startsAt])
  @@schema("customer")
}

model EventRSVP {
  id         String    @id @default(cuid())
  eventId    String
  customerId String
  status     RsvpStatus @default(GOING)             // GOING | INTERESTED | DECLINED
  createdAt  DateTime  @default(now())

  event    Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@unique([eventId, customerId])
  @@schema("customer")
}

enum ClubVisibility   { PUBLIC PRIVATE          @@schema("customer") }
enum ClubRole         { MEMBER ADMIN            @@schema("customer") }
enum MembershipStatus { PENDING APPROVED REJECTED @@schema("customer") }
enum RsvpStatus       { GOING INTERESTED DECLINED @@schema("customer") }
```

Club Chat and Event Chat reuse the same Socket.io room system built for Vehicle Messaging — a club/event just becomes another room name (`club:<id>`) instead of a customerId. No new real-time infrastructure.

## 6. Data model — Phase C (reviews)

Reviews (garages/mechanics/parking/charging) are in scope for Phase C; Marketplace is not — see §9.

```prisma
model Review {
  id            String       @id @default(cuid())
  authorId      String
  targetType    ReviewTarget   // GARAGE MECHANIC PARKING CHARGING_STATION CAR_WASH TYRE_SHOP
  targetId      String         // FK-free by design — points at whichever table targetType names
  rating        Int            // 1-5
  text          String?
  imageUrls     String[]  @default([])
  createdAt     DateTime  @default(now())

  author Customer @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([targetType, targetId])
  @@schema("customer")
}

enum ReviewTarget { GARAGE MECHANIC PARKING CHARGING_STATION CAR_WASH TYRE_SHOP @@schema("customer") }
```

**Roadside Help is not a new model.** This app already has a real SOS system (SMS/email/voice alerting, GPS capture) — Phase C extends it with a lightweight `volunteer` flag on nearby responders and a `helpType` field (flat tyre / battery / fuel / tow), reusing the exact dispatch shape already scoped for Roadside Assistance in the earlier backlog. `Review.targetId` is intentionally FK-less so it can point at Google-Places-sourced garages today and a first-party Garage model later without a migration.

## 7. Data model — Phase D (reputation & gamification)

```prisma
model ReputationProfile {
  customerId    String   @id
  xp            Int      @default(0)
  level         Int      @default(1)
  trustedOwner  Boolean  @default(false)
  verifiedGarage Boolean @default(false)
  verifiedMechanic Boolean @default(false)
  updatedAt     DateTime @updatedAt

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@schema("customer")
}

model Badge {
  id          String @id @default(cuid())
  key         String @unique
  name        String
  description String
  iconUrl     String?

  holders CustomerBadge[]
  @@schema("customer")
}

model CustomerBadge {
  id         String   @id @default(cuid())
  customerId String
  badgeId    String
  awardedAt  DateTime @default(now())

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  badge    Badge    @relation(fields: [badgeId], references: [id], onDelete: Cascade)

  @@unique([customerId, badgeId])
  @@schema("customer")
}

model DailyStreak {
  customerId    String   @id
  currentStreak Int      @default(0)
  longestStreak Int      @default(0)
  lastActiveDate DateTime @db.Date

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  @@schema("customer")
}
```

XP awards and streak updates run as fire-and-forget calls from the Post/Comment/Reaction services (matching how `notifyCustomer()` is already called today) — not a separate event-sourced ledger. A leaderboard is a Redis sorted set (`ZINCRBY`), refreshed on write, read on request.

## 8. Feed algorithm, realtime, search, moderation & AI

- **Following feed** — pull model: `WHERE authorId IN (my follows) OR communityId IN (my communities) ORDER BY createdAt DESC`, served directly from a well-indexed Postgres query. No fan-out write on every post.
- **Trending / Nearby** — Redis sorted sets (`ZINCRBY trending:global`, `trending:community:<id>`) updated on reaction/comment; a BullMQ decay job re-scales scores by recency, same pattern as the existing abandoned-booking sweep.
- **Ranking formula (v1):** `score = (reactions×1 + comments×2 + shares×3) / (hours_since_post + 2)^1.5` — the well-known Hacker News decay formula. AI re-ranking (Phase D) is a pass over this same candidate set using the existing Gemini embedding pipeline, not a new recommendation service.
- **Realtime** — reuses the JWT-verified Socket.io rooms hardened for Vehicle Messaging: `new_comment`/`new_reaction` on `post:<id>`, `typing` on `club:<id>`/`event:<id>`, notifications on `<customerId>`.
- **Search** — Postgres `tsvector` + GIN index on Post/Community/Hashtag, covering every in-scope search need with zero new infrastructure. Elasticsearch is deferred — the actual trigger (fuzzy/faceted search or sub-50ms latency at 10M+ rows) is in §9.
- **Moderation** — a `ContentReport` model mirroring `ConversationReport`, shadow-ban via a boolean on `Customer` (paired with the existing `isSuspended` flag), spam rate-limiting via the same `express-rate-limit` pattern used for messaging, community moderators via `CommunityMembership.role = MODERATOR`.
- **AI** — toxic-comment detection, auto-tagging (embedding similarity), duplicate detection, and AI summaries/search all go through the existing cost-pinned `modelRouter`, not a new AI stack.

## 9. Deferred, on purpose

| Item | Why it waits |
|---|---|
| **Marketplace (listings, saved items, negotiation, payments)** | **Held back at the user's explicit call** — parked as a later idea, not sequenced into Phases A–D. When it's picked back up: listings reuse the same modeling style as Review (`MarketplaceListing`/`SavedListing`), negotiation reuses the existing Messaging module, and payment reuses the Customer Payments module already built for Parking (Razorpay order/refund flow) via its `purpose`-enum extension point — so resuming it later is additive, not a redesign. |
| Kafka / event streaming | Nothing in this app currently needs cross-service event delivery — there's one process. BullMQ (already running) covers every async job this plan needs. |
| Elasticsearch | Postgres full-text handles the stated search scope. Revisit at the trigger below. |
| Kubernetes / microservice split | There's one deployable today. Splitting it multiplies deploy/monitoring/on-call surface for zero current benefit. |
| Voice Rooms, Live Streaming, Video Rooms, AR Showcase | Each is its own product with its own media-infra decision (WebRTC SFU, live transcoding) — separate scoping exercises. |
| Insurance Claims, Roadside Booking | Both depend on business/vendor relationships outside engineering's control. |

**Scaling triggers** (so the future isn't ignored, just correctly sequenced):

| Signal | Then introduce |
|---|---|
| A single account's follow list makes the following-feed query scan too many rows (~50k+ follows) | Fan-out-on-write for that account's feed only |
| Search latency measured >200ms at real query volume, or fuzzy/faceted search becomes a real ask | Elasticsearch, fed by CDC off Postgres |
| The single Express process is CPU/memory-bound under real load (measured, not guessed) | Horizontal scaling of that same process — still not microservices |
| One specific workload needs independent scaling/deploy cadence | *That one* workload peels off — not all at once |
| Cross-service event delivery is genuinely needed | Kafka, or simpler: Redis Streams first (already deployed) |
| Uptime/on-call requirements justify it and there are ≥2 independently-scaling services | Kubernetes |

## 10. Roadmap

| Phase | Scope | Est. hours |
|---|---|---:|
| A | Schema + migration, Community/Post/Comment/Reaction/Follow CRUD, following+trending+nearby feed, hashtags, Postgres search, basic report/block/rate-limit, notifications, Mobile feed+composer+detail screens, Admin tab extension | ~140h |
| B | Clubs (CRUD, membership requests, admin roles, chat via existing socket), Events (CRUD, RSVP, reminders), nearby-community discovery, Mobile club/event screens | ~90h |
| C | Reviews (garage/mechanic/parking/charging), Roadside Help extension on existing SOS, Mobile screens | ~55h |
| D | Reputation/XP/badges/streaks, leaderboards (Redis), AI moderation + auto-tag + duplicate detection + AI search, Admin analytics extension | ~80h |
| **Total, A–D** | | **~365h** |
| Later | Marketplace (listings, saved, negotiation, payments) — not estimated, not scheduled; scoped fresh whenever it's picked up | — |

365h across Phases A–D is smaller than the Phase-4 Garage Platform backlog (1,022h) already scoped for this app, and delivers a daily-use feature. Start with Phase A alone (~140h) and decide B–D based on what Phase A's actual usage shows.
