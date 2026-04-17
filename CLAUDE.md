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
NEXT_PUBLIC_WABA_MOCK=true              # Activar mock de WABA en desarrollo (omitir en prod — eliminado de Netlify el 15 abril 2026)

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
- [x] Template medano_review_request recreado en subaccount COBA — SID: HX6f8e742a9ad31e8fd67f0d2db2b690ad — submitted para aprobación Meta el 13 abril 2026. Tipo: Text, categoría: Marketing, idioma: Spanish (ARG). SID anterior (HX4abd93d52c5db977ab40042080028aa2) era de cuenta master, quedó obsoleto.
- [x] Template aprobado por Meta — TWILIO_TEMPLATE_SID actualizado a HX6f8e742a9ad31e8fd67f0d2db2b690ad en Netlify, NEXT_PUBLIC_WABA_MOCK eliminado. Envío real end-to-end funcionando: mensaje entregado y status actualizado correctamente en message_logs (15 abril 2026).
- [x] TWILIO_SUBACCOUNT_AUTH_TOKEN agregado en Netlify — auth token del subaccount COBA para validación de firma en webhook.
- [x] Ticket de soporte resuelto — cuenta Twilio desbloqueada (subaccounts + long code numbers) el 8 abril 2026
- [x] Subaccount COBA creado en Twilio Console — SID y Auth Token guardados
- [x] Número canadiense +1 365 906 3072 comprado en subaccount COBA ($1.15/mes)
- [x] SQL de waba_connections ejecutado — subaccount COBA registrado (org_id: 48f92c4c-31db-4ed1-911e-40e96eafb59c, phone: +13659063072)
- [x] Registro de WhatsApp Sender completado — 13 abril 2026. Display name: Centro de Ojos Buenos Aires. WhatsApp Business Account ID: 1474369367428056. Meta Business Manager ID: 1186141222354766. Status: Offline (pendiente activación Meta)
- [x] Webhook configurado en número +1 365 906 3072 — URL: https://appmedano.netlify.app/api/webhooks/twilio, método POST
- [x] StatusCallback agregado en send/route.ts — Twilio notificará delivered/read/failed al webhook
- [x] Confirmación de Twilio Support (ticket #26222642, 14 abril 2026): Sender +13659063072 registrado y activo. Límite Meta: 250 conversaciones únicas/24hs, máximo 2 números por WABA. Suficiente para el piloto.
- [x] Template medano_review_request aprobado por Meta — envíos business-initiated activos desde el 15 abril 2026.
- [x] Integración Twilio: connect-waba/route.ts reescrito para Twilio (valida credenciales subaccount + upsert en waba_connections)
- [x] Fase 5 (parte 2): validación de firma Twilio en el webhook (X-Twilio-Signature)
- [ ] Fase 6: Onboarding wizard guiado (reemplaza el onboarding actual de 2 pasos)
- [x] Fase 7 (parte 1): API de envío múltiple — send/route.ts soporta batch via contacts[] (compatibilidad individual mantenida)
- [x] Fase 7 (parte 2): UI de envío múltiple — agregar contactos de a uno, lista previa, envío batch
- [x] Fase 7 (parte 3): Envíos programados — descartado para esta versión
- [x] Fase 8: Opt-out / Blacklist — tabla blacklist creada, API GET/POST/DELETE, verificación en send/route.ts, detección automática en webhook, UI en /dashboard/blacklist
- [x] Fase 9: Derivación de respuestas — webhook responde al usuario final en todos los casos (con y sin forwarding_number) + reenvía mensaje al cliente cuando hay forwarding_number configurado. Mensaje al usuario final incluye link wa.me clickeable para redirigirlo al canal de atención del cliente.
- [x] Webhook fix: mensajes inbound configurados en Twilio Console → Messaging → WhatsApp Senders → el sender → "Webhook URL for incoming messages"
- [x] Derivación de respuestas: formato del mensaje de reenvío corregido ("Mensaje de +[número] para [org]: [texto]") + logs de debugging agregados en todo el path inbound
- [x] Diseño del dashboard actualizado con identidad de marca Médano — paleta navy/royal/mid/light, tipografías DM Sans + Barlow Condensed, tokens CSS en globals.css
- [x] Sidebar de navegación implementado — logo Médano + nombre de org, links Inicio/Opt-out/Ajustes, logout, responsive con hamburguesa en mobile
- [x] Layout del dashboard refactorizado — eliminado header anterior, sidebar reemplaza navegación superior
- [x] Páginas de blacklist y settings sin botón Volver — navegación via sidebar
- [x] Logo Médano agregado al sidebar — archivo: public/logo-medano.png, commit 2f39a48. Reemplaza el texto "médano" en desktop (120×40px) y mobile (90×30px)
- [x] Texto descriptivo de "Derivación de respuestas" en settings corregido — eliminado duplicado, texto actualizado
- [x] Sección "Link de reseña" renombrada a "Sede central" en settings con descripción actualizada
- [ ] Fase 10: Estadísticas completas (KPIs, filtros, click tracking)
- [ ] Fase 11: Bot de WhatsApp (canal alternativo de envío)
- [ ] Fase 12: Panel Admin Medano (consumo + Become mode)
- [ ] Fase 13: Billing — prepago de créditos, corte automático por saldo
- [x] UI: cambiar colores de los badges de status en message-logs-table (pending/sent amarillo, delivered royal, read verde, failed rojo, blocked gris, reply_received violeta) — mejora de legibilidad visual.
- [x] Settings: editar nombre de organización desde /dashboard/settings. Bloque nuevo arriba de Sede central, validación 2-60 chars, actualiza sidebar con router.refresh().
- [ ] Settings: cambiar email del usuario con flujo de verificación — el usuario ingresa nuevo email → se envía código de 6 dígitos a la nueva casilla vía Resend → usuario ingresa el código en el dashboard → recién ahí se confirma el cambio. Protege contra errores de tipeo y valida que la casilla pertenezca al usuario.

---

## Estado del piloto (17 abril 2026)

### Estado del piloto
- **Cliente piloto #1 activo**: Centro de Ojos Buenos Aires (número +1 365 906 3072, subaccount COBA). Test end-to-end completado con éxito: mensaje enviado, entregado, leído, status actualizados correctamente en message_logs. Cliente real en producción.
- **Path de respuesta sin forwarding_number**: validado en producción. Usuario final recibe mensaje de respuesta automática correctamente.
- **Path con forwarding_number**: validado en producción. Cliente recibe reenvío del mensaje en su número de atención, usuario final recibe respuesta automática con link wa.me clickeable.

---

## Onboarding de nuevo cliente (checklist operativo)

### Lo que está configurado una sola vez y NO se repite
- Template `medano_review_request` aprobado por Meta (SID: HX6f8e742a9ad31e8fd67f0d2db2b690ad)
- Variables de entorno en Netlify (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TEMPLATE_SID, TWILIO_SUBACCOUNT_AUTH_TOKEN, NEXT_PUBLIC_APP_URL, etc.)
- Supabase configurado (DB, Auth, RLS, SMTP con Resend)
- URL base del webhook: `https://appmedano.netlify.app/api/webhooks/twilio`

### Lo que se repite por cada cliente nuevo (~25–30 min)

1. **Crear subaccount en Twilio Console** — anotar SID y Auth Token
2. **Comprar número canadiense** en el subaccount (~$1.15/mes) — Phone Numbers → Buy a Number → Canada
3. **Registrar WhatsApp Sender** en Twilio — Messaging → WhatsApp Senders → Add Sender → Embedded Signup de Meta:
   - Elegir "Agregar número nuevo" (NO "Usar solo un nombre visible")
   - Ingresar el número comprado, verificar con código SMS
   - El código llega al número de Twilio → buscarlo en Twilio Console → Monitor → Logs → Messages
4. **Configurar webhook inbound** en el sender: Messaging → WhatsApp Senders → el número → "Webhook URL for incoming messages" → `https://appmedano.netlify.app/api/webhooks/twilio`
5. **Insertar registro en `waba_connections`** en Supabase con `org_id`, `twilio_subaccount_sid`, `phone_number` (formato `+1XXXXXXXXXX`), `status = 'active'`
6. **Crear usuario** en app.medano.co para el cliente (Supabase → Auth → Users → Invite)

### Próxima fase de desarrollo — tutoriales
- **Tutorial interno Medano**: paso a paso para onboardear un cliente nuevo (basado en el checklist de arriba)
- **Tutorial cliente**: cómo usar el dashboard (enviar solicitudes, sucursales, historial, opt-out, derivación)

---

## Decisiones tomadas

### BSP y onboarding
- **BSP: Twilio**. Sin fee fijo mensual. $1.50/mes por número + $0.0668/msg.
- **Onboarding MVP — acceso socio en Business Manager**: el cliente agrega el BM de Medano como socio en su Meta Business Manager (business.facebook.com → Configuración → Socios). Medano accede al WABA del cliente y lo registra en un subaccount de Twilio. Sin Embedded Signup, sin Tech Provider Program.
- **Onboarding futuro — Embedded Signup automático**: cuando Medano complete el proceso de Tech Provider con Meta (4-8 semanas, iniciar en paralelo), el onboarding pasará a ser un flow embebido en la app.
- **Número dedicado por cliente**: Medano compra un número nuevo en Twilio ($1.50/mes) al onboardear cada cliente. El cliente no toca su WhatsApp personal ni de negocio.
- **Subaccount de Twilio por cliente desde el piloto** (no solo en escala): por aislamiento de reputación y simplicidad futura.
- Un WABA por cliente (aislamiento de reputación y límites de envío)
- Template aprobado a nivel de cuenta Medano, no por cliente
- **Tech Provider de Meta NO es necesario** para el modelo Twilio del piloto. Twilio ya tiene la relación con Meta — Medano no necesita ninguna aprobación especial.
- **El BM del cliente no se necesita en ningún momento.** No hay API keys de clientes. Todo vive bajo las credenciales de Twilio (Account SID + Auth Token).

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
- Cambio de email de usuario: flujo de verificación con código de 6 dígitos enviado vía Resend (ya configurado como SMTP de Supabase con dominio medano.co, sender noreply@medano.co). No se usa el magic link nativo de Supabase Auth — se implementa un flujo custom para tener control del UX y poder mostrar feedback inline en el dashboard (código expira en 10 min, máximo 3 intentos).

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

## Módulo: Perfil de WhatsApp Business (post-piloto — pendiente)

> **Timing:** implementar una vez finalizado el piloto con el primer cliente.

Nueva sección en `/dashboard/settings`: **"Perfil de WhatsApp"**

Permite al cliente editar su perfil de WhatsApp Business desde el dashboard de Medano, sin tocar Twilio ni Meta. Los cambios se aplican vía Twilio WhatsApp Profile API usando las credenciales del subaccount del cliente (`twilio_subaccount_sid` en `waba_connections`).

**Campos disponibles (según Twilio WhatsApp Profile API):**
- Logo / foto de perfil — JPG o PNG, 640×640px o mayor, ratio cuadrado
- Dirección del negocio
- Sitio web principal
- Sitio web adicional
- Email de contacto
- Vertical / categoría (selector: Automotive, Beauty, Education, etc.)
- Descripción del negocio (máx 512 caracteres)
- Profile about (máx 139 caracteres)

**Display name:** no es editable desde Twilio ni desde el dashboard. Se define al registrar el WhatsApp Sender y no se puede modificar por UI.

**Logo — proceso asistido:**
> Para asegurar la mejor calidad y que el logo quede correctamente configurado, el cliente debe enviarlo a hola@medano.co. El equipo de Medano lo carga manualmente.

**Implementación:**
- API route: `api/settings/whatsapp-profile/route.ts` — GET + PATCH
- Lee `twilio_subaccount_sid` de `waba_connections` por `org_id`
- Cada cliente edita solo su propio perfil — aislamiento nativo por subaccount

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

## Decisiones de BSP (sesión 8 abril 2026)

### BSP elegido: Twilio (confirmado para piloto)

**Flujo real del piloto:**
Cliente (negocio) → Panel Medano → API Twilio → Número canadiense de Medano → WhatsApp del consumidor final

- El cliente NO conecta su BM ni toca nada de Meta
- El cliente solo se registra en Medano con email, carga nombre + teléfono del consumidor final, y apreta Enviar
- El número canadiense vive en el BM de Medano, registrado una sola vez en Twilio Console
- Cada cliente nuevo = comprar un número canadiense nuevo en Twilio (~$1.15/mes) y registrarlo
- El cliente nunca ve ni gestiona el número — es infraestructura de Medano

**Evolución futura del modelo:**
- Piloto: número canadiense en BM de Medano, cliente no toca nada
- Escala: cliente puede portar el número canadiense a su propio BM si quiere más control
- Ideal: cliente conecta su número argentino existente vía coexistencia (360dialog o Meta directo)
- Medano evoluciona de "infraestructura + software" a "solo software" a medida que los clientes maduran

### Por qué no cambiamos de BSP ahora
- Coexistencia (número propio del cliente) requiere 360dialog (€250/mes fijo) o Meta Cloud API directo
- Con 10-30 clientes piloto el fee fijo de 360dialog consume demasiado margen
- Meta Cloud API directo requiere construir toda la infraestructura multi-tenant (token management, webhook routing, rate limiting) — no vale la pena para el piloto
- Blip: BSP con coexistencia pero orientado a grandes empresas en Brasil, sin Partner API público para ISVs pequeños
- Decisión de BSP final se revisa cuando haya 10+ clientes pagando

### Bloqueante actual
- Ticket de soporte abierto en Twilio para desbloquear: subaccounts + long code numbers en Canadá
- Sin este desbloqueo no se puede hacer el onboarding real de clientes

### Próximos pasos — Twilio desbloqueado ✅ (listo para ejecutar)
1. Crear subaccount "Cliente 1" en Twilio Console
2. Dentro del subaccount, comprar número canadiense (+1, ~$1.15/mes)
3. ~~Registrar número como WhatsApp Sender en Twilio Console~~ ✅ completado 13 abril 2026 — Display name: Centro de Ojos Buenos Aires / WhatsApp Business Account ID: 1474369367428056 / Meta Business Manager ID: 1186141222354766
4. Someter template `medano_review_request` a aprobación Meta desde el sender creado
5. Configurar webhook: `https://appmedano.netlify.app/api/webhooks/twilio`
6. ~~Insertar registro en `waba_connections` en Supabase~~ ✅ ejecutado (subaccount COBA, org_id: 48f92c4c-31db-4ed1-911e-40e96eafb59c, phone: +13659063072)
7. Desactivar `NEXT_PUBLIC_WABA_MOCK` en Netlify
8. Hacer envío de prueba real

### Siguiente fase de desarrollo (post-piloto)
- Fase 6: Onboarding wizard guiado (reemplaza onboarding actual de 2 pasos)
- Fase 8: Opt-out / Blacklist
- Fase 9: Derivación de respuestas
- Fase 12: Panel Admin + Become mode
- Fase 13: Billing
- Evaluación de BSP: 360dialog o Meta Cloud API directo cuando haya 10+ clientes pagando

### Decisión final (8 abril 2026)
- **Piloto: Twilio** — número canadiense de Medano, onboarding manual, sin coexistencia
- **Escala: 360dialog** — cuando haya 10+ clientes pagando, migrar para coexistencia + onboarding automatizado
- **Largo plazo: evaluar software factory** para construir el multi-tenant si el negocio valida
- El piloto con Twilio sirve para validar que los clientes pagan antes de comprometer €250/mes fijos
- Bloqueante actual: respuesta de Twilio Support (subaccounts + long code numbers)

### Investigación de BSPs realizada (8 abril 2026)

| BSP | Coexistencia | ISV/Partner API | Fee fijo | Veredicto |
|-----|-------------|-----------------|----------|-----------|
| Twilio | ❌ | ✅ Subaccounts | No | ✅ Piloto |
| 360dialog | ✅ | ✅ Partner API | €250/mes | ✅ Escala (10+ clientes) |
| Gupshup | ❌ | ✅ | No (6% markup marketing) | ❌ |
| Blip | ✅ | ❌ Enterprise only | Enterprise | ❌ |
| Meta Cloud API directo | ✅ nativo | N/A (vos construís todo) | $0 | ⏳ Largo plazo |

### Meta Cloud API directo — conclusión
- Viable para 1 cliente o automatización propia (ver video Benjamín Cordero)
- Para multi-tenant requiere construir: token management (tokens expiran c/60 días),
  webhook routing por cliente, rate limiting
- No vale la pena para el piloto — Twilio abstrae toda esa complejidad
- Evaluar cuando haya 20+ clientes y revenue justifique la inversión en infraestructura

### Ecosistema Meta — conceptos clave
- **BSP:** intermediario habilitado por Meta (Twilio, 360dialog, Gupshup). Vos les alquilás la infraestructura
- **ISV:** eso es Medano. Software que se monta arriba de un BSP
- **Tech Provider:** categoría de Meta para ISVs que quieren automatizar onboarding via Embedded Signup
- **Embedded Signup:** popup de Meta que el cliente completa para conectar su WABA. Requiere ser Tech Provider
- Sin Tech Provider: onboarding manual (Hernán configura cada cliente a mano) — viable para piloto

## Modelo de onboarding WABA — decisión 13 abril 2026

### Modelo actual (piloto manual)
1. Hernán pide acceso como admin al BM del cliente (business.facebook.com)
2. Dentro del BM del cliente, Hernán entra a Twilio Console → subaccount del cliente → Messaging → WhatsApp Senders
3. Click en "Add Sender" → se abre el Embedded Signup de Meta integrado en Twilio
4. Seleccionar el BM del cliente, crear nueva cuenta de WhatsApp Business
5. Elegir "Agregar un número nuevo" (NO "Usar solo un nombre visible" — ese genera número virtual de Meta que no sirve)
6. Ingresar el número comprado en Twilio (ej: +1 365 906 3072) — requiere verificación via código SMS
7. El código de verificación llega al número de Twilio → buscarlo en Twilio Console → Monitor → Logs → Messages
8. Confirmar el acceso de Twilio al WABA del cliente
9. El Sender queda registrado con el display name y logo del BM del cliente
10. Actualizar waba_connections en Supabase con WABA ID y número

Resultado: el WABA es del cliente (en su BM), Twilio opera por debajo, Medano nunca aparece en WhatsApp. Display name y logo que ve el usuario final = los del cliente (tomados del BM de Meta).

Limitación: Hernán necesita acceso admin al BM del cliente. No es escalable más allá de ~10 clientes.

### Modelo futuro (Fase 6 — Embedded Signup automático)
1. El cliente entra al wizard de onboarding en app.medano.co
2. En el paso "Conectar WhatsApp", aparece el Embedded Signup de Meta embebido en la app
3. El cliente lo completa solo en ~3 minutos sin intervención de Hernán:
   - Crea o selecciona su BM
   - Crea su cuenta de WhatsApp Business
   - Agrega el número que Medano le asignó
   - Acepta condiciones
4. Meta devuelve el WABA ID via callback a Medano
5. connect-waba/route.ts guarda automáticamente en waba_connections
6. El cliente queda operativo sin intervención manual

Requisito: Medano debe ser Tech Provider de Meta (proceso de 4-8 semanas). Iniciar cuando haya 3-5 clientes piloto validados y pagando.

### Implicancias del modelo
- Display name en WhatsApp = nombre del cliente (no "Medano")
- Logo en WhatsApp = logo del cliente (tomado de su BM de Meta)
- Si el cliente se va de Medano, se lleva su WABA — ventaja comercial (no hay lock-in agresivo)
- Medano no acumula WABAs propios — cada cliente es dueño de su identidad
- El número dedicado (+1 canadiense) es infraestructura de Medano, registrado bajo el WABA del cliente

---

## Aprendizajes Twilio — sesión 13 abril 2026

- El template debe crearse en el **subaccount del cliente**, no en la cuenta master — los templates no son compartidos entre cuentas Twilio
- El SID del template cambia al recrearlo en otro subaccount — siempre verificar qué SID usar en TWILIO_TEMPLATE_SID
- Para botón Call-to-Action con URL variable en WhatsApp, Twilio requiere URL base fija + variable al final. Como los review links de los clientes son URLs completas variables, no encaja — solución: usar template de texto (twilio/text) con el link inline en el body
- El template de reseñas es clasificado por Meta como **Marketing** (no Utility) — no es reclasificable. Costo: $0.0618/msg en Argentina
- TWILIO_TEMPLATE_SID en Netlify debe actualizarse al nuevo SID solo después de que Meta apruebe el template
- StatusCallback es obligatorio en el POST a Twilio Messages.json para recibir actualizaciones de estado (delivered/read/failed) en el webhook
- El Embedded Signup de Meta está integrado dentro de Twilio Console (Messaging → WhatsApp Senders → Add Sender) — no hace falta ser Tech Provider para usarlo manualmente
- El límite de 2 números es por WABA, no por cuenta Twilio — cada cliente nuevo tiene su propio WABA, por lo que no hay límite práctico para escalar
- Sin template aprobado no es posible enviar mensajes business-initiated (Medano inicia la conversación). El mock no envía mensajes reales, solo simula el flujo interno
- Para probar el SaaS mientras se espera aprobación del template, usar NEXT_PUBLIC_WABA_MOCK=true en Netlify

## Aprendizajes técnicos — sesión 15 abril 2026

- **Mock check incompleto en send/route.ts**: `isMock` solo chequeaba `api_key.startsWith('mock_')` e ignoraba `NEXT_PUBLIC_WABA_MOCK`. Con la variable en `true` en Netlify, el envío igual iba a Twilio. Fix: `const isMock = process.env.NEXT_PUBLIC_WABA_MOCK === 'true' || waba.api_key.startsWith('mock_')`
- **Webhook status update con cliente incorrecto**: el update de `delivered/read/failed` en `webhooks/twilio/route.ts` usaba `createClient()` (auth con cookies). En un webhook de Twilio no hay sesión de usuario → con RLS activo el UPDATE no actualizaba ninguna fila (falla silenciosa). Fix: usar `getServiceClient()` que bypasea RLS. Regla general: cualquier operación de escritura en API Routes sin sesión de usuario debe usar service role key.
- **Validación de firma Twilio con token incorrecto (403)**: el webhook validaba con `TWILIO_AUTH_TOKEN` (master account) pero Twilio firma los StatusCallback y los mensajes entrantes con el auth token del **subaccount** que los origina. Fix: array `tokensToTry = [TWILIO_SUBACCOUNT_AUTH_TOKEN, TWILIO_AUTH_TOKEN]` (subaccount primero), se valida con `.some()` — si cualquiera matchea se acepta el request. Variable `TWILIO_SUBACCOUNT_AUTH_TOKEN` agregada en Netlify. Cuando haya múltiples subaccounts habrá que buscar el token por número destino en `waba_connections`.
- **Mensajes inbound de Twilio — dónde se configura el webhook**: el webhook para mensajes entrantes en WhatsApp se configura en Twilio Console → **Messaging → WhatsApp Senders → el sender → "Webhook URL for incoming messages"**. NO en Phone Numbers → Active Numbers. Es completamente independiente del `StatusCallback` que se pasa en el POST al enviar un mensaje outbound. Si solo está configurado el StatusCallback, los inbound no llegan al handler.
- **Link de reseña en WhatsApp mobile**: usar `maps?cid=` en lugar de `/writereview` — el de writereview abre un iframe en WhatsApp mobile que rompe el login de Google.
- **Logo en WhatsApp Business**: se configura desde Twilio Console → Messaging → WhatsApp Senders → editar el sender. No se controla desde el código.
- **Status máximo en cuentas WhatsApp Business**: el status `read` solo llega si el usuario final tiene los read receipts activados. Por defecto están desactivados → el status máximo esperado en producción es `delivered`.
- **Opt-out automático activo en producción**: el webhook detecta palabras clave (stop, baja, no, cancelar, salir, nomasinfo) y agrega el número a blacklist automáticamente. Al hacer pruebas con el propio número, evitar responder con esas palabras o verificar en /dashboard/blacklist y eliminar el número si queda bloqueado por error.

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
- Join de Supabase con RLS activo no trae datos relacionados aunque el join funcione a nivel DB → solución: hacer join en JS usando el array de locations ya fetcheado
- Los inserts en `message_logs` y las queries del dashboard deben usar service role key (`SUPABASE_SERVICE_ROLE_KEY`) para evitar restricciones de RLS
- Columna `wam_id` faltaba en producción — aplicar con `ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS wam_id TEXT` en SQL Editor si la migración no se aplicó via CLI
- El campo orgName que muestra el sidebar viene de `organizations.name` en Supabase — si aparece un valor incorrecto, corregirlo directamente en la DB desde el Table Editor de Supabase

## Aprendizajes técnicos — sesión 17 abril 2026

- **Bug en path de forwarding_number**: hasta hoy, cuando la org tenía forwarding_number configurado, el webhook reenviaba el mensaje al cliente pero NO respondía nada al usuario final (solo devolvía NextResponse.json). Esto dejaba al usuario final sin feedback. Fix: el webhook ahora siempre devuelve TwiML con mensaje automático al usuario final, independientemente de si hay forwarding_number o no. El reenvío al cliente ocurre antes del return del TwiML.
- **Copy de mensajes de respuesta automática al usuario final**:
  - Con forwarding_number: "Gracias por tu mensaje.\n\nEste número solo se utiliza para enviar solicitudes de reseñas. Si querés hacernos una consulta, comentario o necesitás atención al cliente, escribinos al: wa.me/{forwarding_number_sin_mas}"
  - Sin forwarding_number: "Gracias por tu mensaje.\n\nEste número solo se utiliza para enviar solicitudes de reseñas."
- **Link wa.me funciona en WhatsApp mobile**: click abre conversación directa con el número del forwarding_number. Cero fricción para el usuario final — no necesita copiar/pegar número.
- **Nombre de organización como dato de producto crítico**: organizations.name se usa en el sidebar del dashboard, en el mensaje de reenvío al cliente ("Mensaje de +XXX para {org.name}: ..."), y en las respuestas automáticas al usuario final. Dejarlo con un valor interno tipo "COBA" (nombre del subaccount de Twilio) rompe la UX de cara al cliente y al usuario final. Debe ser editable desde UI desde el día 1.
- **Escape XML en TwiML**: el TwiML devuelto al usuario final incluye valores de DB (forwarding_number, nombre de org) — agregada función helper escapeXml() para evitar XML malformado si alguno contiene &, <, >, ' o ". Twilio rechaza TwiML mal formado con error 12100.
- **Centro de Ojos Buenos Aires — piloto validado end-to-end**: los 4 caminos del ciclo de vida de mensaje funcionan en producción (sent → delivered → read → reply_received con forwarding, y también el path blocked para opt-out).

## Skills de Claude.ai (proyecto)

Skills activos en este proyecto para uso en Claude.ai:
- `medano-dev-prompt` — genera prompts listos para Claude Code
- `medano-feature-planner` — planifica features con contexto del stack y roadmap
- `medano-context` — ayuda a mantener este CLAUDE.md actualizado al final de cada sesión
