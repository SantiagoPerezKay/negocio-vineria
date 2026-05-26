import { useState, useEffect, useCallback } from "react";
import { proveedoresAPI, stockAPI } from "../api";
import { Plus, ShoppingBag, Trash2, Edit2, DollarSign } from "lucide-react";
import Modal from "../components/Modal";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [compras, setCompras] = useState([]);
  const [productos, setProductos] = useState([]);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ nombre: "", contacto: "", telefono: "", email: "", notas: "" });
  const [compraForm, setCompraForm] = useState({ proveedor_id: "", pagado: "0", notas: "", detalles: [] });
  const [detalleLine, setDetalleLine] = useState({ producto_id: "", descripcion: "", cantidad: "1", precio_costo: "" });
  const [saving, setSaving] = useState(false);
  const [pagoForm, setPagoForm] = useState({ monto: "", notas: "" });

  const cerrarModal = useCallback(() => setModal(null), []);

  const cargar = async () => {
    const [prov, comps, prods] = await Promise.all([
      proveedoresAPI.listar(),
      proveedoresAPI.listarCompras(),
      stockAPI.productos({}),
    ]);
    setProveedores(prov.data);
    setCompras(comps.data);
    setProductos(prods.data);
  };

  useEffect(() => { cargar(); }, []);

  const guardarProveedor = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      if (modal === "nuevo") await proveedoresAPI.crear(form);
      else await proveedoresAPI.actualizar(selected.id, form);
      setModal(null);
      cargar();
    } finally { setSaving(false); }
  };

  const abrirEditar = (p) => {
    setSelected(p);
    setForm({ nombre: p.nombre, contacto: p.contacto || "", telefono: p.telefono || "", email: p.email || "", notas: p.notas || "" });
    setModal("editar");
  };

  const eliminarProveedor = async (p) => {
    const msg = parseFloat(p.deuda_total) > 0
      ? `¿Eliminar a "${p.nombre}"? Tiene deuda de ${fmt(p.deuda_total)}. Esta acción no se puede deshacer.`
      : `¿Eliminar a "${p.nombre}"? Esta acción no se puede deshacer.`;
    if (!confirm(msg)) return;
    try {
      await proveedoresAPI.eliminar(p.id);
      cargar();
    } catch (e) {
      alert(e.response?.data?.detail || "Error al eliminar");
    }
  };

  const abrirPago = (p) => {
    setSelected(p);
    setPagoForm({ monto: "", notas: "" });
    setModal("pago");
  };

  const registrarPago = async () => {
    if (!pagoForm.monto) return;
    setSaving(true);
    try {
      await proveedoresAPI.registrarPago(selected.id, {
        monto: parseFloat(pagoForm.monto),
        notas: pagoForm.notas,
      });
      setModal(null);
      cargar();
    } finally { setSaving(false); }
  };

  const addDetalle = () => {
    if (!detalleLine.cantidad || !detalleLine.precio_costo) return;
    const prod = productos.find((p) => p.id === parseInt(detalleLine.producto_id));
    setCompraForm((p) => ({
      ...p,
      detalles: [...p.detalles, {
        producto_id: detalleLine.producto_id ? parseInt(detalleLine.producto_id) : null,
        descripcion: prod ? prod.nombre : detalleLine.descripcion,
        cantidad: parseFloat(detalleLine.cantidad),
        precio_costo: parseFloat(detalleLine.precio_costo),
      }],
    }));
    setDetalleLine({ producto_id: "", descripcion: "", cantidad: "1", precio_costo: "" });
  };

  const removeDetalle = (i) =>
    setCompraForm((p) => ({ ...p, detalles: p.detalles.filter((_, j) => j !== i) }));

  const guardarCompra = async () => {
    if (!compraForm.proveedor_id || compraForm.detalles.length === 0) return;
    setSaving(true);
    try {
      await proveedoresAPI.registrarCompra({
        proveedor_id: parseInt(compraForm.proveedor_id),
        pagado: parseFloat(compraForm.pagado) || 0,
        notas: compraForm.notas,
        detalles: compraForm.detalles,
      });
      setModal(null);
      cargar();
    } finally { setSaving(false); }
  };

  const totalDeudaProveedores = proveedores.reduce((s, p) => s + parseFloat(p.deuda_total || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Proveedores</h2>
          <p className="page-sub">Deuda con proveedores: <span className="text-warning money">{fmt(totalDeudaProveedores)}</span></p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={() => { setCompraForm({ proveedor_id: "", pagado: "0", notas: "", detalles: [] }); setModal("compra"); }}>
            <ShoppingBag size={16} /> <span className="btn-label">Registrar compra</span>
          </button>
          <button className="btn btn-primary" onClick={() => { setForm({ nombre: "", contacto: "", telefono: "", email: "", notas: "" }); setModal("nuevo"); }}>
            <Plus size={16} /> <span className="btn-label">Nuevo proveedor</span>
          </button>
        </div>
      </div>

      {/* Tabla desktop */}
      <div className="table-wrap mb-6 hide-mobile">
        <table>
          <thead>
            <tr><th>Proveedor</th><th>Contacto</th><th>Teléfono</th><th>Deuda</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {proveedores.length === 0 && <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 32 }}>Sin proveedores</td></tr>}
            {proveedores.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                <td className="text-muted">{p.contacto || "—"}</td>
                <td className="text-muted">{p.telefono || "—"}</td>
                <td>
                  <span className={`money font-bold ${parseFloat(p.deuda_total) > 0 ? "text-warning" : "text-muted"}`}>
                    {parseFloat(p.deuda_total) > 0 ? fmt(p.deuda_total) : "Al día"}
                  </span>
                </td>
                <td>
                  <div className="flex gap-2">
                    {parseFloat(p.deuda_total) > 0 && (
                      <button className="btn btn-success btn-sm" onClick={() => abrirPago(p)} title="Registrar pago">
                        <DollarSign size={13} /> Pagar
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(p)} title="Editar"><Edit2 size={13} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => eliminarProveedor(p)} title="Eliminar"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mobile-cards show-mobile mb-6">
        {proveedores.length === 0 && <p className="text-center text-muted" style={{ padding: 32 }}>Sin proveedores</p>}
        {proveedores.map((p) => (
          <div key={p.id} className="card card-sm mb-3">
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontWeight: 600 }}>{p.nombre}</span>
              <span className={`money font-bold ${parseFloat(p.deuda_total) > 0 ? "text-warning" : "text-muted"}`}>
                {parseFloat(p.deuda_total) > 0 ? fmt(p.deuda_total) : "Al día"}
              </span>
            </div>
            {(p.contacto || p.telefono) && (
              <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: 8 }}>{p.contacto}{p.contacto && p.telefono ? " · " : ""}{p.telefono}</p>
            )}
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              {parseFloat(p.deuda_total) > 0 && (
                <button className="btn btn-success btn-sm" onClick={() => abrirPago(p)}><DollarSign size={13} /> Pagar</button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(p)}><Edit2 size={13} /> Editar</button>
              <button className="btn btn-danger btn-sm" onClick={() => eliminarProveedor(p)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Últimas compras */}
      <h3 style={{ fontWeight: 700, marginBottom: 12, fontSize: "1rem" }}>Últimas compras</h3>
      <div className="table-wrap hide-mobile">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Proveedor</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Notas</th></tr>
          </thead>
          <tbody>
            {compras.length === 0 && <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 32 }}>Sin compras</td></tr>}
            {compras.slice(0, 20).map((c) => (
              <tr key={c.id}>
                <td className="text-muted">{new Date(c.fecha).toLocaleDateString("es-AR")}</td>
                <td style={{ fontWeight: 500 }}>{c.proveedor?.nombre || "—"}</td>
                <td className="money">{fmt(c.total)}</td>
                <td className="money text-success">{fmt(c.pagado)}</td>
                <td className="money text-warning">{parseFloat(c.saldo) > 0 ? fmt(c.saldo) : "—"}</td>
                <td className="text-muted">{c.notas || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-cards show-mobile">
        {compras.length === 0 && <p className="text-center text-muted" style={{ padding: 32 }}>Sin compras</p>}
        {compras.slice(0, 20).map((c) => (
          <div key={c.id} className="card card-sm mb-3">
            <div className="flex justify-between items-center mb-1">
              <span style={{ fontWeight: 500 }}>{c.proveedor?.nombre || "—"}</span>
              <span className="money font-bold">{fmt(c.total)}</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: "0.8rem" }}>
              <span className="text-muted">{new Date(c.fecha).toLocaleDateString("es-AR")}</span>
              <span>Pagado: <span className="text-success">{fmt(c.pagado)}</span></span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal nuevo/editar proveedor */}
      <Modal open={modal === "nuevo" || modal === "editar"} onClose={cerrarModal} title={modal === "nuevo" ? "Nuevo proveedor" : "Editar proveedor"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[["nombre", "Nombre *"], ["contacto", "Contacto"], ["telefono", "Teléfono"], ["email", "Email"]].map(([k, label]) => (
            <div key={k} className="form-group">
              <label className="form-label">{label}</label>
              <input className="form-input" value={form[k]} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardarProveedor} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </Modal>

      {/* Modal pago proveedor */}
      <Modal open={modal === "pago" && !!selected} onClose={cerrarModal} title="Registrar pago a proveedor">
        {selected && (
          <>
            <div style={{ background: "var(--warning-bg)", border: "1px solid var(--warning)", borderRadius: "var(--radius-sm)", padding: "12px 16px", marginBottom: 20 }}>
              <p style={{ fontSize: "0.875rem", color: "var(--warning)" }}>
                <b>{selected.nombre}</b> — Deuda: <b>{fmt(selected.deuda_total)}</b>
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Monto a pagar</label>
                <input type="number" className="form-input" style={{ fontSize: "1.2rem" }} placeholder={`Max: ${fmt(selected.deuda_total)}`} value={pagoForm.monto} onChange={(e) => setPagoForm((p) => ({ ...p, monto: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Notas (opcional)</label>
                <input className="form-input" placeholder="Ej: Pago parcial transferencia" value={pagoForm.notas} onChange={(e) => setPagoForm((p) => ({ ...p, notas: e.target.value }))} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-success" onClick={registrarPago} disabled={saving}>
                {saving ? "Guardando..." : "Confirmar pago"}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Modal compra */}
      <Modal open={modal === "compra"} onClose={cerrarModal} title="Registrar compra" wide>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Proveedor *</label>
            <select className="form-select" value={compraForm.proveedor_id} onChange={(e) => setCompraForm((p) => ({ ...p, proveedor_id: e.target.value }))}>
              <option value="">Seleccionar...</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>

          <div style={{ background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: 12 }}>
            <div className="form-label" style={{ marginBottom: 8 }}>Ítems comprados</div>
            <div className="compra-detalle-grid" style={{ gap: 8, marginBottom: 8 }}>
              <select className="form-select" style={{ fontSize: "0.8rem" }} value={detalleLine.producto_id} onChange={(e) => setDetalleLine((p) => ({ ...p, producto_id: e.target.value }))}>
                <option value="">Producto / descripción libre</option>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input type="number" className="form-input" placeholder="Cant." style={{ fontSize: "0.8rem" }} value={detalleLine.cantidad} onChange={(e) => setDetalleLine((p) => ({ ...p, cantidad: e.target.value }))} />
              <input type="number" className="form-input" placeholder="$ costo" style={{ fontSize: "0.8rem" }} value={detalleLine.precio_costo} onChange={(e) => setDetalleLine((p) => ({ ...p, precio_costo: e.target.value }))} />
              <button className="btn btn-primary btn-sm" onClick={addDetalle}><Plus size={14} /></button>
            </div>
            {compraForm.detalles.map((d, i) => (
              <div key={i} className="flex justify-between items-center" style={{ fontSize: "0.825rem", padding: "4px 0", borderTop: "1px solid var(--border)" }}>
                <span>{d.cantidad}x {d.descripcion || "—"}</span>
                <div className="flex items-center gap-2">
                  <span className="money">{fmt(d.cantidad * d.precio_costo)}</span>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }} onClick={() => removeDetalle(i)}><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
            {compraForm.detalles.length > 0 && (
              <div className="flex justify-between" style={{ marginTop: 8, fontWeight: 700, fontSize: "0.875rem" }}>
                <span>Total</span>
                <span className="money">{fmt(compraForm.detalles.reduce((s, d) => s + d.cantidad * d.precio_costo, 0))}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Monto pagado</label>
            <input type="number" className="form-input" placeholder="$" value={compraForm.pagado} onChange={(e) => setCompraForm((p) => ({ ...p, pagado: e.target.value }))} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardarCompra} disabled={saving}>
            {saving ? "Guardando..." : "Registrar compra"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
