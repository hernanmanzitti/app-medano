# app.medano.co — WhatsApp Review Request SaaS

## Qué es
SaaS B2B para enviar solicitudes de reseñas vía WhatsApp Business API.
Clientes conectan su WABA (vía Twilio) y lanzan solicitudes de reseña desde el dashboard o por bot de WhatsApp.

## Stack
- Frontend: Next.js (App Router)
- Backend: Next.js API Routes + Supabase Edge Functions
- DB + Auth: Supabase
- WhatsApp: Twilio (subaccount + número dedicado por cliente)
- Deploy: Netlify
- Fechas: date-fns con locale `es`

## Variables de entorno necesarias
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=                    # URL base de la app (ej: https://app.medano.co)
NEXT_PUBLIC_WABA_MOCK=true              # Activar mock de WABA en desarrollo (omitir en prod)

# Twilio
TWILIO_ACCOUNT_SID=                     # Master account SID
TWILIO_AUTH_TOKEN=                      # Master auth token
TWILIO_TEMPLATE_SID=                    # SID del template aprobado en Twilio
TWILIO_BOT_NUMBER=                      # Número Twilio del bot (compartido entre todos los clientes)
```

## Estado actual
- [x] Fase 0: Setup del proyecto
- [x] Fase 1: Login con Supabase Auth
- [x] Fase 2: Onboarding + WABA connect (mock — pendiente integración Twilio)
- [x] Fase 3: Envío de solicitudes de reseña (mock)
- [x] Fase 4 (parte 1): Settings — review_link + ABM sucursales
- [x] Fase 4 (parte 2): Historial de envíos en dashboard + dropdown de sucursal en formulario
- [x] Integración Twilio: send/route.ts implementado con Twilio API
- [x] Fix crítico: send/route.ts no guardaba wam_id al insertar en message_logs — ya corregido
- [x] Fase 5 (parte 1): webhook `POST /api/webhooks/twilio` — recibe eventos y actualiza message_logs (funciona una vez aplicado el fix del wam_id)
- [x] Deploy productivo en Netlify (appmedano.netlify.app) — netlify.toml + @netlify/plugin-nextjs + variables de entorno configuradas
- [x] Auth emails: fix de URLs localhost → NEXT_PUBLIC_APP_URL, ruta /auth/callback, recuperación de contraseña (/reset-password)
- [x] SMTP: Resend configurado en Supabase con dominio medano.co (sender: noreply@medano.co)
- [x] Variables de entorno Twilio cargadas en Netlify (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TEMPLATE_SID)
- [x] Template de reseña creado en Twilio Content Template Builder (pendiente aprobación Meta)
- [ ] Ticket de soporte abierto en Twilio para desbloquear subaccounts + long code numbers
- [ ] Integración Twilio: connect-waba/route.ts (crear subaccount + comprar número)
- [x] Fase 5 (parte 2): validación de firma Twilio en el webhook (X-Twilio-Signature)
- [ ] Fase 6: Onboarding wizard guiado (reemplaza el onboarding actual de 2 pasos)
- [x] Fase 7 (parte 1): API de envío múltiple — send/route.ts soporta batch via contacts[] (compatibilidad individual mantenida)
- [x] Fase 7 (parte 2): UI de envío múltiple — agregar contactos de a uno, lista previa, envío batch
- [x] Fase 7 (parte 3): Envíos programados — descartado para esta versión
- [ ] Fase 8: Opt-out / Blacklist
- [ ] Fase 9: Derivación de respuestas (reply forwarding)
- [ ] Fase 10: Estadísticas completas (KPIs, filtros, click tracking)
- [ ] Fase 11: Bot de WhatsApp (canal alternativo de envío)
- [ ] Fase 12: Panel Admin Medano (consumo + Become mode)
- [ ] Fase 13: Billing — prepago de créditos, corte automático por saldo

## Decisiones tomadas

### BSP y onboarding
- **BSP: Twilio**. Sin fee fijo mensual. $1.50/mes por número + $0.0668/msg.
- **Onboarding MVP — acceso socio en Business Manager**: el cliente agrega el BM de Medano como socio en su Meta Business Manager (business.facebook.com → Configuración → Socios). Medano accede al WABA del cliente y lo registra en un subaccount de Twilio. Sin Embedded Signup, sin Tech Provider Program.
- **Onboarding futuro — Embedded Signup automático**: cuando Medano complete el proceso de Tech Provider con Meta (4-8 semanas, iniciar en paralelo), el onboarding pasará a ser un flow embebido en la app.
- **Número dedicado por cliente**: Medano compra un número nuevo en Twilio ($1.50/mes) al onboardear cada cliente. El cliente no toca su WhatsApp personal ni de negocio.
- Un WABA por cliente (aislamiento de reputación y límites de envío)
- Template aprobado a nivel de cuenta Medano, no por cliente

### Pricing
- Starter: $13/mes — 100 mensajes
- Growth: $22/mes — 200 mensajes
- Pro: $48/mes — 500 mensajes + $0.12/msg extra a partir del msg 501
- Overflow: Starter se pasa → facturar Growth. Growth se pasa → facturar Pro.
- Pay-as-you-go: $1.50/mes fijo + $0.1168/msg ($0.0618 Meta + $0.005 Twilio + $0.05 Medano)

### Unit economics por plan
| Plan    | Msgs | Meta    | Twilio | Número | Costo total | Precio | Ganancia |
|---------|------|---------|--------|--------|-------------|--------|----------|
| Starter | 100  | $6.18   | $0.50  | $1.50  | $8.18       | $13    | $4.82    |
| Growth  | 200  | $12.36  | $1.00  | $1.50  | $14.86      | $22    | $7.14    |
| Pro     | 500  | $30.90  | $2.50  | $1.50  | $34.90      | $48    | $13.10   |

Infra compartida (~$50 Supabase + hosting) se divide entre clientes activos. Breakeven en ~5 clientes.

### Template
- Clasificado por Meta como **marketing** ($0.0618/msg en Argentina). No es reclasificable a utility.
- Aprobado. En uso. No cambiar sin re-aprobación.

### Técnicas
- Auth con `@supabase/ssr` (no `auth-helpers-nextjs`, deprecated para App Router)
- Clientes Supabase: `createClient()` en `lib/supabase.ts` (browser) y `lib/supabase-server.ts` (server con cookies)
- Protección de rutas via `middleware.ts` (no client-side redirect)
- Server Components hacen el check de sesión con `supabase.auth.getUser()` (no `getSession()`)
- El check de org (onboarding completo) se hace en Server Components, no en el middleware
- Teléfonos argentinos: usuario ingresa número local (ej: 1155441234), el sistema agrega 549 automáticamente
- Mock de envío: si `NEXT_PUBLIC_WABA_MOCK=true` o si `api_key` en `waba_connections` empieza con `mock_`, se omite la llamada al BSP y se loguea como 'sent'
- Sucursal opcional en el envío: si se selecciona, se usa su `review_link`; si no, se usa el de la org
- Historial embebido en el dashboard (últimos 20), no en una página separada

## Actores del sistema
| Actor           | Descripción                                          | Acceso                        |
|-----------------|------------------------------------------------------|-------------------------------|
| Cliente Medano  | Negocio que contrata el servicio (restaurante, clínica) | Panel SaaS en app.medano.co |
| Usuario final   | Cliente del negocio que recibe el WhatsApp           | No accede al SaaS             |
| Admin Medano    | Equipo interno de Medano Agency                      | Panel admin con permisos elevados |
| Superadmin      | Máximo nivel de permisos — puede operar como cualquier cliente | Panel admin + Become mode completo |
| Bot WhatsApp    | Canal alternativo de envío via chat con número Medano | WhatsApp externo             |

Roles en `profiles`: `client` | `admin` | `superadmin`

---

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

---

## Arquitectura de onboarding (Fase 2 actual → reemplazar con Wizard en Fase 6)

```
app/
  onboarding/
    page.tsx                   → Server Component; si ya tiene org → /dashboard
    callback/page.tsx          → Server Component; recibe datos de WABA → /dashboard
  api/onboarding/
    create-org/route.ts        → POST: crea organización en Supabase
    connect-waba/route.ts      → POST: registra WABA en Twilio subaccount, guarda waba_connection
                                        (pendiente implementación real — actualmente usa mock)
    connect-waba-mock/route.ts → POST: guarda datos mock (solo dev, 403 en prod)
