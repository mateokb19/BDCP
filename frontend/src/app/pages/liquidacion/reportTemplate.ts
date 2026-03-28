/**
 * reportTemplate.ts
 * ─────────────────
 * Generates the full HTML string for the operator liquidation PDF report.
 * Edit this file to change the layout, styles, or content of the printed report.
 * It is intentionally kept separate from Liquidacion.tsx so you never have to
 * scroll through UI code to tweak the invoice template.
 */

import type { ApiReportResponse } from '@/api'
import { escapeHtml } from './helpers'

const PIECE_RATE = 90_000

const fmt     = (n: string | number) => `$${Number(n).toLocaleString('es-CO')}`
const fmtDate = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }

// ── Per-week section ─────────────────────────────────────────────────────────

function buildWeekSection(
  w: ApiReportResponse['week_statuses'][number],
  r: ApiReportResponse,
  rate: number,
  isPintura: boolean,
  isLatoneria: boolean,
): string {
  const weekOrders = r.orders.filter(o => o.date >= w.week_start && o.date <= w.week_end)

  // ── Service rows ────────────────────────────────────────────────────────────
  const serviceRows = weekOrders.flatMap(o => {
    const vehicle    = [o.vehicle_brand, o.vehicle_model].filter(Boolean).join(' ') || '—'
    const orderPieces = Number(o.piece_count ?? 0)
    const orderComm   = isPintura
      ? orderPieces * PIECE_RATE
      : isLatoneria
      ? Number(o.latoneria_operator_pay ?? 0)
      : Number(o.total) * rate / 100

    const orderBadge = o.is_liquidated
      ? `<span style="background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:8px;">&#10003; LIQUIDADO</span>`
      : `<span style="background:#fee2e2;color:#991b1b;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:8px;">&#10005; SIN LIQUIDAR</span>`

    const orderHeader = `<tr style="background:#f0f0f0;">
      <td colspan="3" style="padding:6px 10px;font-size:12px;font-weight:600;color:#444;">
        ${escapeHtml(o.order_number)} &nbsp;·&nbsp; ${escapeHtml(o.vehicle_plate)} &nbsp;·&nbsp; ${escapeHtml(vehicle)}
        <span style="font-weight:400;color:#999;margin-left:6px;">${escapeHtml(o.date)}</span>
        ${orderBadge}
      </td>
    </tr>`

    const items = o.items.map(i =>
      `<tr>
        <td style="padding:5px 10px 5px 20px;font-size:13px;color:#333;">${escapeHtml(i.service_name)}</td>
        <td style="padding:5px 10px;text-align:right;font-size:13px;color:#444;">${fmt(i.subtotal)}</td>
        <td style="padding:5px 10px;text-align:right;font-size:13px;color:#d97706;font-weight:500;">${isPintura || isLatoneria ? '—' : fmt(Number(i.subtotal) * rate / 100)}</td>
      </tr>`
    ).join('')

    const commCell = isPintura
      ? `${orderPieces} pieza${orderPieces !== 1 ? 's' : ''} = ${fmt(orderComm)}`
      : isLatoneria
      ? `Pago: ${fmt(orderComm)}`
      : fmt(orderComm)

    const orderTotal = `<tr style="border-top:1px dashed #ddd;background:#fafafa;">
      <td style="padding:5px 10px 5px 20px;font-size:12px;color:#888;font-style:italic;">Subtotal orden</td>
      <td style="padding:5px 10px;text-align:right;font-size:13px;font-weight:700;">${fmt(o.total)}</td>
      <td style="padding:5px 10px;text-align:right;font-size:13px;font-weight:700;color:#d97706;">${commCell}</td>
    </tr>`

    return orderHeader + items + orderTotal
  }).join('<tr><td colspan="3" style="height:6px;border:none;background:#fff;"></td></tr>')

  // ── Week status badge ────────────────────────────────────────────────────────
  const hasAnyLiquidated = weekOrders.some(o => o.is_liquidated)
  const hasAllLiquidated = weekOrders.length > 0 && weekOrders.every(o => o.is_liquidated)
  const badge = hasAllLiquidated
    ? `<span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;letter-spacing:0.3px;">&#10003; LIQUIDADA</span>`
    : hasAnyLiquidated
    ? `<span style="background:#fef9c3;color:#854d0e;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;letter-spacing:0.3px;">&#9654; PARCIAL</span>`
    : `<span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;letter-spacing:0.3px;">&#10005; SIN LIQUIDAR</span>`

  // ── Payment amounts ──────────────────────────────────────────────────────────
  const pendingAmt     = Number(w.amount_pending     ?? 0)
  const cashAmt        = Number(w.payment_cash        ?? 0)
  const datafonoAmt    = Number(w.payment_datafono    ?? 0)
  const nequiAmt       = Number(w.payment_nequi       ?? 0)
  const bancolombiaAmt = Number(w.payment_bancolombia ?? 0)
  const totalPaid      = cashAmt + datafonoAmt + nequiAmt + bancolombiaAmt

  const liqOrders   = weekOrders.filter(o => o.is_liquidated)
  const unliqOrders = weekOrders.filter(o => !o.is_liquidated)
  const liqComm     = isPintura
    ? liqOrders.reduce((s, o) => s + Number(o.piece_count ?? 0), 0) * PIECE_RATE
    : isLatoneria
    ? liqOrders.reduce((s, o) => s + Number(o.latoneria_operator_pay ?? 0), 0)
    : liqOrders.reduce((s, o) => s + Number(o.total), 0) * rate / 100
  const unliqComm   = isPintura
    ? unliqOrders.reduce((s, o) => s + Number(o.piece_count ?? 0), 0) * PIECE_RATE
    : isLatoneria
    ? unliqOrders.reduce((s, o) => s + Number(o.latoneria_operator_pay ?? 0), 0)
    : unliqOrders.reduce((s, o) => s + Number(o.total), 0) * rate / 100

  const payRows = [
    ['Efectivo', cashAmt], ['Banco Caja Social', datafonoAmt],
    ['Nequi', nequiAmt],   ['Bancolombia', bancolombiaAmt],
  ].filter(([, v]) => (v as number) > 0).map(([label, v]) =>
    `<div><div style="font-size:11px;color:#6b7280;margin-bottom:2px;">${label}</div><div style="font-size:16px;font-weight:600;color:#1a1a1a;">${fmt(v as number)}</div></div>`
  ).join('<div style="width:1px;background:#d1d5db;align-self:stretch;"></div>')

  const payRowsCompact = [
    ['Efectivo', cashAmt], ['Banco Caja Social', datafonoAmt],
    ['Nequi', nequiAmt],   ['Bancolombia', bancolombiaAmt],
  ].filter(([, v]) => (v as number) > 0).map(([label, v]) =>
    `<div style="font-size:11px;color:#6b7280;">${label}: <strong>${fmt(v as number)}</strong></div>`
  ).join('')

  const estadoPago = hasAllLiquidated
    ? `<div style="border-top:2px solid #166534;background:#f0fdf4;padding:16px 18px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#166534;margin-bottom:12px;">Estado de pago — Liquidada</div>
        <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">
          <div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">Comisión semana</div>
            <div style="font-size:18px;font-weight:700;color:#1a1a1a;">${fmt(w.week_commission)}</div>
          </div>
          ${payRows ? `<div style="width:1px;background:#d1d5db;align-self:stretch;"></div>${payRows}` : ''}
          ${pendingAmt > 0 ? `<div style="width:1px;background:#d1d5db;align-self:stretch;"></div>
          <div>
            <div style="font-size:11px;color:#dc2626;font-weight:600;margin-bottom:2px;">Pendiente por pagar</div>
            <div style="font-size:16px;font-weight:700;color:#dc2626;">${fmt(pendingAmt)}</div>
          </div>` : ''}
          <div style="margin-left:auto;text-align:right;">
            <div style="font-size:11px;color:#166534;font-weight:600;margin-bottom:2px;">Total pagado al operario</div>
            <div style="font-size:20px;font-weight:800;color:#166534;">${fmt(totalPaid - pendingAmt)}</div>
          </div>
        </div>
      </div>`
    : hasAnyLiquidated
    ? `<div style="border-top:2px solid #854d0e;background:#fefce8;padding:16px 18px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#854d0e;margin-bottom:12px;">Estado de pago — Parcialmente liquidada</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:stretch;">
          <div style="flex:1;min-width:180px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;">
            <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Ya pagado (${liqOrders.length} servicio${liqOrders.length !== 1 ? 's' : ''})</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:1px;">Comisión liquidada</div>
            <div style="font-size:16px;font-weight:700;color:#166534;">${fmt(liqComm)}</div>
            <div style="margin-top:6px;">${payRowsCompact}</div>
          </div>
          <div style="flex:1;min-width:180px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;">
            <div style="font-size:10px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Sin liquidar (${unliqOrders.length} servicio${unliqOrders.length !== 1 ? 's' : ''})</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:1px;">Comisión pendiente</div>
            <div style="font-size:20px;font-weight:800;color:#dc2626;">${fmt(unliqComm)}</div>
          </div>
        </div>
      </div>`
    : `<div style="border-top:2px solid #dc2626;background:#fef2f2;padding:16px 18px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#dc2626;margin-bottom:12px;">Estado de pago — Sin Liquidar</div>
        <div style="display:flex;gap:24px;align-items:center;">
          <div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">Comisión generada esta semana</div>
            <div style="font-size:24px;font-weight:800;color:#dc2626;">${fmt(unliqComm)}</div>
          </div>
          <div style="margin-left:auto;background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:10px 16px;text-align:right;">
            <div style="font-size:12px;color:#991b1b;font-weight:600;">Pendiente de cobro por el operario</div>
            <div style="font-size:18px;font-weight:800;color:#991b1b;margin-top:2px;">${fmt(unliqComm)}</div>
          </div>
        </div>
      </div>`

  // ── Summary rows ─────────────────────────────────────────────────────────────
  const weekPieces = Number(w.week_pieces ?? 0)
  const commLabel  = isPintura
    ? `${weekPieces} pieza${weekPieces !== 1 ? 's' : ''} × $90.000`
    : isLatoneria
    ? `Pago acordado al operario de latonería`
    : `Comision del operario (${rate}%)`

  const summaryRows = `
    <tr style="background:#f9f9f9;border-top:2px solid #e5e5e5;">
      <td style="padding:7px 10px;font-size:13px;color:#555;"><strong>Total bruto semana</strong></td>
      <td style="padding:7px 10px;text-align:right;font-size:14px;font-weight:700;">${fmt(w.week_gross)}</td>
      <td style="padding:7px 10px;text-align:right;font-size:13px;color:#888;font-style:italic;">—</td>
    </tr>
    <tr style="background:#f9f9f9;">
      <td style="padding:4px 10px;font-size:13px;color:#555;">${commLabel}</td>
      <td style="padding:4px 10px;text-align:right;font-size:13px;color:#888;font-style:italic;">—</td>
      <td style="padding:4px 10px;text-align:right;font-size:14px;font-weight:700;color:#d97706;">${fmt(w.week_commission)}</td>
    </tr>`

  const commColHeader = isPintura ? 'Piezas / Comision' : isLatoneria ? 'Pago operario' : 'Comision'

  return `
    <div style="margin-bottom:32px;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
      <div style="background:#1a1a1a;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;font-size:13px;">${fmtDate(w.week_start)} &nbsp;–&nbsp; ${fmtDate(w.week_end)}</span>
        ${badge}
      </div>
      ${weekOrders.length === 0
        ? '<p style="padding:12px 14px;color:#aaa;font-size:13px;">Sin servicios</p>'
        : `<table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#333;color:#fff;">
                <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Servicio</th>
                <th style="padding:7px 10px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Precio total</th>
                <th style="padding:7px 10px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#fbbf24;">${commColHeader}</th>
              </tr>
            </thead>
            <tbody>${serviceRows}${summaryRows}</tbody>
          </table>`}
      ${estadoPago}
    </div>`
}

