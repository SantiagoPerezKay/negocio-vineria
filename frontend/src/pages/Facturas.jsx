import { useState, useEffect, useCallback } from "react";
import { facturasAPI, clientesAPI, ventasAPI } from "../api";
import { Plus, Printer, XCircle, Loader, FileText } from "lucide-react";
import Modal from "../components/Modal";
import { imprimirFactura } from "../components/TicketFactura";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n || 0);

const TIPOS_FACTURA = ["A", "B", "C"];
const CONDICIONES_IVA = ["Responsable Inscripto", "Monotributista", "Consumidor Final", "Exento"];
const METODOS_PAGO = ["efectivo", "transferencia", "tarjeta", "cheque"];

export default function Facturas() {
  const [facturas, setFacturas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [form, setForm] = useState({
    tipo: "B",
    venta_id: "",
    cliente_id: "",
    cliente_nombre: "",
    cliente_cuit: "",
    cliente_direccion: "",
    cliente_condicion_iva: "Consumidor Final",
    iva_porcentaje: "21",
    metodo_pago: "efectivo",
    notas: "",
  });

  const [detalles, setDetalles] = useState([{ descripcion: "", cantidad: "1", precio_unitario: "" }]);

  const cerrarModal = useCallback(() => setShowModal(false), []);

  const cargar = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtroTipo) params.tipo = filtroTipo;
      if (filtroDesde) params.fecha_desde = filtroDesde;
      if (filtroHasta) params.fecha_hasta = filtroHasta;
      const [factsR, clientsR] = await Promise.all([
        facturasAPI.listar(params),
        clientesAPI.listar(),
      ]);
      setFacturas(factsR.data);
      setClientes(clientsR.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [filtroTipo, filtroDesde, filtroHasta]);

  const addDetalle = () => {
    setDetalles((p) => [...p, { descripcion: "", cantidad: "1", precio_unitario: "" }]);
  };

  const removeDetalle = (i) => {
    setDetalles((p) => p.filter((_, j) => j !== i));
  };

  const updateDetalle = (i, field, val) => {
    setDetalles((p) => p.map((d, j) => j === i ? { ...d, [field]: val } : d));
  };

  const subtotal = detalles.reduce((s, d) => s + (parseFloat(d.cantidad) || 0) * (parseFloat(d.precio_unitario) || 0), 0);
  const ivaPct = parseFloat(form.iva_porcentaje) || 0;
  const ivaMonto = subtotal * ivaPct / 100;
  const total = subtotal + ivaMonto;

  const handleClienteSelect = (id) => {
    setForm((p) => ({ ...p, cliente_id: id }));
    if (id) {
      const cl = clientes.find((c) => c.id === parseInt(id));
      if (cl) {
        setForm((p) => ({ ...p, cliente_nombre: cl.nombre, cliente_id: id }));
      }
    }
  };

  const abrirNuevaFactura = () => {
    setForm({
      tipo: "B",
      venta_id: "",
      cliente_id: "",
      cliente_nombre: "",
      cliente_cuit: "",
      cliente_direccion: "",
      cliente_condicion_iva: "Consumidor Final",
      iva_porcentaje: "21",
      metodo_pago: "efectivo",
      notas: "",
    });
    setDetalles([{ descripcion: "", cantidad: "1", precio_unitario: "" }]);
    setShowModal(true);
  };

  const guardarFactura = async () => {
    const detallesValidos = detalles.filter((d) => d.descripcion && d.precio_unitario);
    if (detallesValidos.length === 0 && !form.venta_id) {
      alert("Debe agregar al menos un ítem a la factura");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tipo: form.tipo,
        venta_id: form.venta_id ? parseInt(form.venta_id) : null,
        cliente_id: form.cliente_id ? parseInt(form.cliente_id) : null,
        cliente_nombre: form.cliente_nombre || null,
        cliente_cuit: form.cliente_cuit || null,
        cliente_direccion: form.cliente_direccion || null,
        cliente_condicion_iva: form.cliente_condicion_iva || null,
        iva_porcentaje: parseFloat(form.iva_porcentaje) || 21,
        metodo_pago: form.metodo_pago || null,
        notas: form.notas || null,
        detalles: form.venta_id ? [] : detallesValidos.map((d) => ({
          descripcion: d.descripcion,
          cantidad: parseFloat(d.cantidad) || 1,
          precio_unitario: parseFloat(d.precio_unitario) || 0,
        })),
      };
      await facturasAPI.crear(payload);
      setShowModal(false);
      cargar();
    } finally {
      setSaving(false);
    }
  };

  const anularFactura = async (id) => {
    if (!confirm("¿Anular esta factura?")) return;
    await facturasAPI.anular(id);
    cargar();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Facturación</h2>
          <p className="page-sub">{facturas.length} facturas emitidas</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevaFactura}>
          <Plus size={16} /> <span className="btn-label">Nueva factura</span>
        </button>
      </div>

      <div className="flex gap-4 mb-6" style={{ flexWrap: "wrap" }}>
        <select className="form-select" style={{ width: 150 }} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS_FACTURA.map((t) => <option key={t} value={t}>Factura {t}</option>)}
        </select>
        <input type="date" className="form-input" style={{ width: 160 }} value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} placeholder="Desde" />
        <input type="date" className="form-input" style={{ width: 160 }} value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} placeholder="Hasta" />
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Loader size={32} className="text-muted spin" />
        </div>
      ) : (
        <>
          <div className="table-wrap hide-mobile">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>CUIT</th>
                  <th>Subtotal</th>
                  <th>IVA</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {facturas.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-muted" style={{ padding: 32 }}>Sin facturas emitidas</td></tr>
                )}
                {facturas.map((f) => (
                  <tr key={f.id} style={{ opacity: f.anulada ? 0.4 : 1 }}>
                    <td className="font-mono" style={{ fontSize: "0.8rem" }}>{f.numero}</td>
                    <td><span className={`badge ${f.tipo === "A" ? "badge-info" : f.tipo === "B" ? "badge-success" : "badge-warning"}`}>Factura {f.tipo}</span></td>
                    <td className="text-muted">{new Date(f.fecha).toLocaleDateString("es-AR")}</td>
                    <td>{f.cliente_nombre || f.cliente?.nombre || "—"}</td>
                    <td className="text-muted font-mono" style={{ fontSize: "0.8rem" }}>{f.cliente_cuit || "—"}</td>
                    <td className="money">{fmt(f.subtotal)}</td>
                    <td className="money text-muted">{fmt(f.iva_monto)}</td>
                    <td className="money font-bold text-success">{fmt(f.total)}</td>
                    <td className="text-muted">{f.metodo_pago || "—"}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-sm" onClick={() => imprimirFactura(f)} title="Imprimir">
                          <Printer size={13} />
                        </button>
                        {!f.anulada && (
                          <button className="btn btn-ghost btn-sm" onClick={() => anularFactura(f.id)} title="Anular">
                            <XCircle size={13} />
                          </button>
                        )}
                        {f.anulada && <span className="badge badge-danger">ANULADA</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="show-mobile">
            {facturas.length === 0 && <p className="text-center text-muted" style={{ padding: 24 }}>Sin facturas emitidas</p>}
            {facturas.map((f) => (
              <div key={f.id} className="card card-sm mb-3" style={{ opacity: f.anulada ? 0.4 : 1 }}>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className={`badge ${f.tipo === "A" ? "badge-info" : f.tipo === "B" ? "badge-success" : "badge-warning"}`}>Factura {f.tipo}</span>
                    <span className="font-mono text-muted" style={{ fontSize: "0.75rem", marginLeft: 8 }}>{f.numero}</span>
                  </div>
                  <span className="money font-bold text-success">{fmt(f.total)}</span>
                </div>
                <div style={{ fontSize: "0.8rem" }} className="text-muted">
                  {f.cliente_nombre || "—"} · {new Date(f.fecha).toLocaleDateString("es-AR")}
                </div>
                <div className="flex gap-2 mt-2">
                  <button className="btn btn-ghost btn-sm" onClick={() => imprimirFactura(f)}><Printer size={12} /> Imprimir</button>
                  {!f.anulada && <button className="btn btn-ghost btn-sm" onClick={() => anularFactura(f.id)}><XCircle size={12} /> Anular</button>}
                  {f.anulada && <span className="badge badge-danger">ANULADA</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={showModal} onClose={cerrarModal} title="Nueva factura">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "65vh", overflowY: "auto" }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Tipo de factura</label>
              <select className="form-select" value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}>
                {TIPOS_FACTURA.map((t) => <option key={t} value={t}>Factura {t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Desde venta # (opcional)</label>
              <input type="number" className="form-input" placeholder="ID de venta" value={form.venta_id} onChange={(e) => setForm((p) => ({ ...p, venta_id: e.target.value }))} />
            </div>
          </div>

          <hr className="divider" />
          <h4 style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text2)" }}>Datos del cliente</h4>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Cliente registrado</label>
              <select className="form-select" value={form.cliente_id} onChange={(e) => handleClienteSelect(e.target.value)}>
                <option value="">Seleccionar...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre / Razón social</label>
              <input className="form-input" value={form.cliente_nombre} onChange={(e) => setForm((p) => ({ ...p, cliente_nombre: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">CUIT</label>
              <input className="form-input font-mono" placeholder="XX-XXXXXXXX-X" value={form.cliente_cuit} onChange={(e) => setForm((p) => ({ ...p, cliente_cuit: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Condición IVA</label>
              <select className="form-select" value={form.cliente_condicion_iva} onChange={(e) => setForm((p) => ({ ...p, cliente_condicion_iva: e.target.value }))}>
                {CONDICIONES_IVA.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Dirección</label>
            <input className="form-input" value={form.cliente_direccion} onChange={(e) => setForm((p) => ({ ...p, cliente_direccion: e.target.value }))} />
          </div>

          {!form.venta_id && (
            <>
              <hr className="divider" />
              <div className="flex justify-between items-center">
                <h4 style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text2)" }}>Ítems</h4>
                <button className="btn btn-ghost btn-sm" onClick={addDetalle}><Plus size={14} /> Agregar ítem</button>
              </div>

              {detalles.map((d, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 100px 30px", gap: 8, alignItems: "end" }}>
                  <div className="form-group">
                    {i === 0 && <label className="form-label">Descripción</label>}
                    <input className="form-input" placeholder="Descripción del producto" value={d.descripcion} onChange={(e) => updateDetalle(i, "descripcion", e.target.value)} />
                  </div>
                  <div className="form-group">
                    {i === 0 && <label className="form-label">Cant.</label>}
                    <input type="number" className="form-input" value={d.cantidad} onChange={(e) => updateDetalle(i, "cantidad", e.target.value)} />
                  </div>
                  <div className="form-group">
                    {i === 0 && <label className="form-label">Precio</label>}
                    <input type="number" className="form-input" placeholder="$" value={d.precio_unitario} onChange={(e) => updateDetalle(i, "precio_unitario", e.target.value)} />
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "6px", marginBottom: 2 }} onClick={() => removeDetalle(i)} title="Quitar">×</button>
                </div>
              ))}
            </>
          )}

          <hr className="divider" />
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">IVA %</label>
              <input type="number" className="form-input" value={form.iva_porcentaje} onChange={(e) => setForm((p) => ({ ...p, iva_porcentaje: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Método de pago</label>
              <select className="form-select" value={form.metodo_pago} onChange={(e) => setForm((p) => ({ ...p, metodo_pago: e.target.value }))}>
                {METODOS_PAGO.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notas</label>
            <input className="form-input" value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} />
          </div>

          {!form.venta_id && (
            <div style={{ background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: 12, border: "1px solid var(--border)" }}>
              <div className="flex justify-between" style={{ fontSize: "0.85rem" }}>
                <span className="text-muted">Subtotal</span><span className="money">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between" style={{ fontSize: "0.85rem" }}>
                <span className="text-muted">IVA ({ivaPct}%)</span><span className="money">{fmt(ivaMonto)}</span>
              </div>
              <div className="flex justify-between" style={{ fontSize: "1rem", fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
                <span>Total</span><span className="money text-success">{fmt(total)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardarFactura} disabled={saving}>
            {saving ? <Loader size={16} className="spin" /> : <FileText size={16} />}
            {saving ? "Emitiendo..." : "Emitir factura"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