components/
  onboarding-wizard.tsx → Client Component, wizard 2 pasos (nombre org + conectar WABA)
supabase/migrations/
  20260329000000_fase2_organizations_waba.sql
```

### Flujo de onboarding con Twilio (MVP — acceso socio BM)
1. Hernan agenda sesión con el cliente
2. Cliente agrega BM de Medano como socio en su Meta Business Manager
3. Hernan accede al WABA del cliente, crea subaccount Twilio, compra número, registra WABA
4. Hernan guarda `twilio_subaccount_sid` y `phone_number` en `waba_connections`
5. Cliente ya puede enviar desde el dashboard

---

## Módulo: Onboarding Wizard guiado (Fase 6 — pendiente)

Wizard paso a paso que reemplaza el onboarding actual de 2 pasos. Obligatorio en el primer login.

| Paso | Pantalla              | Acción requerida                                         |
|------|-----------------------|----------------------------------------------------------|
| 1    | Bienvenida            | Clic en 'Empezar'                                        |
| 2    | Datos de la org       | Nombre, logo (PNG/JPG), categoría                        |
| 3    | Conectar WhatsApp     | Instrucciones para agregar a Medano como socio en BM; Medano asigna número Twilio |
| 4    | Primera sucursal      | Nombre + link de reseña de Google                        |
| 5    | Mensaje de prueba     | Nombre + teléfono → envío de prueba al propio número     |
| 6    | Listo                 | Confirmación + acceso al dashboard                       |

Comportamiento:
- El wizard no se puede saltear
- Si el cliente cierra a mitad, retoma desde el último paso al volver
- El paso 3 puede quedar en estado 'pending' si Medano aún no asignó número. El cliente continúa al paso 4 y el wizard se marca como incompleto
- Barra de progreso visible en todos los pasos

Nuevo campo en `organizations`: `wizard_step INT DEFAULT 0` (0 = completo, 1-6 = paso actual)

---

## Arquitectura de envío + historial (Fases 3 y 4)

```
app/
  dashboard/page.tsx    → fetcha locations + message_logs en paralelo; formulario + historial
  api/messages/
    send/route.ts       → POST: valida, formatea teléfono, llama a Twilio WhatsApp API (o mock),
                          guarda en message_logs con location_id opcional
  api/webhooks/
    twilio/route.ts     → POST: recibe eventos de estado (delivered/read/failed) de Twilio,
                          actualiza status + wam_id en message_logs
  api/settings/
    org/route.ts              → PATCH: actualiza review_link + forwarding_number de la org
    locations/route.ts        → POST: crea sucursal
    locations/[id]/route.ts   → PATCH: edita / DELETE: elimina sucursal
  dashboard/settings/page.tsx → Server Component; carga org + locations
