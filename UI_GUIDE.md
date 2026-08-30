# UI Guide — Aaraksha

> Read this before building any React component, hook, page, or styling rule.
> Updated to match reference design system: Image 1 (Govt Dashboard) + Image 2 (Tourist PWA).

---

## PORTAL OVERVIEW

| Portal | Path | Theme | Audience |
|--------|------|-------|----------|
| Tourist PWA | `frontend/tourist/` | White + amber, mobile-first, premium | Tourists |
| Govt Dashboard | `frontend/govt/` | Emerald-50 light, desktop-first, data-dense | Government officials |
| Guardian Portal | `frontend/guardian/` | White, status-driven, public | Family / friends |
| Rescuer App | `frontend/volunteer/` | White + teal, mobile-first, dispatch-focused | Verified volunteers / official rescue teams |

---

## SHARED DESIGN SYSTEM

### Typography Scale

Font family: Inter (primary) — import via Google Fonts or Fontsource
Fallback: system-ui, -apple-system, sans-serif

Scale:
display: text-5xl font-black tracking-tight line-height-tight
h1: text-4xl font-extrabold tracking-tight
h2: text-2xl font-bold tracking-tight
h3: text-xl font-semibold
h4: text-base font-semibold
body: text-sm font-normal
caption: text-xs font-normal text-muted
label: text-xs font-semibold uppercase tracking-widest ← CRITICAL
Used for all stat card labels. Always uppercase + tracking-widest.


### Spacing

Page padding: px-6 py-6 (mobile: px-4)
Card padding: p-5 (stat cards) | p-6 (content cards)
Section gap: gap-6 (between cards in a grid)
Item gap: gap-3 (within a card, between list items)


### Border Radius

Cards: rounded-xl (12px)
Modals: rounded-2xl (16px)
Buttons: rounded-full (pill) for primary actions
rounded-lg for secondary/icon buttons
Inputs: rounded-lg
Badges/pills: rounded-full
Stat sparkline area: rounded-lg
Maps: rounded-xl overflow-hidden


### Shadow & Elevation

Level 0 (flat): shadow-none — inline elements, table rows
Level 1 (resting): shadow-sm — stat cards, menu items
Level 2 (raised): shadow-md — content cards, dropdowns
Level 3 (overlay): shadow-lg — modals, popovers
Level 4 (urgent): shadow-xl — SOS alerts, critical panels
Ring (focus/active): ring-2 ring-offset-2 ring-{color}-400


### Transitions & Animation

Standard: transition-all duration-200 ease-out
Slow reveal: transition-all duration-300 ease-out
SOS pulse: animate-pulse (on all active SOS elements)
SOS ping: animate-ping (ring element behind SOS badge in govt view)
Map pin: animate-bounce (on newly arrived SOS pin, 3 cycles then stop)
Skeleton: animate-pulse bg-slate-200 (loading states)
Chart entry: No animation in Recharts — use isAnimationActive={false} for demo stability


---

## TOURIST PWA — DESIGN TOKENS

Reference: Image 2 quality standard — premium, clean, bold typography, elevated cards.

### Color Tokens

