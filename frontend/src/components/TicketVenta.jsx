/**
 * TicketVenta — abre una ventana emergente con el comprobante listo para imprimir.
 * No es un modal visible en la app; se llama como función.
 */

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

export function imprimirTicket(venta) {
  if (!venta) return;

  const detalles = venta.detalles?.length
    ? venta.detalles.map((d) => `
        <tr>
          <td>${d.descripcion || "—"}</td>
          <td style="text-align:center">${d.cantidad}</td>
          <td style="text-align:right">${fmt(d.precio_unitario)}</td>
          <td style="text-align:right">${fmt(d.subtotal)}</td>
        </tr>`).join("")
    : `<tr><td colspan="4">${venta.detalle_libre || "Venta"}</td></tr>`;

  const metodos = [
    ["Efectivo", venta.efectivo],
    ["Transferencia", venta.transferencia],
    ["Tarjeta", venta.tarjeta],
    ["Seña", venta.seña],
    ["Fiado", venta.fiado],
  ].filter(([, v]) => parseFloat(v) > 0);

  const hora = new Date(venta.fecha || Date.now()).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const win = window.open("", "_blank", "width=420,height=600");
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket #${venta.id || ""}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 13px;
      padding: 16px;
      max-width: 380px;
      margin: 0 auto;
      color: #111;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border: none; border-top: 1px dashed #999; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 11px; text-transform: uppercase; padding: 4px 2px; border-bottom: 1px solid #ccc; text-align: left; }
    td { padding: 4px 2px; font-size: 12px; }
    td:nth-child(2), td:nth-child(3), td:nth-child(4),
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
    .total-row { font-size: 16px; font-weight: bold; border-top: 2px solid #111; padding-top: 8px; margin-top: 4px; }
    .footer { margin-top: 16px; font-size: 11px; color: #666; }
    .btn-print { margin-top: 16px; padding: 8px 20px; font-size: 14px; cursor: pointer; display: block; width: 100%; }
    @media print {
      .btn-print { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="center">
    <p class="bold" style="font-size:16px">🍷 VINERÍA</p>
    <p style="font-size:11px; color:#666; margin-top:2px">Sistema de gestión</p>
  </div>
  <hr class="divider">
  <p><b>Comprobante #${venta.id || "—"}</b></p>
  <p style="font-size:11px; color:#555">${hora}</p>
  ${venta.cliente?.nombre ? `<p style="font-size:12px; margin-top:4px">Cliente: <b>${venta.cliente.nombre}</b></p>` : ""}
  <hr class="divider">
  <table>
    <thead><tr><th>Descripción</th><th>Cant</th><th>P.Unit</th><th>Total</th></tr></thead>
    <tbody>${detalles}</tbody>
  </table>
  <hr class="divider">
  ${metodos.map(([m, v]) => `
    <div class="flex" style="display:flex;justify-content:space-between;padding:2px 0">
      <span>${m}</span><span><b>${fmt(v)}</b></span>
    </div>`).join("")}
  <div class="total-row" style="display:flex;justify-content:space-between;margin-top:8px">
    <span>TOTAL</span><span>${fmt(venta.total)}</span>
  </div>
  ${venta.descuento_monto > 0 ? `<p style="color:#e66;font-size:12px;margin-top:4px">Descuento aplicado: -${fmt(venta.descuento_monto)}</p>` : ""}
  <hr class="divider">
  <p class="footer center">¡Gracias por su compra!</p>
  <button class="btn-print" onclick="window.print(); window.close();">🖨️ Imprimir</button>
</body>
</html>`);
  win.document.close();
}