components/
  send-review-form.tsx      → nombre + teléfono + dropdown de sucursal + botón enviar
  message-logs-table.tsx    → tabla: cliente, teléfono, sucursal, fecha relativa, badge status
  org-review-link-form.tsx  → input URL + guardar
  locations-manager.tsx     → lista con edición inline + agregar/eliminar
supabase/migrations/
  20260329000001_fase3_message_logs.sql
  20260329000002_fase4_locations.sql
  20260329000003_message_logs_location_status.sql
  20260331000000_waba_twilio_columns.sql              → ADD twilio_subaccount_sid + phone_number
                                                        (pendiente: npx supabase db push)
```

### Template de reseña
```
"Hola {{1}}, gracias por tu visita a {{2}} 🙌 ¿Cómo estuvo? Si la pasaste bien,
nos ayudaría mucho que lo cuentes acá: {{3}} — ¡Muchas gracias!"
```
- `{{1}}` = customer_name
- `{{2}}` = org.name
- `{{3}}` = location.review_link (si se eligió sucursal) o org.review_link

### Ciclo de vida de un mensaje (status en message_logs)
`pending` → `sent` → `delivered` → `read` / `failed` / `blocked` / `reply_received` / `clicked`

---

## Módulo: Envío múltiple + programado (Fase 7 — pendiente)

**Flujo de carga múltiple:**
- El cliente carga un contacto y elige: enviar ya o agregar otro
- Se pueden agregar contactos de a uno hasta completar la lista
- Al terminar, se muestra resumen y se confirma el envío completo
- Todos los envíos se procesan en cola y se registran individualmente en `message_logs`

**Envíos programados:**
- Selector de fecha y hora con timezone del cliente
- Los envíos programados se listan en 'Envíos pendientes' con estado, fecha/hora y cantidad
- Se puede cancelar un envío programado mientras no haya comenzado

Nueva tabla: `scheduled_sends`
```sql
id UUID PRIMARY KEY
org_id UUID REFERENCES organizations
location_id UUID REFERENCES locations (nullable)
contacts JSONB  -- array de {customer_name, phone}
scheduled_at TIMESTAMPTZ
status TEXT DEFAULT 'pending'  -- pending | sent | cancelled
created_at TIMESTAMPTZ DEFAULT NOW()
```

---

## Módulo: Opt-out / Blacklist (Fase 8 — pendiente)

**Cómo se genera un opt-out:**
- Automático: el usuario final responde STOP, BAJA, NO GRACIAS → webhook de Twilio → registro automático
- Manual: el cliente agrega números desde el panel

**Panel de blacklist:**
- Tabla: número bloqueado, fecha, origen (automático / manual)
- Búsqueda por número
- Remover de blacklist (con confirmación)
- Exportar como CSV

**Comportamiento en envíos:**
- Antes de enviar, el sistema verifica si el número está en blacklist
- Si está bloqueado → el envío se cancela para ese contacto y se registra como `blocked`
- En envíos de lista → el resumen final muestra cuántos fueron omitidos por opt-out

Nueva tabla: `blacklist`
```sql
id UUID PRIMARY KEY
org_id UUID REFERENCES organizations
phone TEXT NOT NULL
origin TEXT DEFAULT 'manual'  -- manual | automatic
created_at TIMESTAMPTZ DEFAULT NOW()
UNIQUE (org_id, phone)
```

---

## Módulo: Derivación de respuestas (Fase 9 — pendiente)

Cuando el usuario final responde al mensaje con texto libre (en lugar de hacer click en el link), el sistema lo detecta y reenvía la respuesta al WhatsApp de atención del cliente.

**Comportamiento:**
- El webhook de Twilio recibe el mensaje entrante en el número dedicado del cliente
- Si el cliente tiene `forwarding_number` configurado → el sistema reenvía el mensaje a ese número con contexto (nombre del negocio + número del usuario final)
- Si no hay `forwarding_number` → el sistema responde automáticamente al usuario final con mensaje genérico: "Gracias por tu mensaje. Para consultas, escribinos a [nombre del negocio]."
- El evento queda registrado en `message_logs` con status `reply_received`

Nuevo campo en `organizations`: `forwarding_number TEXT` (con código de país, nullable)

Nuevo campo en Settings (sección 3.5 del PRD): input de teléfono para `forwarding_number`

---

## Módulo: Estadísticas completas (Fase 10 — pendiente)

**KPIs principales:**
| Métrica              | Fuente                           |
|----------------------|----------------------------------|
| Mensajes enviados    | message_logs                     |
| Entregados           | Webhook Twilio (delivered)       |
| Leídos               | Webhook Twilio (read)            |
| Clicks en link       | Redirect tracking (short URL)    |
| Tasa de entrega      | Entregados / Enviados (%)        |
| Tasa de lectura      | Leídos / Entregados (%)          |
| Tasa de click        | Clicks / Enviados (%)            |
| Mensajes restantes   | Cupo del plan - enviados         |

**Filtros:** período (7d / 30d / este mes / rango custom) + sucursal

**Historial paginado:** fecha, nombre, número, sucursal, status (sorteable y filtrable)

**Export CSV** del historial

**Notificaciones in-app:**
- 80% del plan consumido → banner de alerta en dashboard
- 100% del plan consumido → alerta crítica + consumo pasa a variable
- Opt-out recibido → feed de notificaciones

**Click tracking:** implementar short URL (redirige a la review_link real y loguea el click en `message_logs`)

---

## Módulo: Bot de WhatsApp (Fase 11 — pendiente)

Canal alternativo de envío: el cliente Medano envía un WhatsApp al número del bot y completa el envío por chat, sin abrir el SaaS.

**Número del bot:** número Twilio de Medano, compartido entre todos los clientes. El bot identifica al cliente por el número desde el que escribe (debe estar registrado en `waba_connections`).

**Flujo conversacional:**
1. Bot → Cliente: "Hola! ¿A quién querés enviarle la solicitud? Escribí el nombre."
2. Cliente → Bot: [nombre del contacto]
3. Bot → Cliente: "¿Cuál es el número de WhatsApp de [nombre]? Incluí el código de país."
4. Cliente → Bot: [número]
5. Bot → Cliente: "¿Desde qué sucursal? 1) Centro  2) Palermo  3) Sin sucursal"
6. Cliente → Bot: [opción]
7. Bot → Cliente: "Confirmo envío a [nombre] ([número]) desde [sucursal]? Respondé SÍ."
8. Cliente → Bot: "SÍ"
9. Bot → Cliente: "✅ Mensaje enviado. Lo podés ver en tu historial en app.medano.co"

**Consideraciones técnicas:**
- Las respuestas del bot se manejan via webhook de Twilio (inbound messages) — mismo endpoint `/api/webhooks/twilio`
- El envío se registra en `message_logs` igual que desde el SaaS
- Si el número que escribe no está registrado → bot responde con instrucciones de registro
- El número dedicado del **cliente** es el que envía al usuario final — no el número del bot

Nueva tabla: `bot_sessions`
```sql
id UUID PRIMARY KEY
org_id UUID REFERENCES organizations
phone TEXT NOT NULL            -- número del cliente Medano que está usando el bot
step INT DEFAULT 1             -- paso actual de la conversación (1-8)
data JSONB DEFAULT '{}'        -- datos recolectados hasta ese paso
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

