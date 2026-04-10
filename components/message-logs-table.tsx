import { format } from 'date-fns'

interface MessageLog {
  id: string
  customer_name: string
  phone: string
  status: string
  created_at: string
  locations: { name: string }[] | null
}

interface Props {
  logs: MessageLog[]
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  sent:           { label: 'Enviado',     className: 'bg-[#eceef8] text-[#1a4793]' },
  delivered:      { label: 'Entregado',   className: 'bg-[#eceef8] text-[#1a4793]' },
  read:           { label: 'Leído',       className: 'bg-[#eceef8] text-[#1a4793]' },
  reply_received: { label: 'Respondido',  className: 'bg-[#eceef8] text-[#1a4793]' },
  pending:        { label: 'Pendiente',   className: 'bg-yellow-50 text-yellow-700' },
  failed:         { label: 'Error',       className: 'bg-red-50 text-red-700' },
  blocked:        { label: 'Bloqueado',   className: 'bg-red-50 text-red-700' },
}

export function MessageLogsTable({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-[#b4b7d9] py-4 text-center">
        Todavía no enviaste ninguna solicitud.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#b4b7d9] text-left text-xs text-[#646caa] uppercase tracking-wide">
            <th className="pb-2 pr-4 font-medium">Cliente</th>
            <th className="pb-2 pr-4 font-medium">Teléfono</th>
            <th className="pb-2 pr-4 font-medium">Sucursal</th>
            <th className="pb-2 pr-4 font-medium">Fecha</th>
            <th className="pb-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eceef8]">
          {logs.map((log) => {
            const badge = STATUS_LABEL[log.status] ?? STATUS_LABEL.pending
            return (
              <tr key={log.id} className="hover:bg-[#f4f5fb]">
                <td className="py-2.5 pr-4 font-medium text-[#00246b] whitespace-nowrap">
                  {log.customer_name}
                </td>
                <td className="py-2.5 pr-4 text-[#646caa] whitespace-nowrap">
                  +{log.phone}
                </td>
                <td className="py-2.5 pr-4 text-[#646caa] whitespace-nowrap">
                  {log.locations?.[0]?.name ?? <span className="text-[#b4b7d9]">—</span>}
                </td>
                <td className="py-2.5 pr-4 text-[#b4b7d9] whitespace-nowrap">
                  {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                </td>
                <td className="py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