// ── Main export ──────────────────────────────────────────────────────────────

export function buildReportHtml(r: ApiReportResponse): string {
  const today     = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  const rate        = Number(r.commission_rate)
  const isPintura   = r.operator_type === 'pintura'
  const isLatoneria = r.operator_type === 'latoneria'

  const weekSections = r.week_statuses
    .filter(w => Number(w.week_gross) > 0 || w.is_liquidated)
    .map(w => buildWeekSection(w, r, rate, isPintura, isLatoneria))
    .join('')

  const debtRows = r.pending_debts.map(d =>
    `<tr>
      <td style="padding:6px 10px;font-size:13px;">${escapeHtml(d.description || '—')}</td>
      <td style="padding:6px 10px;text-align:right;font-size:13px;">${fmt(d.amount)}</td>
      <td style="padding:6px 10px;text-align:right;font-size:13px;color:#888;">${fmt(d.paid_amount)}</td>
      <td style="padding:6px 10px;text-align:right;font-size:13px;font-weight:600;color:#dc2626;">${fmt(d.remaining)}</td>
    </tr>`
  ).join('')

  const opSubtitle = isPintura
    ? `Tarifa: $90.000/pieza`
    : isLatoneria
    ? `Pago por servicio acordado`
    : `Comision: ${rate}%`
  const opCommDetail = isPintura
    ? `${Number(r.total_pieces ?? 0)} piezas · Comision: ${fmt(r.commission_amount)}`
    : isLatoneria
    ? `Total pago operario: ${fmt(r.commission_amount)}`
    : `Comision: ${fmt(r.commission_amount)}`
  const totalCommLabel = isPintura
    ? `${Number(r.total_pieces ?? 0)} piezas × $90.000/pieza`
    : isLatoneria
    ? `Total pago acordado (latonería)`
    : `Comision total (${rate}%)`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Liquidacion - ${escapeHtml(r.operator_name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; background: #fff; padding: 32px; max-width: 860px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 700; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #222; }
  .logo { font-size: 20px; font-weight: 800; color: #d97706; letter-spacing: -0.5px; }
  .meta { font-size: 12px; color: #888; margin-top: 4px; }
  .op-card { display: flex; justify-content: space-between; align-items: center; background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px 18px; margin-bottom: 28px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 12px; }
  .totals-box { display: flex; justify-content: flex-end; margin-top: 4px; margin-bottom: 28px; }
  .totals-box table { width: 320px; border-collapse: collapse; }
  .totals-box td { padding: 6px 12px; font-size: 14px; }
  .totals-box tr.grand td { font-weight: 700; font-size: 16px; border-top: 2px solid #d97706; color: #d97706; padding-top: 10px; }
  .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-top: 16px; font-size: 13px; color: #dc2626; }
  .debts-table { width: 100%; border-collapse: collapse; }
  .debts-table th { background: #222; color: #fff; padding: 8px 10px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
  .debts-table td { padding: 6px 10px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  .footer { margin-top: 32px; font-size: 11px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body onload="window.print()">

<div class="header">
  <div>
    <div class="logo">BDCPolo</div>
    <div class="meta">Bogota Detailing Center</div>
  </div>
  <div style="text-align:right;">
    <h1>Liquidacion de Operario</h1>
    <div class="meta">${escapeHtml(r.period_label)}</div>
    <div class="meta">${escapeHtml(r.date_start)} al ${escapeHtml(r.date_end)} &nbsp;·&nbsp; Generado el ${today}</div>
  </div>
</div>

<div class="op-card">
  <div>
    <div style="font-size:16px;font-weight:700;">${escapeHtml(r.operator_name)}</div>
    <div style="font-size:13px;color:#666;margin-top:3px;">${opSubtitle} &nbsp;·&nbsp; ${r.total_services} servicio${r.total_services !== 1 ? 's' : ''} en el periodo</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:12px;color:#888;">Total bruto</div>
    <div style="font-size:18px;font-weight:700;">${fmt(r.gross_total)}</div>
    <div style="font-size:12px;color:#d97706;font-weight:600;">${opCommDetail}</div>
  </div>
</div>

<div class="section-title">Detalle por semana</div>
${weekSections || '<p style="color:#aaa;font-size:13px;margin-bottom:24px;">Sin actividad en este periodo.</p>'}

<div class="totals-box">
  <table>
    <tr>
      <td style="color:#888;">Total bruto del periodo</td>
      <td style="text-align:right;font-weight:600;">${fmt(r.gross_total)}</td>
    </tr>
    <tr>
      <td style="color:#888;">${totalCommLabel}</td>
      <td style="text-align:right;font-weight:600;color:#d97706;">${fmt(r.commission_amount)}</td>
    </tr>
    ${Number(r.total_pending_owed) > 0 ? `<tr>
      <td style="color:#dc2626;font-weight:600;">+ Deudas empresa pendientes</td>
      <td style="text-align:right;color:#dc2626;font-weight:600;">${fmt(r.total_pending_owed)}</td>
    </tr>` : ''}
    <tr class="grand">
      <td>Total a favor del operario</td>
      <td style="text-align:right;">${fmt(Number(r.commission_amount) + Number(r.total_pending_owed))}</td>
    </tr>
  </table>
</div>

${r.pending_debts.length > 0 ? `
<div style="margin-bottom:28px;">
  <div class="section-title">Deudas de la empresa pendientes al operario</div>
  <table class="debts-table">
    <thead>
      <tr>
        <th style="text-align:left;">Descripcion</th>
        <th style="text-align:right;">Total deuda</th>
        <th style="text-align:right;">Ya pagado</th>
        <th style="text-align:right;">Pendiente</th>
      </tr>
    </thead>
    <tbody>${debtRows}</tbody>
    <tfoot>
      <tr style="border-top:2px solid #222;">
        <td colspan="3" style="padding:8px 10px;text-align:right;font-weight:700;font-size:13px;">Total pendiente</td>
        <td style="padding:8px 10px;text-align:right;font-weight:700;font-size:14px;color:#dc2626;">${fmt(r.total_pending_owed)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="alert">La empresa le debe al operario <strong>${fmt(r.total_pending_owed)}</strong> en deudas pendientes.</div>
</div>` : ''}

<div class="footer">Bogota Detailing Center · BDCPolo · Comprobante interno de liquidacion</div>
</body>
</html>`
}
