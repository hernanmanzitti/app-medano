import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface MessageLog {
  id: string
  customer_name: string
  phone: string
  status: string
  created_at: string
  location: { name: string }[] | null
}

interface Props {
  logs: MessageLog[]
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  sent:      { label: 'Enviado',    className: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Entregado',  className: 'bg-green-100 text-green-700' },
  read:      { label: 'Leído',      className: 'bg-purple-100 text-purple-700' },
  failed:    { label: 'Error',      className: 'bg-red-100 text-red-700' },
  pending:   { label: 'Pendiente',  className: 'bg-gray-100 text-gray-500' },
}

export function MessageLogsTable({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">
        Todavía no enviaste ninguna solicitud.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="pb-2 pr-4 font-medium">Cliente</th>
            <th className="pb-2 pr-4 font-medium">Teléfono</th>
            <th className="pb-2 pr-4 font-medium">Sucursal</th>
            <th className="pb-2 pr-4 font-medium">Fecha</th>
            <th className="pb-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map((log) => {
            const badge = STATUS_LABEL[log.status] ?? STATUS_LABEL.pending
            return (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="py-2.5 pr-4 font-medium text-gray-900 whitespace-nowrap">
                  {log.customer_name}
                </td>
                <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                  +{log.phone}
                </td>
                <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                  {log.location?.[0]?.name ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="py-2.5 pr-4 text-gray-400 whitespace-nowrap">
                  {formatDistanceToNow(new Date(log.created_at), {
                    addSuffix: true,
                    locale: es,
                  })}
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
