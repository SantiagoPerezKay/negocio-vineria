import { useState, useEffect } from "react";
import { ventasAPI, facturasAPI } from "../api";
import { Search, Download, RefreshCw, FileText } from "lucide-react";
import { imprimirFactura } from "../components/TicketFactura";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

const hoy = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

function exportCSV(ventas) {
  const rows = [
    ["ID", "Fecha", "Detalle", "Efectivo", "Transferencia", "Tarjeta", "Seña", "Fiado", "Total", "Anulada"],
    ...ventas.map((v) => [
      v.id,
      new Date(v.fecha).toLocaleString("es-AR"),
      v.detalle_libre || v.detalles?.map((d) => d.descripcion).join("; ") || "",
      v.efectivo, v.transferencia, v.tarjeta, v.seña, v.fiado, v.total,
      v.anulada ? "Sí" : "No",
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `ventas_${hoy()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function HistorialVentas() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaDesde, setFechaDesde] = useState(primerDiaMes());
  const [fechaHasta, setFechaHasta] = useState(hoy());
  const [busqueda, setBusqueda] = useState("");
  const [soloAnuladas, setSoloAnuladas] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await ventasAPI.listar({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta + "T23:59:59" });
      setVentas(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [fechaDesde, fechaHasta]);

  const filtradas = ventas.filter((v) => {
    if (soloAnuladas && !v.anulada) return false;
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    const detalle = (v.detalle_libre || v.detalles?.map((d) => d.descripcion).join(" ") || "").toLowerCase();
    return detalle.includes(term) || String(v.id).includes(term) || String(v.total).includes(term);
  });

  const totalFiltrado = filtradas.filter((v) => !v.anulada).reduce((s, v) => s + parseFloat(v.total || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Historial de ventas</h2>
          <p className="page-sub">{filtradas.length} ventas · Total: <span className="money text-success">{fmt(totalFiltrado)}</span></p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(filtradas)}>
            <Download size={14} /> Exportar CSV
          </button>
          <button className="btn btn-ghost btn-sm" onClick={cargar} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex gap-4" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: "1 1 140px" }}>
            <label className="form-label">Desde</label>
            <input type="date" className="form-input" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: "1 1 140px" }}>
            <label className="form-label">Hasta</label>
            <input type="date" className="form-input" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: "2 1 220px" }}>
            <label className="form-label">Buscar</label>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text3)" }} />
              <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Descripción, ID, monto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
          </div>
          <div style={{ paddingBottom: 2 }}>
            <label className="flex items-center gap-2" style={{ cursor: "pointer", fontSize: "0.875rem", color: "var(--text2)" }}>
              <input type="checkbox" checked={soloAnuladas} onChange={(e) => setSoloAnuladas(e.target.checked)} />
              Solo anuladas
            </label>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="table-wrap hide-mobile">
        <table>
          <thead>
            <tr><th>#</th><th>Fecha</th><th>Detalle</th><th>Efectivo</th><th>Transfer.</th><th>Tarjeta</th><th>Fiado</th><th>Total</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && <tr><td colSpan={10} className="text-center text-muted" style={{ padding: 32 }}>Sin ventas en el período</td></tr>}
            {filtradas.map((v) => (
              <tr key={v.id} style={{ opacity: v.anulada ? 0.45 : 1 }}>
                <td className="text-muted">{v.id}</td>
                <td className="text-muted" style={{ whiteSpace: "nowrap" }}>
                  {new Date(v.fecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {v.detalle_libre || v.detalles?.map((d) => d.descripcion).join(", ") || "—"}
                </td>
                <td className="text-success">{v.efectivo > 0 ? fmt(v.efectivo) : ""}</td>
                <td style={{ color: "var(--info)" }}>{v.transferencia > 0 ? fmt(v.transferencia) : ""}</td>
                <td style={{ color: "var(--primary)" }}>{v.tarjeta > 0 ? fmt(v.tarjeta) : ""}</td>
                <td className="text-danger">{v.fiado > 0 ? fmt(v.fiado) : ""}</td>
                <td className="money font-bold">{fmt(v.total)}</td>
                <td>{v.anulada ? <span className="badge badge-danger">Anulada</span> : <span className="badge badge-success">OK</span>}</td>
                <td>
                  {!v.anulada && (
                    <button className="btn btn-ghost btn-sm" title="Facturar" onClick={async () => {
                      try {
                        const r = await facturasAPI.crear({ tipo: "B", venta_id: v.id });
                        imprimirFactura(r.data);
                      } catch (e) { alert(e.response?.data?.detail || "Error al facturar"); }
                    }}>
                      <FileText size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="show-mobile">
        {filtradas.map((v) => (
          <div key={v.id} className="card card-sm mb-3" style={{ opacity: v.anulada ? 0.45 : 1 }}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                #{v.id} · {new Date(v.fecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="money font-bold text-success">{fmt(v.total)}</span>
            </div>
            <p style={{ fontSize: "0.8rem" }} className="text-muted">{v.detalle_libre || v.detalles?.map((d) => d.descripcion).join(", ") || "—"}</p>
            {v.anulada && <span className="badge badge-danger" style={{ marginTop: 4 }}>Anulada</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
