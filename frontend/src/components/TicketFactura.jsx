const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n || 0);

export function imprimirFactura(factura) {
  if (!factura) return;

  const detalles = factura.detalles?.length
    ? factura.detalles.map((d) => `
        <tr>
          <td>${d.descripcion || "—"}</td>
          <td style="text-align:center">${d.cantidad}</td>
          <td style="text-align:right">${fmt(d.precio_unitario)}</td>
          <td style="text-align:right">${fmt(d.subtotal)}</td>
        </tr>`).join("")
    : `<tr><td colspan="4">Sin detalles</td></tr>`;

  const fecha = new Date(factura.fecha || Date.now()).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  const win = window.open("", "_blank", "width=500,height=700");
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Factura ${factura.numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      padding: 24px;
      max-width: 460px;
      margin: 0 auto;
      color: #111;
    }
    .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 12px; }
    .header h1 { font-size: 18px; margin-bottom: 2px; }
    .header .tipo { font-size: 24px; font-weight: bold; border: 2px solid #111; display: inline-block; padding: 4px 16px; margin: 8px 0; }
    .info { margin-bottom: 12px; }
    .info p { margin: 2px 0; font-size: 12px; }
    .info .label { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { font-size: 11px; text-transform: uppercase; padding: 6px 4px; border-bottom: 1px solid #999; text-align: left; }
    td { padding: 5px 4px; font-size: 12px; border-bottom: 1px solid #eee; }
    th:nth-child(2), td:nth-child(2) { text-align: center; }
    th:nth-child(3), td:nth-child(3), th:nth-child(4), td:nth-child(4) { text-align: right; }
    .totals { border-top: 2px solid #111; padding-top: 8px; margin-top: 4px; }
    .totals .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
    .totals .total-final { font-size: 18px; font-weight: bold; border-top: 1px solid #999; padding-top: 6px; margin-top: 4px; }
    .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #666; border-top: 1px dashed #999; padding-top: 12px; }
    .btn-print { margin-top: 16px; padding: 10px 24px; font-size: 14px; cursor: pointer; display: block; width: 100%; }
    @media print { .btn-print { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>VINERÍA</h1>
    <div class="tipo">${factura.tipo}</div>
    <p style="font-size:11px; color:#666">Factura ${factura.numero}</p>
    <p style="font-size:11px; color:#666">Fecha: ${fecha}</p>
  </div>

  <div class="info">
    ${factura.cliente_nombre ? `<p><span class="label">Cliente:</span> ${factura.cliente_nombre}</p>` : ""}
    ${factura.cliente_cuit ? `<p><span class="label">CUIT:</span> ${factura.cliente_cuit}</p>` : ""}
    ${factura.cliente_condicion_iva ? `<p><span class="label">Cond. IVA:</span> ${factura.cliente_condicion_iva}</p>` : ""}
    ${factura.cliente_direccion ? `<p><span class="label">Dirección:</span> ${factura.cliente_direccion}</p>` : ""}
    ${factura.metodo_pago ? `<p><span class="label">Método de pago:</span> ${factura.metodo_pago}</p>` : ""}
  </div>

  <table>
    <thead><tr><th>Descripción</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>
    <tbody>${detalles}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${fmt(factura.subtotal)}</span></div>
    <div class="row"><span>IVA (${factura.iva_porcentaje}%)</span><span>${fmt(factura.iva_monto)}</span></div>
    <div class="row total-final"><span>TOTAL</span><span>${fmt(factura.total)}</span></div>
  </div>

  ${factura.notas ? `<p style="margin-top:12px; font-size:11px; color:#666">Notas: ${factura.notas}</p>` : ""}
  ${factura.anulada ? `<p style="margin-top:12px; color:red; font-weight:bold; text-align:center">*** FACTURA ANULADA ***</p>` : ""}

  <div class="footer">
    <p>Documento no válido como factura fiscal</p>
  </div>

  <button class="btn-print" onclick="window.print(); window.close();">🖨️ Imprimir</button>
</body>
</html>`);
  win.document.close();
}