---

## Módulo: Panel Admin Medano (Fase 12 — pendiente)

Panel exclusivo para cuentas con rol `admin` o `superadmin`. Acceso via `/admin`.

**Vista de consumo mensual por cliente:**
- Tabla: nombre, plan, msgs incluidos, msgs usados, % cupo (barra visual), excedente, costo estimado, próxima renovación
- Ordenable por % de cupo consumido
- Filtro por plan
- Export CSV para facturación

**Become / Impersonación:**
- Botón "Ver como cliente" en cada fila
- El admin es redirigido al dashboard del cliente con banner visible: "Estás viendo la cuenta de [Cliente] como administrador Medano"
- `superadmin`: acceso completo — puede enviar mensajes y modificar configuración
- `admin`: solo lectura — puede navegar pero NO enviar ni modificar
- Botón "Salir de esta cuenta" siempre visible
- Cada sesión de Become queda registrada en `audit_logs` (solo visible para `superadmin`)

**Gestión de clientes:**
| Acción               | Descripción                                          |
|----------------------|------------------------------------------------------|
| Crear cliente        | Crear nueva organización manualmente                 |
| Editar plan          | Cambiar Starter → Growth → Pro                       |
| Asignar número Twilio | Registrar subaccount SID y número comprado          |
| Suspender cliente    | Bloquear envíos sin eliminar la cuenta               |
| Ver historial        | Acceder al log completo de mensajes de un cliente    |

