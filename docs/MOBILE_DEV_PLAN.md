# Seetu Mobile App Development Plan

Based on the UI/UX mockups provided, this document outlines the complete implementation plan for the Seetu mobile application.

---

## 1. Technology Stack

### Recommended Stack
- **Framework**: React Native with Expo (SDK 52+)
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand
- **API Client**: TanStack Query + fetch
- **UI Components**: Custom components with NativeWind (Tailwind CSS)
- **Authentication**: Supabase Auth with secure token storage
- **Image Handling**: expo-image-picker, expo-camera
- **Storage**: expo-secure-store (tokens), AsyncStorage (cache)

### Why Expo?
- OTA updates for quick iterations
- Simplified native module access
- EAS Build for app store submissions
- Same codebase for iOS and Android

---

## 2. Screen Inventory

Based on the mockups, here are all screens to implement:

### Authentication Flow (3 screens)
| Screen | Description | API Endpoints |
|--------|-------------|---------------|
| `Onboarding` | 3-slide carousel introducing app features | None |
| `Login` | Email/password login form | `POST /api/v1/auth/login` |
| `Signup` | Registration form | `POST /api/v1/auth/signup` |

### Main App (Tab Navigation - 4 tabs)
| Tab | Screen | Description | API Endpoints |
|-----|--------|-------------|---------------|
| Accueil | `Home` | Dashboard with CTA, recent creations | `GET /api/v1/user`, `GET /api/v1/generations` |
| Studio | `Studio` | 4-step generation wizard | Multiple (see below) |
| Produits | `Products` | Product catalog grid | `GET /api/v1/products` |
| Profil | `Profile` | User info, credits, settings | `GET /api/v1/user`, `GET /api/v1/credits` |

### Studio Wizard (4 steps + result)
| Step | Screen | Description | API Endpoints |
|------|--------|-------------|---------------|
| 1/4 | `StudioProduct` | Upload/select product photo | `POST /api/v1/upload`, `POST /api/v1/studio/analyze` |
| 2/4 | `StudioPresentation` | Choose product alone or on model | `GET /api/v1/marketplace?type=MODEL_PROFILE` |
| 3/4 | `StudioDecor` | Select background/location | `GET /api/v1/studio/backgrounds`, `GET /api/v1/marketplace?type=LOCATION` |
| 4/4 | `StudioSummary` | Review selection, show cost | None (local state) |
| Result | `StudioResult` | Generated image with save option | `POST /api/v1/studio/generate` |

### Additional Screens
| Screen | Description | API Endpoints |
|--------|-------------|---------------|
| `ProductDetail` | View/manage single product | `GET /api/v1/products/[id]` |
| `AddProduct` | Create new product | `POST /api/v1/products` |
| `Credits` | Buy credits | `GET /api/v1/credits/packs`, `POST /api/v1/credits/purchase` |
| `GenerationDetail` | View single generation | `GET /api/v1/generations` |

---

## 3. File Structure

```
mobile/
├── app/                          # Expo Router screens
│   ├── (auth)/                   # Auth group (no tabs)
│   │   ├── _layout.tsx
│   │   ├── onboarding.tsx
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/                   # Main app with tab bar
│   │   ├── _layout.tsx           # Tab bar configuration
│   │   ├── index.tsx             # Home (Accueil)
│   │   ├── studio/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Step 1: Product
│   │   │   ├── presentation.tsx  # Step 2: Presentation
│   │   │   ├── decor.tsx         # Step 3: Décor
│   │   │   ├── summary.tsx       # Step 4: Summary
│   │   │   └── result.tsx        # Generation result
│   │   ├── products/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Product list
│   │   │   ├── [id].tsx          # Product detail
│   │   │   └── new.tsx           # Add product
│   │   └── profile/
│   │       ├── _layout.tsx
│   │       ├── index.tsx         # Profile main
│   │       └── credits.tsx       # Buy credits
│   ├── _layout.tsx               # Root layout
│   └── +not-found.tsx
├── components/
│   ├── ui/                       # Base UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   └── ProgressIndicator.tsx
│   ├── studio/                   # Studio-specific components
│   │   ├── PhotoUploader.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── BackgroundGrid.tsx
│   │   └── SelectionSummary.tsx
│   ├── products/
│   │   ├── ProductCard.tsx
│   │   └── ProductGrid.tsx
│   └── shared/
│       ├── CreditBadge.tsx
│       ├── GenerationCard.tsx
│       └── EmptyState.tsx
├── lib/
│   ├── api/
│   │   ├── client.ts             # API client with auth
│   │   ├── auth.ts               # Auth endpoints
│   │   ├── user.ts               # User endpoints
│   │   ├── products.ts           # Products endpoints
│   │   ├── studio.ts             # Studio endpoints
│   │   ├── generations.ts        # Generations endpoints
│   │   └── credits.ts            # Credits endpoints
│   ├── stores/
│   │   ├── auth-store.ts         # Auth state
│   │   ├── studio-store.ts       # Studio wizard state
│   │   └── user-store.ts         # User/credits state
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCredits.ts
│   │   └── useStudioWizard.ts
│   └── utils/
│       ├── storage.ts            # Secure storage helpers
│       ├── image.ts              # Image processing
│       └── format.ts             # Formatting helpers
├── constants/
│   ├── colors.ts                 # Terracotta theme colors
│   ├── api.ts                    # API base URL
│   └── onboarding.ts             # Onboarding content
├── assets/
│   ├── images/
│   └── fonts/
├── app.json
├── package.json
├── tsconfig.json
└── tailwind.config.js
```

