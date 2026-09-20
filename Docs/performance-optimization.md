# Performance Optimization - Leave-NPW System

## Database Optimizations

### Indexes (All Implemented ✅)
```prisma
// Teachers
@@index([citizenId])
@@index([isActive])

// HR Users
@@index([username])
@@index([isActive])

// Leaves
@@index([teacherId])
@@index([status])
@@index([startDate, endDate])
@@index([createdAt])
@@index([submittedByHrId])
@@unique([fiscalYear, runningNo])

// Leave Days
@@index([leaveId])
@@index([date])

// Attachments
@@index([leaveId])

// Holidays
@@index([year])
@@index([date])

// Signatories
@@index([role, isActive])

// Audit Logs
@@index([userId])
@@index([action])
@@index([resource])
@@index([createdAt])

// Notification Queue
@@index([status])
@@index([createdAt])
```

### Query Optimization Patterns

#### ✅ Use `select` to limit fields
```typescript
// Good
const teacher = await prisma.teacher.findUnique({
  where: { id },
  select: {
    id: true,
    firstName: true,
    lastName: true,
  }
});

// Bad - fetches all fields
const teacher = await prisma.teacher.findUnique({
  where: { id }
});
```

#### ✅ Avoid N+1 queries with `include`
```typescript
// Good - single query with join
const leaves = await prisma.leave.findMany({
  include: {
    teacher: { select: { firstName: true, lastName: true } },
    attachments: true,
  }
});

// Bad - N queries for teachers
const leaves = await prisma.leave.findMany();
for (const leave of leaves) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: leave.teacherId }
  });
}
```

#### ✅ Pagination for large lists
```typescript
const leaves = await prisma.leave.findMany({
  take: 50,
  skip: page * 50,
  orderBy: { createdAt: 'desc' },
});
```

#### ✅ Count vs findMany for totals
```typescript
// Good - single count query
const total = await prisma.leave.count({
  where: { status: 'pending' }
});

// Bad - fetch all then count
const leaves = await prisma.leave.findMany({
  where: { status: 'pending' }
});
const total = leaves.length;
```

### Connection Pooling (Neon Free Tier)

**Configuration:**
```env
# Pooled connection (for API routes)
DATABASE_URL="postgresql://...?pgbouncer=true&connect_timeout=15"

# Direct connection (for migrations only)
DIRECT_URL="postgresql://..."
```

**Neon Settings:**
- Max CU: 0.5 (to stay within 100 CU-hours/month)
- Autosuspend: 5 minutes (acceptable cold start ~500ms)
- Branch strategy: `dev` for development, `main` for production

