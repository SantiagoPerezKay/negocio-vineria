import { useState, useEffect, useCallback, useRef } from "react";
import { presupuestosAPI, stockAPI, clientesAPI, cajaAPI } from "../api";
import { Plus, Trash2, Edit2, CheckCircle, XCircle, ShoppingCart, Printer } from "lucide-react";
import Modal from "../components/Modal";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const ESTADO_CONFIG = {
  pendiente:  { color: "var(--warning)", label: "Pendiente" },
  aprobado:   { color: "var(--success)", label: "Aprobado" },
  rechazado:  { color: "var(--danger)",  label: "Rechazado" },
  convertido: { color: "var(--info)",    label: "Convertido" },
};

export default function Presupuestos() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cajaActual, setCajaActual] = useState(null);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  // Formulario
  const [formCliente, setFormCliente] = useState({ id: "", nombre: "" });
  const [formNotas, setFormNotas] = useState("");
  const [formValidez, setFormValidez] = useState("");
  const [formDescuento, setFormDescuento] = useState("");
  const [detalles, setDetalles] = useState([]);
  const [inputItem, setInputItem] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const sugRef = useRef(null);

  const cerrarModal = useCallback(() => setModal(null), []);

  const cargar = async () => {
    const [presR, prodsR, cliR, cajaR] = await Promise.all([
      presupuestosAPI.listar(),
      stockAPI.productos({ activo: true }),
      clientesAPI.listar(),
      cajaAPI.actual(),
    ]);
    setPresupuestos(presR.data);
    setProductos(prodsR.data);
    setClientes(cliR.data);
    setCajaActual(cajaR.data);
  };

  useEffect(() => { cargar(); }, []);

  const handleInputItem = (val) => {
    setInputItem(val);
    if (val.trim().length >= 1) {
      const term = norm(val.trim());
      const matches = productos.filter((p) => norm(p.nombre).includes(term)).slice(0, 5);
      setSugerencias(matches);
      setShowSug(true);
    } else { setShowSug(false); }
  };

  const addProducto = (p) => {
    setDetalles((prev) => {
      const ex = prev.find((d) => d.producto_id === p.id);
      if (ex) return prev.map((d) => d.producto_id === p.id ? { ...d, cantidad: d.cantidad + 1 } : d);
      return [...prev, { producto_id: p.id, descripcion: p.nombre, cantidad: 1, precio_unitario: parseFloat(p.precio_venta), descuento_porcentaje: 0 }];
    });
    setInputItem(""); setShowSug(false);
  };

  const addLibre = () => {
    if (!inputItem.trim()) return;
    setDetalles((p) => [...p, { producto_id: null, descripcion: inputItem.trim(), cantidad: 1, precio_unitario: 0, descuento_porcentaje: 0 }]);
    setInputItem(""); setShowSug(false);
  };

  const updateDetalle = (i, key, val) => {
    setDetalles((prev) => prev.map((d, j) => j === i ? { ...d, [key]: parseFloat(val) || 0 } : d));
  };

  const subtotalDetalle = (d) => d.cantidad * d.precio_unitario * (1 - d.descuento_porcentaje / 100);
  const subtotalBruto = detalles.reduce((s, d) => s + subtotalDetalle(d), 0);
  const descuentoGlobal = parseFloat(formDescuento) || 0;
  const totalFinal = Math.max(0, subtotalBruto - descuentoGlobal);

  const guardar = async () => {
    if (detalles.length === 0) return;
    setSaving(true);
    try {
      await presupuestosAPI.crear({
        cliente_id: formCliente.id ? parseInt(formCliente.id) : null,
        cliente_nombre: formCliente.nombre || null,
        notas: formNotas || null,
        descuento_monto: descuentoGlobal,
        fecha_validez: formValidez || null,
        detalles: detalles.map((d) => ({
          producto_id: d.producto_id,
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          descuento_porcentaje: d.descuento_porcentaje,
        })),
      });
      setModal(null);
      cargar();
    } finally { setSaving(false); }
  };

  const convertir = async (p) => {
    if (!confirm(`¿Convertir presupuesto #${p.id} a venta?`)) return;
    try {
      await presupuestosAPI.convertir(p.id, cajaActual?.id);
      cargar();
    } catch (e) { alert(e.response?.data?.detail || "Error"); }
  };

  const cambiarEstado = async (p, estado) => {
    await presupuestosAPI.actualizarEstado(p.id, estado);
    cargar();
  };

  const eliminar = async (p) => {
    if (!confirm("¿Eliminar presupuesto?")) return;
    await presupuestosAPI.eliminar(p.id);
    cargar();
  };

  const abrirNuevo = () => {
    setFormCliente({ id: "", nombre: "" });
    setFormNotas(""); setFormValidez(""); setFormDescuento("");
    setDetalles([]);
    setModal("nuevo");
  };

  const verDetalle = (p) => { setSelected(p); setModal("detalle"); };

  const imprimirPresupuesto = (p) => {
    const win = window.open("", "_blank");
    const items = p.detalles?.map((d) => `
      <tr>
        <td>${d.descripcion || ""}</td>
        <td style="text-align:center">${d.cantidad}</td>
        <td style="text-align:right">${fmt(d.precio_unitario)}</td>
        ${d.descuento_porcentaje > 0 ? `<td style="text-align:center">${d.descuento_porcentaje}%</td>` : "<td>—</td>"}
        <td style="text-align:right">${fmt(d.subtotal)}</td>
      </tr>`).join("") || "";
    win.document.write(`
      <html><head><title>Presupuesto #${p.id}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;max-width:600px;margin:0 auto}
      h1{font-size:1.4rem}table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{padding:8px 12px;border:1px solid #ddd;font-size:0.9rem}th{background:#f5f5f5}
      .total{font-size:1.2rem;font-weight:bold;text-align:right;margin-top:12px}
      @media print{button{display:none}}</style></head><body>
      <h1>Presupuesto #${p.id}</h1>
      <p><b>Fecha:</b> ${new Date(p.fecha).toLocaleDateString("es-AR")}</p>
      ${p.cliente_nombre || p.cliente?.nombre ? `<p><b>Cliente:</b> ${p.cliente_nombre || p.cliente?.nombre}</p>` : ""}
      ${p.fecha_validez ? `<p><b>Válido hasta:</b> ${new Date(p.fecha_validez).toLocaleDateString("es-AR")}</p>` : ""}
      <table><thead><tr><th>Descripción</th><th>Cant.</th><th>P. Unit.</th><th>Desc.</th><th>Subtotal</th></tr></thead>
      <tbody>${items}</tbody></table>
      ${p.descuento_monto > 0 ? `<p class="total">Descuento: -${fmt(p.descuento_monto)}</p>` : ""}
      <p class="total">TOTAL: ${fmt(p.total)}</p>
      ${p.notas ? `<p style="margin-top:16px;color:#666"><i>${p.notas}</i></p>` : ""}
      <br><button onclick="window.print()">Imprimir</button>
      </body></html>`);
    win.document.close();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Presupuestos</h2>
          <p className="page-sub">{presupuestos.length} presupuestos</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <Plus size={16} /> Nuevo presupuesto
        </button>
      </div>

      <div className="table-wrap hide-mobile">
        <table>
          <thead>
            <tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {presupuestos.length === 0 && <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 32 }}>Sin presupuestos</td></tr>}
            {presupuestos.map((p) => {
              const cfg = ESTADO_CONFIG[p.estado] || ESTADO_CONFIG.pendiente;
              return (
                <tr key={p.id}>
                  <td className="text-muted">#{p.id}</td>
                  <td className="text-muted">{new Date(p.fecha).toLocaleDateString("es-AR")}</td>
                  <td>{p.cliente_nombre || p.cliente?.nombre || <span className="text-muted">—</span>}</td>
                  <td className="money font-bold">{fmt(p.total)}</td>
                  <td><span className="badge" style={{ background: `${cfg.color}20`, color: cfg.color }}>{cfg.label}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(p)} title="Ver"><Edit2 size={13} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => imprimirPresupuesto(p)} title="Imprimir"><Printer size={13} /></button>
                      {p.estado === "pendiente" && <>
                        <button className="btn btn-success btn-sm" onClick={() => cambiarEstado(p, "aprobado")} title="Aprobar"><CheckCircle size={13} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => cambiarEstado(p, "rechazado")} title="Rechazar"><XCircle size={13} /></button>
                      </>}
                      {(p.estado === "aprobado") && (
                        <button className="btn btn-primary btn-sm" onClick={() => convertir(p)} title="Convertir a venta"><ShoppingCart size={13} /></button>
                      )}
                      {p.estado !== "convertido" && <button className="btn btn-danger btn-sm" onClick={() => eliminar(p)}><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="show-mobile">
        {presupuestos.map((p) => {
          const cfg = ESTADO_CONFIG[p.estado] || ESTADO_CONFIG.pendiente;
          return (
            <div key={p.id} className="card card-sm mb-3">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <span className="text-muted" style={{ fontSize: "0.75rem" }}>#{p.id} · {new Date(p.fecha).toLocaleDateString("es-AR")}</span>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{p.cliente_nombre || p.cliente?.nombre || "Sin cliente"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="money font-bold">{fmt(p.total)}</div>
                  <span className="badge" style={{ background: `${cfg.color}20`, color: cfg.color, fontSize: "0.7rem" }}>{cfg.label}</span>
                </div>
              </div>
              <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(p)}>Ver</button>
                <button className="btn btn-ghost btn-sm" onClick={() => imprimirPresupuesto(p)}><Printer size={12} /></button>
                {p.estado === "pendiente" && <button className="btn btn-success btn-sm" onClick={() => cambiarEstado(p, "aprobado")}>Aprobar</button>}
                {p.estado === "aprobado" && <button className="btn btn-primary btn-sm" onClick={() => convertir(p)}>→ Venta</button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal nuevo */}
      <Modal open={modal === "nuevo"} onClose={cerrarModal} title="Nuevo presupuesto" wide>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Cliente registrado (opcional)</label>
              <select className="form-select" value={formCliente.id} onChange={(e) => setFormCliente((p) => ({ ...p, id: e.target.value }))}>
                <option value="">Sin cliente</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre libre</label>
              <input className="form-input" placeholder="ej: Juan García" value={formCliente.nombre} onChange={(e) => setFormCliente((p) => ({ ...p, nombre: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Válido hasta</label>
              <input type="date" className="form-input" value={formValidez} onChange={(e) => setFormValidez(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Descuento global ($)</label>
              <input type="number" className="form-input" placeholder="0" value={formDescuento} onChange={(e) => setFormDescuento(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-group mb-4" style={{ position: "relative" }}>
          <label className="form-label">Agregar ítem</label>
          <div className="flex gap-2">
            <input className="form-input" placeholder="Buscar producto o escribir libre..." value={inputItem} onChange={(e) => handleInputItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLibre()} />
            <button className="btn btn-ghost btn-sm" onClick={addLibre}><Plus size={15} /></button>
          </div>
          {showSug && sugerencias.length > 0 && (
            <div ref={sugRef} className="autocomplete-dropdown">
              {sugerencias.map((p) => (
                <button key={p.id} className="autocomplete-item" onClick={() => addProducto(p)}>
                  <span style={{ fontWeight: 500 }}>{p.nombre}</span>
                  <span className="money text-success" style={{ fontSize: "0.8rem" }}>{fmt(p.precio_venta)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {detalles.length > 0 && (
          <div className="table-wrap mb-4">
            <table>
              <thead><tr><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Desc.%</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {detalles.map((d, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: "0.85rem" }}>{d.descripcion}</td>
                    <td><input type="number" className="form-input" style={{ width: 64, padding: "4px 8px", fontSize: "0.8rem" }} value={d.cantidad} onChange={(e) => updateDetalle(i, "cantidad", e.target.value)} /></td>
                    <td><input type="number" className="form-input" style={{ width: 90, padding: "4px 8px", fontSize: "0.8rem" }} value={d.precio_unitario} onChange={(e) => updateDetalle(i, "precio_unitario", e.target.value)} /></td>
                    <td><input type="number" className="form-input" style={{ width: 60, padding: "4px 8px", fontSize: "0.8rem" }} value={d.descuento_porcentaje} onChange={(e) => updateDetalle(i, "descuento_porcentaje", e.target.value)} /></td>
                    <td className="money text-success" style={{ fontSize: "0.85rem" }}>{fmt(subtotalDetalle(d))}</td>
                    <td><button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }} onClick={() => setDetalles((p) => p.filter((_, j) => j !== i))}><Trash2 size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-between items-center" style={{ padding: "12px 0", borderTop: "1px solid var(--border)", fontWeight: 700, fontSize: "1.1rem" }}>
          <span>Total</span>
          <span className="money text-success">{fmt(totalFinal)}</span>
        </div>

        <div className="form-group mb-4">
          <label className="form-label">Notas</label>
          <input className="form-input" placeholder="Observaciones..." value={formNotas} onChange={(e) => setFormNotas(e.target.value)} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving || detalles.length === 0}>
            {saving ? "Guardando..." : "Crear presupuesto"}
          </button>
        </div>
      </Modal>

      {/* Modal detalle */}
      <Modal open={modal === "detalle" && !!selected} onClose={cerrarModal} title={`Presupuesto #${selected?.id}`} wide>
        {selected && (
          <>
            <div className="grid-2 mb-4">
              <div className="stat-card card-sm">
                <div className="stat-label">Total</div>
                <div className="stat-value money text-success" style={{ fontSize: "1.4rem" }}>{fmt(selected.total)}</div>
              </div>
              <div className="stat-card card-sm">
                <div className="stat-label">Estado</div>
                <div style={{ fontWeight: 700, color: ESTADO_CONFIG[selected.estado]?.color }}>{ESTADO_CONFIG[selected.estado]?.label}</div>
              </div>
            </div>
            {selected.detalles?.map((d, i) => (
              <div key={i} className="flex justify-between" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "0.875rem" }}>
                <span>{d.descripcion} × {d.cantidad}</span>
                <span className="money">{fmt(d.subtotal)}</span>
              </div>
            ))}
            {selected.notas && <p className="text-muted" style={{ marginTop: 12, fontSize: "0.85rem" }}>{selected.notas}</p>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={cerrarModal}>Cerrar</button>
              <button className="btn btn-ghost" onClick={() => imprimirPresupuesto(selected)}><Printer size={14} /> Imprimir</button>
              {selected.estado === "aprobado" && (
                <button className="btn btn-primary" onClick={() => { setModal(null); convertir(selected); }}><ShoppingCart size={14} /> Convertir a venta</button>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
