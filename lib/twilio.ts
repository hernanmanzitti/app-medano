interface SendFreeFormParams {
  subaccountSid: string  // SID del subaccount del cliente (va en la URL)
  from: string           // número con prefijo "whatsapp:"
  to: string             // número destino con prefijo "whatsapp:"
  body: string
}

interface SendFreeFormResult {
  sid: string
  status: string
}

/**
 * Envía un mensaje free-form (sin ContentSid) desde el número dedicado del cliente.
 * Autentica con credenciales master (mismo patrón que send/route.ts y webhook),
 * usando el subaccountSid del cliente en la URL para que el mensaje salga desde ese subaccount.
 */
export async function sendFreeForm(params: SendFreeFormParams): Promise<SendFreeFormResult> {
  const { subaccountSid, from, to, body } = params

  const masterSid = process.env.TWILIO_ACCOUNT_SID!
  const masterToken = process.env.TWILIO_AUTH_TOKEN!
  const url = `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/Messages.json`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${masterSid}:${masterToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Twilio sendFreeForm error (${res.status}): ${detail}`)
  }

  const data = await res.json()
  return { sid: data.sid, status: data.status }
}
