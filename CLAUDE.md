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
DIALOG360_API_KEY=

## Estado actual
- [x] Fase 0: Setup del proyecto
- [ ] Fase 1: Onboarding + WABA connect
- [ ] Fase 2: Creador de campañas
- [ ] Fase 3: Dashboard + Webhooks
- [ ] Fase 4: Billing

## Decisiones tomadas
- Un WABA por cliente (aislamiento de reputación)
- Template aprobado a nivel Partner, no por cliente
- Pricing: Starter $49 / Growth $89 / Pro $149 + overage