Background: 
#ffffff (white)
Page surface: slate-50 (
#f8fafc) — used behind card grids only
Card: 
#ffffff border: slate-200 shadow-md rounded-xl
Primary: amber-500 (
#f59e0b)
Primary dark: amber-600 (
#d97706) ← hover state
Primary darkest: 
#0f172a (slate-950) ← used for CTA buttons like Image 2

Text primary: slate-900 (
#0f172a)
Text secondary: slate-500 (
#64748b)
Text muted: slate-400 (
#94a3b8)

SOS active: red-500 (
#ef4444) animate-pulse on anything SOS-active
SOS bg: red-50 border: red-200
Safe: green-500 (
#22c55e)
Safe bg: green-50 border: green-200

TSI badge:
≥ 80 → bg-green-50 text-green-700 border border-green-200 (Low Risk)
60–79 → bg-yellow-50 text-yellow-700 border border-yellow-200 (Moderate Risk)
40–59 → bg-orange-50 text-orange-700 border border-orange-200 (High Risk)
< 40 → bg-red-50 text-red-700 border border-red-200 (Extreme Risk)

Floating pill badges (like Image 2 feature tags):
bg-slate-900/90 text-white rounded-full px-4 py-2 text-sm font-medium
shadow-lg backdrop-blur-sm

Feature badges (inline):
bg-slate-100 text-slate-700 rounded-full px-3 py-1 text-xs font-medium


### Tourist PWA Visual Patterns

**Hero / Dashboard header** (inspired by Image 2 bold typography):
```tsx
// Dashboard.tsx — top hero section
<div className="bg-white px-6 pt-8 pb-6">
  <div className="mb-1">
    <span className="text-xs font-semibold uppercase tracking-widest text-amber-500">
      Smart Tourism
    </span>
  </div>
  <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
    Your Journey,<br />
    <span className="text-amber-500">Protected.</span>
  </h1>
</div>
```

**Stat pill badge** (for TSI score, battery, readiness %):
```tsx
// Quick number + label + trend in one pill
<div className="flex items-center gap-1.5 bg-white border border-slate-200 
                rounded-full px-3 py-1.5 shadow-sm">
  <span className="text-sm font-bold text-slate-900">82</span>
  <span className="text-xs text-slate-400">/100</span>
  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
</div>
```

**Feature card with floating label** (like Image 2 verified listing badges):
```tsx
<div className="relative rounded-xl overflow-hidden shadow-md">
  {/* image or map */}
  <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-sm
                  text-white text-xs font-medium rounded-full px-3 py-1.5">
    🛡 TSI: Low Risk
  </div>
</div>
```

**Primary CTA button** (dark pill, like Image 2):
```tsx
<Button className="w-full bg-slate-900 hover:bg-slate-800 text-white 
                   rounded-full h-12 text-sm font-semibold shadow-md
                   transition-all duration-200">
  Start Safe Journey →
</Button>
```

**Search bar** (like Image 2 bottom search):
```tsx
// Multi-segment search pill
<div className="flex items-center bg-white rounded-full shadow-lg border 
                border-slate-200 p-1 gap-1">
  <div className="flex-1 px-4 py-2 text-sm text-slate-700 border-r border-slate-200">
    📍 Destination
  </div>
  <div className="flex-1 px-4 py-2 text-sm text-slate-700 border-r border-slate-200">
    📅 Dates
  </div>
  <button className="bg-amber-500 hover:bg-amber-600 text-white rounded-full 
                     px-5 py-2 text-sm font-semibold">
    Search
  </button>
</div>
```

**Trust badges row** (like Image 2 bottom strip):
```tsx
<div className="flex items-center justify-around py-4 border-t border-slate-100">
  {[
    { icon: '🛡', text: 'Govt Verified' },
    { icon: '📡', text: 'Offline SOS' },
    { icon: '👁', text: 'Live Tracking' },
  ].map(item => (
    <div key={item.text} className="flex items-center gap-2 text-xs text-slate-500">
      <span>{item.icon}</span>
      <span className="font-medium">{item.text}</span>
    </div>
  ))}
</div>
```

### 12 Tourist Pages

| Page | Route | Key Components |
|------|-------|---------------|
| Auth | `/auth` | Premium card layout, amber gradient top strip |
| Dashboard | `/` | Hero header, TSIBadge, ActiveTripCard, DMSCard, SOSButton, trust strip |
| Create Trip | `/trips/new` | Multi-step form with step indicator, destination picker |
| Itinerary | `/trips/:id` | Stop list, embedded map, TSI breakdown card |
| Travel Advisory | `/advisory` | TSI score ring, factor list, recommendations |
| Budget | `/trips/:id/budget` | Category cards, Recharts donut, over-budget alert |
| Packing | `/trips/:id/packing` | AI badge, grouped checklist, offline indicator |
| Notes | `/trips/:id/notes` | Clean textarea, offline sync dot |
| SOS | `/sos` | Full-page SOS — large pulsing button, GPS accuracy ring |
| Check-in | `/checkin` | Battery widget, GPS dot, DMS reset countdown |
| Community | `/community` | Scam report cards, destination filter pills |
| Profile | `/profile` | Avatar, govt ID suffix badge, guardian link copy |

---

## GOVERNMENT DASHBOARD — DESIGN TOKENS

Reference: Image 1 exactly — light mint/emerald theme, clean analytics, stat cards with sparklines.

⚠ This is a LIGHT theme. NOT dark slate. Old slate-900 tokens are deleted.

### Color Tokens

Page background: 
#f0fdf4 (emerald-50) — the mint green from Image 1
Card background: 
#ffffff shadow-sm rounded-xl border: none
Primary: emerald-600 (
#059669)
Primary dark: 
#064e3b (emerald-950) — dark green CTA buttons (Export PDF etc.)
Primary light: emerald-100 (
#d1fae5) — icon backgrounds in stat cards

Text primary: slate-900 (
#0f172a)
Text secondary: slate-600 (
#475569)
Text muted: slate-400 (
#94a3b8)
Label text: slate-500 text-xs uppercase tracking-widest ← always this for stat labels

SOS active: red-500 (
#ef4444) — red retains contrast on light bg
SOS ping ring: red-400/50 animate-ping
SOS resolved: emerald-600
SOS warning: amber-500
SOS card border-l: border-l-4 border-red-500 (active) | border-emerald-500 (resolved)

Toggle pills — like Image 1 Monthly/Weekly:
Active: bg-emerald-700 text-white rounded-full px-4 py-1.5 text-sm font-semibold
Inactive: text-slate-500 rounded-full px-4 py-1.5 text-sm font-medium hover:text-slate-900

Date range picker — like Image 1:
border border-slate-300 rounded-full px-4 py-2 text-sm text-slate-700
flex items-center gap-2 bg-white shadow-sm

Export button — Image 1 top right:
bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg px-4 py-2
text-sm font-semibold flex items-center gap-2 shadow-sm

Map markers (Leaflet custom icons):
Tourist pin: emerald-500 circle (12px) with white center dot
SOS pin: red-500 circle (16px) with animate-ping ring, white SOS label
Rescue team: amber-500 circle (12px) with team type icon
Hospital: slate-600 circle (10px) with ➕ inside


### Stat Card Pattern (exact from Image 1)

Each of the 4 top stat cards follows this exact structure:

```tsx
// components/StatCard.tsx
interface StatCardProps {
  label: string        // "TOTAL SOS ALERTS" — rendered uppercase, tracking-widest
  value: string | number
  trend?: string       // "+12%" green | "-3%" red
  trendUp?: boolean
  subLabel?: string    // "System Health" | "Live Monitoring"
  icon: React.ReactNode
  sparklineData?: number[]   // ~10 data points for mini chart
  accentColor?: string       // emerald | red | amber
}

export const StatCard = ({ label, value, trend, trendUp, subLabel, icon, sparklineData, accentColor = 'emerald' }: StatCardProps) => (
  <div className="bg-white rounded-xl p-5 shadow-sm flex flex-col gap-3">
    <div className="flex items-start justify-between">
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center",
        `bg-${accentColor}-100 text-${accentColor}-600`
      )}>
        {icon}
      </div>
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </span>
    </div>
    <div>
      <div className="text-3xl font-black text-slate-900">{value}</div>
      {subLabel && (
        <div className={cn("text-xs font-semibold mt-0.5", `text-${accentColor}-600`)}>
          {subLabel}
        </div>
      )}
    </div>
    <div className="flex items-end justify-between">
      {trend && (
        <span className={cn("text-xs font-semibold flex items-center gap-1",
          trendUp ? "text-red-500" : "text-emerald-500"
        )}>
          {trendUp ? "↑" : "↓"} {trend}
        </span>
      )}
      {sparklineData && (
        <ResponsiveContainer width={100} height={36}>
          <AreaChart data={sparklineData.map(v => ({ v }))}>
            <Area
              type="monotone"
              dataKey="v"
              stroke={trendUp ? '#ef4444' : '#10b981'}
              fill={trendUp ? '#fef2f2' : '#d1fae5'}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  </div>
)
```

### Chart Styling (Image 1 reference)

**Area chart — SOS Incidents Over Time:**
```tsx
// Exact styling from Image 1
<AreaChart data={data}>
  <defs>
    <linearGradient id="sosGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3}/>
      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02}/>
    </linearGradient>
  </defs>
  <XAxis
    dataKey="month"
    tick={{ fontSize: 11, fill: '#94a3b8' }}
    axisLine={false}
    tickLine={false}
  />
  <YAxis hide />
  <Tooltip
    contentStyle={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      fontSize: '12px',
    }}
  />
  <Area
    type="monotoneX"
    dataKey="count"
    stroke="#10b981"
    strokeWidth={2.5}
    fill="url(#sosGradient)"
    dot={false}
    isAnimationActive={false}
  />
</AreaChart>
```

**Donut chart — Emergency Types (Image 1 right panel):**
```tsx
<PieChart>
  <Pie
    data={data}
    cx="50%"
    cy="50%"
    innerRadius={70}
    outerRadius={100}
    paddingAngle={2}
    dataKey="value"
    isAnimationActive={false}
  >
    {/* Colors: Medical=#10b981  Lost=#475569  Crime=#ef4444  Other=#e2e8f0 */}
  </Pie>
</PieChart>
// Center label: total count + "TOTAL" in small-caps below
```

### 5 Govt Pages

| Page | Route | Key Components |
|------|-------|---------------|
| Dashboard | `/` | 4 StatCards top row, Risk Overview panel, active SOS list |
| Live Map | `/map` | react-leaflet on emerald-50 bg, custom markers, zoom controls |
| SOS Management | `/sos` | SOSCard list (border-l-4 color-coded), RescueModal, status filter pills |
| Risk Overview | `/risk` | District table, TSI per destination, weather alerts, overdue count |
| Analytics | `/analytics` | Image 1 exactly — area chart + donut, date range, Monthly/Weekly toggle |

---

## GUARDIAN PORTAL — DESIGN TOKENS

Background: 
#ffffff
Font: Inter, same scale as Tourist PWA

Status banner occupies full width, min-h: [25vh on mobile, 140px on desktop]:

SAFE: bg-green-50 border-b-4 border-green-500
Headline: "✅ Aryan is safe" text-green-800 font-black text-2xl

WARNING: bg-amber-50 border-b-4 border-amber-500
Headline: "⏰ Check-in due soon" text-amber-800 font-black text-2xl

SOS ACTIVE: bg-red-500 text-white
Headline: "🆘 SOS ACTIVE" text-white font-black text-3xl animate-pulse
Subline: "Emergency services notified" text-red-100 text-sm

NO SIGNAL: bg-slate-100 border-b-4 border-slate-300
Headline: "📵 No signal" text-slate-600 font-black text-2xl

Below status banner:

Map (react-leaflet, 40vh, rounded-xl overflow-hidden)
Timeline (vertical list, check-in events, SOS events in red)
ETA card (white, shadow-sm, rounded-xl)
Battery indicator (progress bar, amber < 20%)

---

## COMPONENT COMPOSITION RULES

```tsx
// Rule: shadcn/ui base → custom wrapper → page composition
// Never modify shadcn source files in components/ui/
// Always wrap in a named component in components/
// Use cn() from '@/lib/utils' for conditional Tailwind

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface SOSButtonProps {
  onTrigger: () => void
  isActive?: boolean
  disabled?: boolean
}

export const SOSButton = ({ onTrigger, isActive, disabled }: SOSButtonProps) => (
  <Button
    variant="destructive"
    size="lg"
    disabled={disabled}
    className={cn(
      'w-full h-20 text-xl font-black tracking-wide rounded-2xl shadow-lg',
      isActive && 'animate-pulse ring-4 ring-red-300 ring-offset-2'
    )}
    onClick={onTrigger}
  >
    🆘 SEND SOS
  </Button>
)
```

---

## OFFLINE SOS HOOK (CRITICAL PATH)

```ts
// hooks/useSOS.ts — do not simplify this flow

const EMERGENCY_NUMBERS = import.meta.env.VITE_EMERGENCY_NUMBERS // comma-separated

export const useSOS = () => {
  const { tourist } = useAuthStore()
  const { mutateAsync: triggerSOSApi } = useMutation({ mutationFn: sosApi.triggerSOS })

  const sendSOS = async (category: SOSCategory, message?: string) => {
    // Step 1: Get GPS (satellite — works without internet)
    const position = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 300000,
      })
    ).catch(() => getFallbackPosition()) // reads last known from Dexie

    const { latitude, longitude } = position.coords
    const battery = await getBatteryPct() // navigator.getBattery()

    // Step 2: Online vs Offline branch
    if (navigator.onLine) {
      await triggerSOSApi({ category, latitude, longitude, message, battery })
    } else {
      // Offline: SMS URI (opens native SMS app with pre-filled body)
      const body = [
        'AARAKSHA_SOS',
        `ID:${tourist.id}`,
        `LAT:${latitude}`,
        `LNG:${longitude}`,
        `CAT:${category}`,
        `BATT:${battery}`,
        `TIME:${Math.floor(Date.now() / 1000)}`,
      ].join('|')

      window.location.href = `sms:${EMERGENCY_NUMBERS}?body=${encodeURIComponent(body)}`

      // Step 3: Queue for Background Sync when connectivity returns
      await db.offlineSOSQueue.add({
        category, latitude, longitude, message, battery,
        timestamp: Date.now(), synced: false
      })
    }
  }

  return { sendSOS }
}
```

---

## STATE MANAGEMENT — WHERE EACH STATE LIVES

| State | Where | Example |
|-------|-------|--------|
| JWT token, tourist profile | `auth.store.ts` (Zustand) | `useAuthStore().tourist` |
| Active trip ID | `trip.store.ts` (Zustand) | `useTripStore().activeTripId` |
| SOS active flag | `safety.store.ts` (Zustand) | `useSafetyStore().activeSOSId` |
| Trips list, trip detail | TanStack Query | `useQuery({ queryKey: ['trips'] })` |
| Form (create trip, check-in) | React Hook Form | `useForm<CreateTripSchema>()` |
| Modal open/close, tab index | useState | `const [open, setOpen] = useState(false)` |
| Offline data | Dexie.js | `db.offlineSOSQueue`, `db.touristLocations` |

**Rule:** Server responses go into TanStack Query cache, never into Zustand.

---

## DEXIE.JS SCHEMA

```ts
// lib/db.ts
import Dexie, { Table } from 'dexie'

export interface OfflineSOSItem {
  id?: number
  category: string
  latitude: number
  longitude: number
  message?: string
  battery: number
  timestamp: number
  synced: boolean
}

class AarakshDB extends Dexie {
  offlineSOSQueue!: Table<OfflineSOSItem>
  touristLocations!: Table<{ touristId: string; latitude: number; longitude: number; updatedAt: number }>
  cachedTrips!: Table<{ id: string; data: unknown; updatedAt: number }>

  constructor() {
    super('aaraksha')
    this.version(1).stores({
      offlineSOSQueue: '++id, timestamp, synced',
      touristLocations: 'touristId, updatedAt',
      cachedTrips: 'id, updatedAt',
    })
  }
}

export const db = new AarakshDB()
```

---

## UI COMPONENT LIBRARY PRIORITIES

Use in this strict order:

1. **shadcn/ui** — all base elements (Button, Card, Dialog, Input, Badge, Sheet, Tabs, Toast)
2. **Aceternity UI** — animated cards, hero sections (copy source, don't install package)
3. **Magic UI** — impressive visual moments for demo (copy source)
4. **Recharts** — all charts (budget breakdown, analytics, TSI history, stat sparklines)
5. **react-leaflet** — all maps

**Do not install:** Chakra UI, MUI, Ant Design, Bootstrap, Framer Motion (unless already a shadcn dep).

---

## ANTI-PATTERNS — FRONTEND

| Pattern | Instead |
|---------|--------|
| `localStorage.setItem(...)` | Dexie.js IndexedDB |
| `sessionStorage.setItem(...)` | Zustand (in-memory) |
| API call inside component body | `src/api/{domain}.api.ts` + TanStack Query |
| Direct DOM manipulation | React state / refs |
| Inline `style={{}}` | Tailwind classes only |
| Modifying `components/ui/` files | Wrap in a named component |
| Redux / useReducer for server state | TanStack Query |
| `useEffect` for data fetching | TanStack Query `useQuery` |
| Class-based components | Functional + hooks only |
| `isAnimationActive` default in Recharts | Always set `isAnimationActive={false}` in demo — prevents chart flash |
| Hard-coded hex colors in className | Use Tailwind palette tokens only |
| Dark background on Govt Dashboard | Emerald-50 light theme only — dark is removed |