---

## 4. Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Project setup and authentication flow

#### Tasks:
1. **Project Setup**
   - Initialize Expo project with TypeScript
   - Configure NativeWind/Tailwind
   - Set up Expo Router
   - Configure ESLint + Prettier

2. **Theme & Design System**
   - Define color palette (terracotta primary: `#C67B5C`)
   - Create base UI components (Button, Input, Card)
   - Set up typography (fonts, sizes)
   - Create icon set

3. **Authentication**
   - Implement secure token storage
   - Create API client with Bearer auth
   - Build Onboarding carousel (3 slides)
   - Build Login screen
   - Build Signup screen
   - Implement auth state management

#### Deliverables:
- [ ] Working auth flow
- [ ] Persistent login
- [ ] Onboarding experience

---

### Phase 2: Core Navigation & Home (Week 2)
**Goal**: Tab navigation and home dashboard

#### Tasks:
1. **Tab Navigation**
   - Configure bottom tab bar
   - Style active/inactive states
   - Add center "Studio" FAB button

2. **Home Screen**
   - Header with greeting + credit badge
   - "Créer une nouvelle image" CTA card
   - "Dernières Créations" horizontal scroll
   - Pull-to-refresh

3. **Profile Screen**
   - User info display
   - Credits card
   - Logout functionality

#### Deliverables:
- [ ] Working tab navigation
- [ ] Home with real data
- [ ] Profile with credits display

---

### Phase 3: Studio Wizard (Week 3-4)
**Goal**: Complete 4-step generation wizard

#### Tasks:
1. **Step 1: Product Upload**
   - Camera integration
   - Gallery picker
   - Image preview with AI detection badge
   - Loading state during analysis

2. **Step 2: Presentation**
   - "Produit Seul" / "Sur Mannequin" toggle
   - Model selector carousel (when mannequin selected)
   - Model cards with names

3. **Step 3: Décor**
   - Tab switcher (Lieux Sénégal / Studio Couleur)
   - Background/location grid
   - Selection state

4. **Step 4: Summary**
   - Selection summary card
   - Credit cost display
   - "GÉNÉRER" button

5. **Result Screen**
   - Full-screen generated image
   - "Enregistrer" button (save to gallery)
   - "Retour à l'accueil" button

6. **State Management**
   - Zustand store for wizard state
   - Persist across steps
   - Reset on completion

#### Deliverables:
- [ ] Complete wizard flow
- [ ] Image generation working
- [ ] Save to device gallery

---

### Phase 4: Products Management (Week 5)
**Goal**: Product catalog and management

#### Tasks:
1. **Products List**
   - Grid layout (2 columns)
   - Product cards with image, name, "Générer" button
   - Add product FAB
   - Pull-to-refresh

2. **Add Product**
   - Photo upload
   - Name input
   - Brand selection
   - Save functionality

3. **Product Detail**
   - Large image
   - Product info
   - Generation history for this product
   - Delete option

4. **Quick Generate**
   - "Générer" button from product card
   - Pre-fill studio wizard with product

#### Deliverables:
- [ ] Product CRUD operations
- [ ] Quick generation from product

---

### Phase 5: Credits & Polish (Week 6)
**Goal**: Credits purchase and final polish

#### Tasks:
1. **Credits Screen**
   - Credit pack cards
   - Price display (FCFA)
   - Purchase flow (opens NabooPay)
   - Purchase confirmation

2. **Deep Linking**
   - Handle payment callbacks
   - Credit refresh after purchase

3. **Polish & Testing**
   - Loading states everywhere
   - Error handling + retry
   - Empty states
   - Animations (screen transitions, buttons)
   - Haptic feedback

4. **Performance**
   - Image caching
   - API response caching
   - Lazy loading

