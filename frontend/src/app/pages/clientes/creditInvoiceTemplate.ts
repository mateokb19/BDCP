import type { ApiClient, ApiClientCredit } from '@/api'

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtCOP(n: number): string {
  return Number(n).toLocaleString('es-CO')
}

function fmtDate(iso: string): string {
  if (!iso || iso === '—') return iso
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function buildCreditInvoiceHtml(
  client: ApiClient,
  credits: ApiClientCredit[],
  generatedAt: string,
): string {
  const total = credits.reduce((s, c) => s + Number(c.amount), 0)

  const rows = credits
    .map(c => `
      <tr>
        <td>${escapeHtml(c.order_number)}</td>
        <td>${escapeHtml(fmtDate(c.delivered_at))}</td>
        <td>${escapeHtml(c.plate)}</td>
        <td>${escapeHtml(c.vehicle)}</td>
        <td class="services">${escapeHtml(c.services)}</td>
        <td class="amount">$${fmtCOP(Number(c.amount))}</td>
      </tr>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Factura de Servicios Pendientes — ${escapeHtml(client.name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .header .brand { font-size: 18px; font-weight: 700; color: #1a1a1a; }
    .header .brand span { color: #ca8a04; }
    .header .meta { text-align: right; font-size: 11px; color: #555; line-height: 1.6; }
    .header .meta strong { font-size: 13px; color: #111; }
    .divider { border: none; border-top: 2px solid #ca8a04; margin: 16px 0; }
    .client-section { margin-bottom: 20px; }
    .client-section p { line-height: 1.8; }
    .client-section .label { font-weight: 600; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f5f5f5; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; color: #444; border-bottom: 2px solid #ddd; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    td.amount { text-align: right; white-space: nowrap; font-weight: 600; }
    td.services { color: #555; font-size: 11px; max-width: 200px; }
    .totals { margin-top: 16px; display: flex; justify-content: flex-end; }
    .totals table { width: auto; min-width: 240px; }
    .totals td { font-size: 13px; padding: 4px 10px; border: none; }
    .totals .total-row td { font-size: 15px; font-weight: 700; border-top: 2px solid #ca8a04; padding-top: 8px; }
    .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #999; }
  </style>
</head>
<body onload="window.print()">
  <div class="header">
    <div class="brand">BDC<span>Polo</span></div>
    <div class="meta">
      <strong>Factura de Servicios Pendientes</strong><br/>
      Generado: ${escapeHtml(generatedAt)}<br/>
      Bogotá Detailing Center
    </div>
  </div>
  <hr class="divider" />

  <div class="client-section">
    <p><span class="label">Cliente:</span> ${escapeHtml(client.name)}</p>
    ${client.phone ? `<p><span class="label">Teléfono:</span> ${escapeHtml(client.phone)}</p>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Orden</th>
        <th>Fecha entrega</th>
        <th>Placa</th>
        <th>Vehículo</th>
        <th>Servicios</th>
        <th style="text-align:right">Monto</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr class="total-row">
        <td>Total a pagar:</td>
        <td class="amount">$${fmtCOP(total)}</td>
      </tr>
    </table>
  </div>

  <div class="footer">
    Bogotá Detailing Center &nbsp;·&nbsp; BDCPolo &nbsp;·&nbsp; Comprobante interno
  </div>
</body>
</html>`
}
