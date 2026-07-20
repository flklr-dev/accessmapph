<p align="center">
  <img src="client/src/assets/accessmap-logo.png" alt="AccessMap PH Logo" width="450"/>
</p>

<p align="center">
  <b>ACCESSMAP PH: CROWDSOURCED ACCESSIBILITY MAPPING</b><br/>
  Empowering Filipino PWDs with real-time, community-verified accessibility data for public spaces.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2.6-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Vite-6.4.3-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS"/>
  <img src="https://img.shields.io/badge/TypeScript-6.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"/>
</p>

---

## ♿ Overview

**AccessMap PH** is an accessibility mapping web application designed to help Persons with Disabilities (PWDs), caregivers, and advocates report, discover, and verify real accessibility conditions at public spaces (malls, government offices, hospitals, and parks) across the Philippines.

By integrating user contribution logs, geocoding resolvers, and a multi-tiered moderation pipeline, AccessMap PH allows the community to build a reliable database of urban accessibility. The application targets WCAG 2.1 AA design systems to ensure that the site itself remains fully accessible.

---

## 🌿 Key Features

### 1. 🔍 Location Resolution & Deduplication Pipeline

To prevent duplicate pins representing the same public venues, AccessMap PH runs a backend resolution pipeline when creating and matching locations:

* **Place Key (OSM Nominatim)**: Automatically maps incoming coordinates against OpenStreetMap elements. If an OSM `placeKey` exists (e.g., `osm:way:123456`), users are linked to that canonical place entry regardless of minor tap offsets.
* **Proximity Matching**: Falls back to Haversine distance calculations when OSM IDs are missing, flagging pins within a 75m radius:
  $$
  D_{\text{Haversine}}(P_1, P_2) \le 75\text{m}
  $$
* **Separation Guard**: Blocks creating a new pin within a 15m radius of an existing pin unless an explicit `forceNew` flag is provided.
* **Hard Minimum Floor**: Enforces a strict 5m database collision limit ($D < 5\text{m}$) that permanently blocks duplicate entries.

### 2. 🛡️ Multi-Tiered Moderation & Trust Engine

Submissions go through a three-stage validation pipeline to guarantee high-quality, spam-free accessibility ratings:

* **Tier 1 (Rule Engine)**: Automates basic rules to screen out invalid text (e.g., descriptions under 8 characters, shouting caps, known nonsense strings, or identical submissions from the same user within 24 hours).
* **Tier 2 (Trust Status)**: Users with a successful mapping track record ($\ge 3$ approved reports and $0$ flags) bypass public review queues; their reports go live instantly with an `approved` verdict.
* **Tier 3 (Community Review)**: Reports from new contributors go live under a `pending` status. Members can vote to confirm or flag:
  * **Verified**: $\ge 5$ net upvotes adds a verified badge and updates user ratings.
  * **Flagged / Hidden**: $\ge 3$ downvotes hides the report and triggers reputation penalties.

### 3. 🎛️ Interactive Map with Disability Filters

* **Map Interface**: A Leaflet.js-powered viewport loaded with OpenStreetMap tiles supporting custom markers and fast marker clustering.
* **Dynamic Colors & Icons**: Communicates accessibility statuses using highly visible markers and specific icons:
  * 🟢 **Accessible**: Fully navigable features.
  * 🟡 **Partially Accessible**: Usable, with minor challenges.
  * 🔴 **Inaccessible**: Impenetrable barriers or broken equipment.
  * ⚪ **Unverified**: Newly mapped locations awaiting a first report.
* **Disability Overlays**: Instantly toggle features tailored for **Mobility** (ramps, elevators, restrooms), **Visual** (tactile tiles, braille), **Hearing** (visual screens, captions), and **Cognitive** (clear signs, quiet rooms) needs.

### 4. 🏆 Gamified Contributions & Leaderboards

* **Points System**: Users receive points for submissions and audits (+10 for auto-approved reviews, +2 for pending reviews, +5 when a pending review is verified by others, and -15 if community flagged).
* **Reputation Ranks**: Rewards activity by upgrading users across ranks:
  * **Newcomer**: $0 - 49$ points.
  * **Contributor**: $50 - 199$ points.
  * **Trusted**: $200 - 499$ points.
  * **Champion**: $\ge 500$ points.
* **Leaderboards**: Displays top contributors filtered by city to promote localized data auditing.

### 5. 📸 Proof-Focused Report Forms

* **Cloudinary Uploads**: Users can attach up to 3 image proofs per feature review, hosted securely using Cloudinary's optimized media delivery.
* **Detailed Descriptions**: Input fields up to 280 characters for providing specific notes on ramp gradients, restroom locks, or elevator braille.

### 6. 🔐 Secure Session Auditing

* **Firebase Auth**: Connects securely with email/password and Google OAuth providers.
* **Route Validation**: Uses Firebase Admin SDK to check tokens backend-side, ensuring contribution metrics are accurately tied to genuine accounts.

---

## ♿ Supported Accessibility Features

AccessMap PH is structured to track specific structural assets across public spaces:

| Feature Type        |   DB Code   | Primary Assessment Criteria                                           |
| :------------------ | :----------: | :-------------------------------------------------------------------- |
| **Ramps**     |   `ramp`   | Wheelchair ramps, slope gradient, handrails, anti-slip surface.       |
| **Elevators** | `elevator` | Accessible elevator buttons, braille tags, voice prompts, wide doors. |
| **Restrooms** | `restroom` | Safety handrails, wide entry, low sink, emergency call buttons.       |
| **Parking**   | `parking` | Designated PWD parking slots close to entry points.                   |
| **Pathways**  | `pathway` | Wide, unobstructed corridors and tactile guiding blocks.              |
| **Signage**   | `signage` | High-contrast visual text and braille indicators.                     |

---

## 📐 Architecture

AccessMap PH follows a three-tier web application architecture. The browser client handles geocoding resolution and map rendering, the Node.js API manages data processing, and MongoDB handles geospatial query indexes.

### 💻 Web Client — React + TypeScript

| Layer       | Technology                  | Purpose                                    |
| :---------- | :-------------------------- | :----------------------------------------- |
| Framework   | React 19 · Vite 6          | High-performance component rendering       |
| Language    | TypeScript 5.0+             | Type-safe front-end development            |
| State       | Zustand v5                  | Global client-side stores                  |
| Styling     | Tailwind CSS v4             | Responsive utility layouts                 |
| Map Layer   | Leaflet.js · React-Leaflet | Open-source map layer and vector rendering |
| Icons       | Lucide React                | Modern vector indicator icons              |
| Auth Client | Firebase Client SDK         | Login interfaces and session checks        |

### ⚙️ Backend Server — Node.js + Express

| Layer       | Technology               | Purpose                                         |
| :---------- | :----------------------- | :---------------------------------------------- |
| Framework   | Node.js 20+ · Express 5 | Asynchronous server engine                      |
| Database    | MongoDB · Mongoose      | Spatial document queries (`2dsphere` indexes) |
| Caching     | Redis                    | API rate-limiting and validation storage        |
| CDN Handler | Cloudinary SDK           | Upload validation and CDN storage integration   |
| Security    | Helmet · Cors           | Response hardening and origin configuration     |
| Auth Admin  | Firebase Admin SDK       | Server-side JWT signature audits                |

### 🔄 How It All Connects

```
┌─────────────────────────────────────────────────────────────┐
│                      📱  WEB CLIENT                         │
│                                                             │
│   Map Interact ──► Resolution API ──► Deduplication         │
│                      │                       │              │
│                  Map Pin                Resolution          │
│                      └───────┬───────────┘                      │
│                              ▼                                  │
│                      Report Submission                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ /api/reports
┌──────────────────────────────────────────────────────────────┐
│                    ⚙️  BACKEND SERVER                        │
│                                                              │
│   Rules Engine ──► Trust Engine ──► Auto-Approve             │
│          │                                   │               │
│       Flagged (Hide)                  Awaiting Review        │
└──────────┬───────────────────────────────────┬───────────────┘
                ▼                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                   📊  DATABASE & SERVICES                    │
│                                                              │
│   MongoDB (User/Location/Report) ◄──► Firebase Auth          │
│   Cloudinary CDN (Photo Storage) ◄──► Redis Cache            │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Development Setup & Installation

### Prerequisites

* [Node.js](https://nodejs.org/) (v20 or higher recommended)
* [MongoDB](https://www.mongodb.com/) (Local server or Atlas URI)
* [Redis](https://redis.io/) (Local instance or Cloud URL)
* [Firebase Project](https://firebase.google.com/) configured with Email & Google sign-in (see [docs/auth-setup.md](./docs/auth-setup.md))
* [Cloudinary Account](https://cloudinary.com/) (For storage API credentials)

---

### 1. Backend Server Setup

1. Navigate to the `server/` directory:

   ```bash
   cd server
   ```
2. Install server dependencies:

   ```bash
   npm install
   ```
3. Create a `.env` file in the `server/` directory:

   ```env
   PORT=3001
   MONGODB_URI=mongodb://localhost:27017/accessmapph
   REDIS_URL=redis://localhost:6379
   CLIENT_URL=http://localhost:5173

   # Firebase Service Account Credentials
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

   # Cloudinary configuration
   CLOUDINARY_CLOUD_NAME=your_cloudinary_name
   CLOUDINARY_API_KEY=your_cloudinary_key
   CLOUDINARY_API_SECRET=your_cloudinary_secret
   ```
4. Start the development server:

   ```bash
   npm run dev
   ```

   The backend API will run on `http://localhost:3001`.

---

### 2. Web Client Setup

1. Navigate to the `client/` directory:
   ```bash
   cd client
   ```
2. Install client dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `client/` directory:
   ```env
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
   VITE_FIREBASE_APP_ID=1:your:app:id
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id

   VITE_API_BASE_URL=http://localhost:3001
   ```
4. Start the frontend developer server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5173` in your web browser.

---

## 📦 Building for Production

### Frontend (Vercel)

The React web client can be built and deployed via Vercel.
To build the distribution bundles locally:

```bash
cd client
npm run build
```

Deploy the output `dist/` directory to your static web host.

### Backend (Render / Railway / Heroku)

Deploy the Express server to a Node runtime environment. Set up the production variables matching `server/.env`.
To run the production build:

```bash
cd server
npm run build
npm start
```

---

## 🛡️ License

This project is licensed under the **MIT License**. See the configuration files for details.

---

<p align="center">
  Developed with ❤️ for the PWD Community. Empowering accessible cities.
</p>
