# app.medano.co

SaaS B2B para enviar solicitudes de reseñas vía WhatsApp Business API.

## Stack

- Next.js 16 (App Router)
- Supabase (DB + Auth)
- Twilio (WhatsApp Business API)
- Netlify (deploy)

## Correr en local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Variables de entorno

Crear `.env.local` en la raíz:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WABA_MOCK=true

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_TEMPLATE_SID=
TWILIO_BOT_NUMBER=
```

Con `NEXT_PUBLIC_WABA_MOCK=true` los envíos de WhatsApp se simulan sin llamar a Twilio.

## Deploy

Deploy automático en Netlify desde la rama `main`.