#### Deliverables:
- [ ] Working credit purchase
- [ ] Polished UX
- [ ] Production-ready build

---

## 5. API Integration Summary

### Required Endpoints (all ready in backend)

```typescript
// Auth
POST /api/v1/auth/login       // Email/password login
POST /api/v1/auth/signup      // Registration

// User
GET  /api/v1/user             // Get current user + credits

// Products
GET  /api/v1/products         // List user's products
POST /api/v1/products         // Create product
GET  /api/v1/products/[id]    // Get single product
DELETE /api/v1/products/[id]  // Delete product

// Upload
POST /api/v1/upload           // Upload image to Supabase

// Studio
POST /api/v1/studio/analyze   // Analyze product image (AI detection)
GET  /api/v1/studio/backgrounds // Get backgrounds
GET  /api/v1/marketplace?type=MODEL_PROFILE  // Get AI models
GET  /api/v1/marketplace?type=LOCATION       // Get locations
POST /api/v1/studio/generate  // Generate image

// Gallery
GET  /api/v1/generations      // Get user's generations (paginated)

// Credits
GET  /api/v1/credits          // Get credit balance + history
GET  /api/v1/credits/packs    // Get available packs
POST /api/v1/credits/purchase // Initiate purchase
```

### Authentication Header
```typescript
Authorization: Bearer <access_token>
```

---

## 6. Design Specifications

### Colors
```typescript
const colors = {
  primary: '#C67B5C',      // Terracotta (buttons, accents)
  primaryDark: '#A65D42',  // Darker terracotta (pressed states)
  background: '#FFFFFF',   // Main background
  surface: '#F8F9FA',      // Card backgrounds
  text: '#1A1A2E',         // Primary text
  textSecondary: '#6B7280', // Secondary text
  border: '#E5E7EB',       // Borders
  success: '#10B981',      // Success states
  error: '#EF4444',        // Error states
};
```

### Typography
```typescript
const typography = {
  h1: { fontSize: 24, fontWeight: '700' },
  h2: { fontSize: 20, fontWeight: '600' },
  h3: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 14, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
};
```

### Spacing
```typescript
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
```

### Border Radius
```typescript
const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
};
```

---

## 7. Key Components Specs

### Bottom Tab Bar
- 4 tabs: Accueil, Studio (FAB), Produits, Profil
- Center Studio button is elevated FAB with + icon
- Active state: terracotta color
- Inactive state: gray

### Credit Badge
- Terracotta background
- White coin icon + credit amount
- Appears in header and profile

### Product Card
- Square image (aspect ratio 1:1)
- Name below image
- "Générer" button (terracotta outline)
- 3-dot menu for actions

### Model Selector Card
- Portrait image
- Name overlay at bottom
- Selected state: terracotta border

### Background/Location Card
- Landscape image (aspect ratio 4:3)
- Name overlay at bottom-left
- Selected state: terracotta border

---

## 8. Testing Strategy

### Unit Tests
- API client functions
- Store actions
- Utility functions

### Integration Tests
- Auth flow
- Studio wizard flow
- Purchase flow

### E2E Tests (Detox)
- Complete user journey
- Error scenarios
- Offline behavior

---

## 9. Deployment

### Development
```bash
npx expo start
```

### Preview Builds (EAS)
```bash
eas build --profile preview --platform all
```

### Production Builds
```bash
eas build --profile production --platform all
eas submit --platform all
```

### OTA Updates
```bash
eas update --branch production
```

---

## 10. Success Metrics

- **Performance**: App launch < 2s, generation start < 500ms
- **Reliability**: < 1% crash rate
- **Engagement**: 3+ generations per active user per week
- **Conversion**: 10% of users purchase credits

---

## Appendix: Screen Mockup Reference

| # | Screen | File |
|---|--------|------|
| 1 | Onboarding 1 | screen_1.png |
| 2 | Onboarding 2 | screen_2.png |
| 3 | Onboarding 3 | screen_3.png |
| 4 | Login | screen_4.png |
| 5 | Home | screen_5.png |
| 6 | Studio Step 1 (empty) | screen_6.png |
| 7 | Studio Step 1 (uploaded) | screen_7.png |
| 8 | Studio Step 2 (options) | screen_8.png |
| 9 | Studio Step 2 (models) | screen_9.png |
| 10 | Studio Step 2 (selected) | screen_10.png |
| 11 | Studio Step 3 (décor) | screen_11.png |
| 12 | Studio Step 4 (summary) | screen_12.png |
| 13 | Generation Result | screen_13.png |
| 14 | Products List | screen_14.png |
| 15 | Profile | screen_15.png |