Nueva tabla: `audit_logs`
```sql
id UUID PRIMARY KEY
admin_id UUID REFERENCES profiles
target_org_id UUID REFERENCES organizations
action TEXT  -- 'become_start' | 'become_end' | 'plan_change' | 'suspend'
metadata JSONB DEFAULT '{}'
created_at TIMESTAMPTZ DEFAULT NOW()
```

---

## Schema de DB completo

```sql
-- Existentes
organizations:    id, name, owner_id, review_link, forwarding_number*, wizard_step*, logo_url*, category*, created_at
waba_connections: id, org_id, channel_id, api_key, twilio_subaccount_sid, phone_number, status, created_at
locations:        id, org_id, name, review_link, active*, created_at
message_logs:     id, org_id, location_id, customer_name, phone, status, error, wam_id, short_url*, created_at
profiles:         id (= auth.uid), email, role (client|admin|superadmin), created_at

-- Nuevas (fases pendientes)
blacklist:        id, org_id, phone, origin (manual|automatic), created_at
scheduled_sends:  id, org_id, location_id, contacts JSONB, scheduled_at, status, created_at
bot_sessions:     id, org_id, phone, step, data JSONB, created_at, updated_at
audit_logs:       id, admin_id, target_org_id, action, metadata JSONB, created_at
```
(*) campos nuevos a agregar en migraciones pendientes