**Prisma Client Singleton:**
```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

## Frontend Optimizations

### Code Splitting
- ✅ Next.js App Router automatic code splitting
- ✅ Dynamic imports for heavy components (charts, PDF viewer)
- ✅ Route-based splitting (teacher vs HR routes)

### Image Optimization
- ✅ next/image with automatic WebP/AVIF conversion
- ✅ Responsive sizes: [375, 640, 768, 1024, 1280]
- ✅ Client-side compression before upload (≤2MB)
- ✅ Lazy loading with loading="lazy"

### Font Loading
- ✅ Self-hosted fonts (no Google Fonts CDN)
- ✅ LINE Seed Sans TH / IBM Plex Sans Thai
- ✅ Font subsetting (Thai + Latin only)
- ✅ font-display: swap
- ✅ Preload critical fonts

### Bundle Size Optimization
- ✅ Tree-shaking enabled (Next.js default)
- ✅ lucide-react (individual icon imports)
- ✅ date-fns (individual function imports)
- ✅ Dynamic imports for heavy libraries:
  - Puppeteer (PDF route only)
  - SheetJS (export routes only)
  - Framer Motion (lazy load animations)

### Caching Strategy

**Service Worker (PWA):**
```typescript
// Cache Strategy
- App shell: CacheFirst (HTML, CSS, JS, fonts)
- API requests: NetworkFirst (fallback to cache)
- Images: CacheFirst (max 50 items, 30-day expiry)
- Never cache: sensitive data (leaves, personal info)
```

**HTTP Caching:**
```
/api/public/summary - Cache 60 seconds (s-maxage=60)
/fonts/* - Cache 1 year (immutable)
/*.svg - Cache 1 year (immutable)
/api/hr/* - No cache (private data)
/api/teacher/* - No cache (private data)
```

### React Performance
- ✅ Use React.memo for expensive components
- ✅ useMemo for expensive computations
- ✅ useCallback for stable function references
- ✅ Virtual scrolling for long lists (100+ items)
- ✅ Debounce search inputs (300ms)
- ✅ Throttle scroll handlers (100ms)

## API Route Optimizations

### Response Compression
- ✅ Next.js compression enabled
- ✅ Gzip for text responses
- ✅ Streaming for large responses (Excel exports)

### Serverless Function Config

**Standard Routes (most APIs):**
```typescript
// No special config needed
// Default: 10s timeout, 1024MB memory
```

**PDF Generation Route:**
```typescript
export const maxDuration = 60; // Max serverless timeout
export const runtime = 'nodejs'; // Required for Puppeteer
```

**Cold Start Mitigation:**
- Keep functions warm with periodic health checks (not implemented - costs compute)
- Import Puppeteer only in PDF route (not in shared code)
- Lazy load heavy dependencies

### Rate Limiting
- ✅ Auth endpoints: 5 attempts, 15-minute lockout
- ✅ Key: type:identifier:ip (prevents NAT collision)
- ✅ In-memory store (acceptable for Hobby plan)
- For higher scale: Use Vercel KV or Upstash Redis

## Mobile Performance

### Target Metrics
- First Contentful Paint (FCP): < 1.5s
- Largest Contentful Paint (LCP): < 2.5s
- Time to Interactive (TTI): < 3.5s
- Cumulative Layout Shift (CLS): < 0.1
- First Input Delay (FID): < 100ms

### Mobile-Specific Optimizations
- ✅ 375px viewport (iPhone SE baseline)
- ✅ Touch target size ≥ 44×44px
- ✅ Skeleton loading (no spinners)
- ✅ Optimistic UI updates
- ✅ Haptic feedback (10ms vibration)
- ✅ Pull-to-refresh
- ✅ Offline fallback page
- ✅ Install prompt (after 2nd visit)

### Network Efficiency
- ✅ Minimize API calls (batch where possible)
- ✅ Prefetch next page on link hover (desktop)
- ✅ Preload critical resources
- ✅ Lazy load below-the-fold content

## Monitoring & Profiling

### Vercel Analytics (Built-in)
- Real User Monitoring (RUM)
- Core Web Vitals
- Page load times
- API response times

### Manual Testing Checklist
```bash
# Lighthouse CI (run before deploy)
npm run build
npm run start
npx lighthouse http://localhost:3000 --view

# Target scores:
# Performance: ≥ 90
# Accessibility: ≥ 90
# Best Practices: ≥ 90
# SEO: ≥ 90
# PWA: Installable ✓
```

### Performance Budget
- Initial JS bundle: < 200KB gzipped
- Initial CSS: < 50KB gzipped
- Total page size (first load): < 500KB
- API response time: < 500ms (p95)
- Database query time: < 100ms (p95)

## Query Performance Monitoring

### Slow Query Identification
```typescript
// Enable query logging in development
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
  ],
});

prisma.$on('query', (e) => {
  if (e.duration > 100) {
    console.warn('Slow query detected:', {
      query: e.query,
      duration: e.duration + 'ms',
    });
  }
});
```

### Common Slow Query Fixes
1. Missing index → Add index to schema
2. N+1 queries → Use `include` or nested `select`
3. Fetching all fields → Use `select` to limit fields
4. Large result sets → Add pagination
5. Unoptimized joins → Review relation strategy

## Vercel Deployment Optimizations

### Build Optimization
```json
// package.json
{
  "scripts": {
    "build": "next build",
    "postbuild": "next-sitemap" // Generate sitemap
  }
}
```

### Environment-Specific Settings
```
Development:
- Verbose logging
- Source maps enabled
- No caching

Production:
- Error-level logging only
- Minification enabled
- Aggressive caching
- Compression enabled
```

## Free Tier Limits & Workarounds

### Vercel Hobby
| Resource | Limit | Strategy |
|----------|-------|----------|
| Function duration | 10s default | PDF route: 60s max |
| Function memory | 1024MB | Import heap size for Puppeteer |
| Bandwidth | 100GB/month | Compress responses, cache static assets |
| Cron jobs | 1/day only | Single daily summary (01:00 UTC) |
| Build time | 45 min | Optimize dependencies, cache layers |

### Neon Free
| Resource | Limit | Strategy |
|----------|-------|----------|
| Compute | 100 CU-hours | Max 0.5 CU, 5-min autosuspend |
| Storage | 512 MB | Archive old data if needed |
| Branches | 10 | dev + main only |
| Cold start | ~500ms | Show skeleton loading |

### Vercel Blob
| Resource | Limit | Strategy |
|----------|-------|----------|
| Storage | 1 GB | Compress images ≤2MB, 5 files/leave, monitor usage |
| Bandwidth | 100 GB/month | Signed URLs (15-min expiry), no public access |

## Future Optimizations (Beyond Free Tier)

### When to Upgrade
- Monthly active users > 100
- Blob storage > 700 MB consistently
- Need for background jobs / queue
- Need for faster compute (>0.5 CU)
- Need for multiple daily cron jobs

### Pro Tier Benefits
- Longer function duration (up to 5 minutes)
- More compute units (faster cold starts)
- Multiple cron jobs per day
- Background job support
- Analytics Pro (detailed metrics)

## Performance Testing Results

### Lighthouse Scores (Target)
```
Performance:      90+ ✓
Accessibility:    90+ ✓
Best Practices:   90+ ✓
SEO:             90+ ✓
PWA:             Installable ✓
```

### API Response Times (Target)
```
GET  /api/public/summary          < 300ms (cached 60s)
POST /api/auth/teacher/verify     < 500ms
POST /api/teacher/leaves/submit   < 1000ms
GET  /api/hr/dashboard/summary    < 500ms
POST /api/hr/approvals/[id]/approve < 300ms
GET  /api/hr/leaves/[id]/pdf      < 6000ms (Puppeteer cold start)
```

### Database Query Times (Target)
```
Simple select by ID:              < 50ms
List with pagination:             < 100ms
Complex aggregation (reports):    < 500ms
Leave submission (transaction):   < 200ms
```

## Checklist Before Production

- [ ] Run Lighthouse audit (all pages > 90)
- [ ] Test on 3G network (throttled)
- [ ] Test on iPhone SE (375px, iOS Safari)
- [ ] Test on Android (Chrome, Firefox)
- [ ] Verify all images < 2MB after compression
- [ ] Check bundle size (< 200KB gzipped)
- [ ] Enable Vercel Analytics
- [ ] Set up error tracking (Sentry/LogRocket)
- [ ] Configure database backups
- [ ] Test cold start performance (PDF generation)
- [ ] Verify PWA installable on mobile
- [ ] Test offline mode (service worker)
