# app.medano.co — WhatsApp Review Request SaaS

## Qué es
SaaS para enviar solicitudes de reseñas vía WhatsApp Business API.
Clientes de DataTrackers conectan su WABA y lanzan campañas.

## Stack
- Frontend: Next.js (App Router)
- Backend: Next.js API Routes
- DB + Auth: Supabase
- WhatsApp: 360dialog Partner API
- Deploy: Netlify

## Variables de entorno necesarias
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DIALOG360_API_KEY=                      # Partner API key de 360dialog
NEXT_PUBLIC_DIALOG360_PARTNER_ID=       # Partner ID para armar la URL de OAuth
NEXT_PUBLIC_APP_URL=                    # URL base de la app (ej: https://app.medano.co)
NEXT_PUBLIC_WABA_MOCK=true              # Activar mock de WABA en desarrollo (omitir en prod)
DIALOG360_TEMPLATE_NAME=review_request  # Nombre del template aprobado en 360dialog
DIALOG360_TEMPLATE_NAMESPACE=           # Namespace del template (vacío si es Partner-level)

## Estado actual
- [x] Fase 0: Setup del proyecto
- [x] Fase 1: Login con Supabase Auth
- [x] Fase 2: Onboarding + WABA connect
- [x] Fase 3: Envío de solicitudes de reseña
- [x] Fase 4 (parte 1): Settings — review_link + ABM sucursales
- [ ] Fase 4 (parte 2): Historial de envíos
- [ ] Fase 5: Billing

## Decisiones tomadas
- Un WABA por cliente (aislamiento de reputación)
- Template aprobado a nivel Partner, no por cliente
- Pricing: Starter $49 / Growth $89 / Pro $149 + overage
- Auth con `@supabase/ssr` (no `auth-helpers-nextjs`, que está deprecated para App Router)
- Clientes Supabase: `createClient()` en `lib/supabase.ts` (browser) y `lib/supabase-server.ts` (server con cookies)
- Protección de rutas via `middleware.ts` (no client-side redirect)
- Server Components hacen el check de sesión con `supabase.auth.getUser()` (no `getSession()`)
- El check de org (onboarding completo) se hace en Server Components, no en el middleware
- Fase 3: envío unitario (un cliente a la vez), sin CSV — decisión de simplicidad
- Teléfonos argentinos: el usuario ingresa número local (ej: 1155441234), el sistema agrega 549 automáticamente
- Mock de envío: si `api_key` en `waba_connections` empieza con `mock_`, se omite la llamada a 360dialog y se loguea como 'sent'

## Arquitectura de auth (Fase 1)

```
app/
  page.tsx              → redirect('/login')
  login/page.tsx        → Server Component; si hay sesión → /dashboard
  dashboard/page.tsx    → Server Component; sin sesión → /login; sin org → /onboarding
components/
  auth-form.tsx         → Client Component, login/signup con email+password
  user-nav.tsx          → Client Component, muestra email + botón logout
lib/
  supabase.ts           → createBrowserClient (para Client Components)
  supabase-server.ts    → createServerClient con cookies (para Server Components)
middleware.ts           → protege /dashboard/* y /onboarding/*; redirige /login si ya autenticado
```

## Arquitectura de onboarding (Fase 2)

```
app/
  onboarding/
    page.tsx            → Server Component; si ya tiene org → /dashboard
    callback/page.tsx   → Server Component; recibe client_id de 360dialog → /dashboard
  api/onboarding/
    create-org/route.ts       → POST: crea organización en Supabase
    connect-waba/route.ts     → POST: llama a 360dialog Partner API, guarda waba_connection
    connect-waba-mock/route.ts → POST: guarda datos mock (solo dev, 403 en prod)
components/
  onboarding-wizard.tsx → Client Component, wizard 2 pasos (nombre org + conectar WABA)
supabase/migrations/
  20260329000000_fase2_organizations_waba.sql
```

## Arquitectura de envío (Fase 3)

```
app/
  dashboard/page.tsx    → muestra SendReviewForm; aviso si falta review_link
  api/messages/
    send/route.ts       → POST: valida, formatea teléfono, llama a 360dialog (o mock), guarda en message_logs
components/
  send-review-form.tsx  → Client Component: nombre + teléfono + botón enviar
supabase/migrations/
  20260329000001_fase3_message_logs.sql  → ALTER organizations ADD review_link + CREATE message_logs
```

### Template de reseña
```
"Hola {{1}}, gracias por tu visita a {{2}} 🙌 ¿Cómo estuvo? Si la pasaste bien,
nos ayudaría mucho que lo cuentes acá: {{3}} — ¡Muchas gracias!"
```
- `{{1}}` = customer_name
- `{{2}}` = org.name
- `{{3}}` = org.review_link

## Arquitectura de settings (Fase 4 parte 1)

```
app/
  dashboard/
    page.tsx              → header con link "Ajustes"; aviso amber con link a /dashboard/settings si falta review_link
    settings/page.tsx     → Server Component; carga org + locations; ← Volver al dashboard
  api/settings/
    org/route.ts          → PATCH: actualiza review_link de la org
    locations/route.ts    → POST: crea sucursal
    locations/[id]/route.ts → PATCH: edita sucursal / DELETE: elimina sucursal
components/
  org-review-link-form.tsx  → Client Component: input URL + botón guardar
  locations-manager.tsx     → Client Component: lista con edición inline + agregar/eliminar
supabase/migrations/
  20260329000002_fase4_locations.sql → CREATE locations con RLS
```

### Schema de DB completo
- `organizations`: `id`, `name`, `owner_id`, `review_link`, `created_at`
- `waba_connections`: `id`, `org_id`, `channel_id`, `api_key`, `status`, `created_at`
- `message_logs`: `id`, `org_id`, `customer_name`, `phone`, `status`, `error`, `created_at`
- `locations`: `id`, `org_id`, `name`, `review_link`, `created_at`

## Próxima sesión: Fase 4 (parte 2) — Historial de envíos

1. **`/dashboard/historial`**: tabla paginada con los envíos (customer_name, phone, status, created_at)
2. Link desde el header del dashboard a `/dashboard/historial`