---

## Próxima sesión

### Infraestructura (resuelto)
- Netlify conectado a GitHub (rama `main`), auto-deploy activado
- `netlify.toml` + `@netlify/plugin-nextjs` configurados
- Variables de entorno en Netlify: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WABA_MOCK`
- Middleware de auth en `middleware.ts` (fue `proxy.ts` — no renombrar)
- Migración DB ya aplicada en producción
- SMTP: Resend con dominio `medano.co`, API key en Supabase → Authentication → SMTP
- Auth emails usan `NEXT_PUBLIC_APP_URL`, ruta `/auth/callback` y `/auth/callback/reset`
- Supabase → Authentication → URL Configuration: Site URL y Redirect URLs deben apuntar a `https://appmedano.netlify.app`

### Inmediato (desbloquea onboarding real)
1. Esperar respuesta de Twilio Support para desbloquear subaccounts + long code numbers
2. Una vez desbloqueado:
   a. Crear subaccount "Medano" en Twilio Console
   b. Comprar número de Canada (+1, ~$1.15/mes) — no requiere Regulatory Bundle
   c. Registrar número como WhatsApp sender: Messaging → Senders → WhatsApp senders
   d. Configurar webhook en Twilio Console → `https://appmedano.netlify.app/api/webhooks/twilio`
   e. Insertar registro en `waba_connections` en Supabase:
      - `twilio_subaccount_sid` = SID del subaccount creado
      - `phone_number` = número comprado
      - `status` = active
      - `api_key` = cualquier valor que NO empiece con `mock_`
3. Desactivar `NEXT_PUBLIC_WABA_MOCK` en Netlify
4. Hacer envío de prueba real desde app.medano.co

### Siguiente
6. Fase 5 (parte 2): validación de firma Twilio en el webhook (X-Twilio-Signature)
7. Fase 7: Envío múltiple + envíos programados
8. Fase 8: Opt-out / Blacklist
9. Fase 9: Derivación de respuestas

### Horizonte
10. Fase 10: Estadísticas completas + click tracking
11. Fase 11: Bot de WhatsApp
12. Fase 12: Panel Admin + Become mode
13. Fase 13: Billing (prepago de créditos, corte automático)
14. Fase 6: Onboarding wizard guiado (puede ir antes o después del panel admin según prioridad)

## Aprendizajes Twilio (sesión 2 abril 2026)

- Cuentas nuevas de Twilio tienen dos restricciones que requieren ticket de soporte:
  subaccounts bloqueados + long code numbers bloqueados en todos los países
- Números argentinos cuestan $8/mes + requieren Regulatory Bundle — no usar
- Números UK también requieren Regulatory Bundle — no usar
- **Número de Canada (+1, ~$1.15/mes) es la opción correcta** — sin regulatory bundle
- Template de reseña creado: Content SID = `HX4abd93d52c5db977ab40042080028aa2`
- Template pendiente de aprobación por Meta (puede tardar hasta 24hs)
- Para el piloto: una vez desbloqueada la cuenta, usar cuenta master como subaccount
  hasta tener subaccounts habilitados
- Pricing corregido: el $1.50/mes estimado para número aplica con Canada, no Argentina

## Aprendizajes técnicos (sesión 7 abril 2026)
- Error PGRST204 "column not found in schema cache" → la columna no existía en producción (wam_id faltaba en message_logs)
- Los inserts en `message_logs` deben usar service role key para evitar restricciones de RLS
- `router.refresh()` de `next/navigation` refresca el Server Component sin recargar la página
- Si una migración no se aplicó con supabase CLI, ejecutar el ALTER TABLE directamente en SQL Editor de Supabase
- `NOTIFY pgrst, 'reload schema'` recarga el schema cache de PostgREST

## Skills de Claude.ai (proyecto)

Skills activos en este proyecto para uso en Claude.ai:
- `medano-dev-prompt` — genera prompts listos para Claude Code
- `medano-feature-planner` — planifica features con contexto del stack y roadmap
- `medano-context` — ayuda a mantener este CLAUDE.md actualizado al final de cada sesión
