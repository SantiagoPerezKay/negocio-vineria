import { useState, useEffect, useCallback } from "react";
import { clientesAPI } from "../api";
import { Plus, DollarSign, ChevronRight, Edit2, Trash2 } from "lucide-react";
import Modal from "../components/Modal";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [soloDeuda, setSoloDeuda] = useState(false);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ nombre: "", telefono: "", email: "", notas: "" });
  const [pago, setPago] = useState({ monto: "", metodo: "efectivo", notas: "" });
  const [historial, setHistorial] = useState([]);

  const cerrarModal = useCallback(() => setModal(null), []);

  const cargar = async () => {
    const r = await clientesAPI.listar(soloDeuda ? { con_deuda: true } : {});
    setClientes(r.data);
  };

  useEffect(() => { cargar(); }, [soloDeuda]);

  const guardarCliente = async () => {
    if (!form.nombre.trim()) return;
    if (modal === "nuevo") await clientesAPI.crear(form);
    else await clientesAPI.actualizar(selected.id, form);
    setModal(null);
    cargar();
  };

  const abrirEditar = (c) => {
    setSelected(c);
    setForm({ nombre: c.nombre, telefono: c.telefono || "", email: c.email || "", notas: c.notas || "" });
    setModal("editar");
  };

  const eliminarCliente = async (c) => {
    if (!confirm(`¿Eliminar a "${c.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await clientesAPI.eliminar(c.id);
      cargar();
    } catch (e) {
      alert(e.response?.data?.detail || "Error al eliminar");
    }
  };

  const abrirPago = (c) => {
    setSelected(c);
    setPago({ monto: "", metodo: "efectivo", notas: "" });
    setModal("pago");
  };

  const abrirDetalle = async (c) => {
    setSelected(c);
    const r = await clientesAPI.historialPagos(c.id);
    setHistorial(r.data);
    setModal("detalle");
  };

  const registrarPago = async () => {
    if (!pago.monto) return;
    await clientesAPI.registrarPago(selected.id, { monto: parseFloat(pago.monto), metodo: pago.metodo, notas: pago.notas });
    setModal(null);
    cargar();
  };

  const totalDeuda = clientes.reduce((s, c) => s + parseFloat(c.deuda_total || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Clientes / Fiado</h2>
          <p className="page-sub">Deuda total: <span className="text-danger money">{fmt(totalDeuda)}</span></p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ nombre: "", telefono: "", email: "", notas: "" }); setModal("nuevo"); }}>
          <Plus size={16} /> <span className="btn-label">Nuevo cliente</span>
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <label className="flex items-center gap-2" style={{ cursor: "pointer", fontSize: "0.875rem", color: "var(--text2)" }}>
          <input type="checkbox" checked={soloDeuda} onChange={(e) => setSoloDeuda(e.target.checked)} />
          Solo con deuda
        </label>
      </div>

      {/* Tabla desktop */}
      <div className="table-wrap hide-mobile">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Deuda total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 32 }}>Sin clientes</td></tr>
            )}
            {clientes.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.nombre}</td>
                <td className="text-muted">{c.telefono || "—"}</td>
                <td className="text-muted">{c.email || "—"}</td>
                <td>
                  <span className={`money font-bold ${parseFloat(c.deuda_total) > 0 ? "text-danger" : "text-muted"}`}>
                    {parseFloat(c.deuda_total) > 0 ? fmt(c.deuda_total) : "Sin deuda"}
                  </span>
                </td>
                <td>
                  <div className="flex gap-2">
                    {parseFloat(c.deuda_total) > 0 && (
                      <button className="btn btn-success btn-sm" onClick={() => abrirPago(c)}>
                        <DollarSign size={13} /> Cobrar
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirDetalle(c)} title="Ver detalle">
                      <ChevronRight size={13} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(c)} title="Editar">
                      <Edit2 size={13} />
                    </button>
                    {parseFloat(c.deuda_total) === 0 && (
                      <button className="btn btn-danger btn-sm" onClick={() => eliminarCliente(c)} title="Eliminar">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mobile-cards show-mobile">
        {clientes.length === 0 && <p className="text-center text-muted" style={{ padding: 32 }}>Sin clientes</p>}
        {clientes.map((c) => (
          <div key={c.id} className="card card-sm mb-3">
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontWeight: 600, fontSize: "1rem" }}>{c.nombre}</span>
              <span className={`money font-bold ${parseFloat(c.deuda_total) > 0 ? "text-danger" : "text-muted"}`}>
                {parseFloat(c.deuda_total) > 0 ? fmt(c.deuda_total) : "Sin deuda"}
              </span>
            </div>
            {(c.telefono || c.email) && (
              <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: 8 }}>
                {c.telefono}{c.telefono && c.email ? " · " : ""}{c.email}
              </p>
            )}
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              {parseFloat(c.deuda_total) > 0 && (
                <button className="btn btn-success btn-sm" onClick={() => abrirPago(c)}><DollarSign size={13} /> Cobrar</button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => abrirDetalle(c)}><ChevronRight size={13} /> Ver</button>
              <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(c)}><Edit2 size={13} /></button>
              {parseFloat(c.deuda_total) === 0 && (
                <button className="btn btn-danger btn-sm" onClick={() => eliminarCliente(c)}><Trash2 size={13} /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal nuevo/editar */}
      <Modal open={modal === "nuevo" || modal === "editar"} onClose={cerrarModal} title={modal === "nuevo" ? "Nuevo cliente" : "Editar cliente"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[["nombre", "Nombre *"], ["telefono", "Teléfono"], ["email", "Email"], ["notas", "Notas"]].map(([k, label]) => (
            <div key={k} className="form-group">
              <label className="form-label">{label}</label>
              <input className="form-input" value={form[k]} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardarCliente}>Guardar</button>
        </div>
      </Modal>

      {/* Modal pago */}
      <Modal open={modal === "pago" && !!selected} onClose={cerrarModal} title="Cobrar deuda">
        {selected && (
          <>
            <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", padding: "12px 16px", marginBottom: 20 }}>
              <p style={{ fontSize: "0.875rem", color: "var(--danger)" }}>
                <b>{selected.nombre}</b> debe <b>{fmt(selected.deuda_total)}</b>
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Monto a cobrar</label>
                <input type="number" className="form-input" style={{ fontSize: "1.2rem" }} placeholder={`Máx: ${fmt(selected.deuda_total)}`} value={pago.monto} onChange={(e) => setPago((p) => ({ ...p, monto: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Método</label>
                <select className="form-select" value={pago.metodo} onChange={(e) => setPago((p) => ({ ...p, metodo: e.target.value }))}>
                  {["efectivo", "transferencia", "tarjeta"].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-success" onClick={registrarPago}>Confirmar cobro</button>
            </div>
          </>
        )}
      </Modal>

      {/* Modal detalle */}
      <Modal open={modal === "detalle" && !!selected} onClose={cerrarModal} title={selected?.nombre || ""}>
        {selected && (
          <>
            <div className="grid-2 mb-4">
              <div className="stat-card card-sm">
                <div className="stat-label">Deuda actual</div>
                <div className="stat-value text-danger" style={{ fontSize: "1.3rem" }}>{fmt(selected.deuda_total)}</div>
              </div>
              <div className="stat-card card-sm">
                <div className="stat-label">Teléfono</div>
                <div style={{ fontSize: "1rem", fontWeight: 600, marginTop: 4 }}>{selected.telefono || "—"}</div>
              </div>
            </div>
            <h4 style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text2)", marginBottom: 10 }}>HISTORIAL DE PAGOS</h4>
            {historial.length === 0
              ? <p className="text-muted" style={{ fontSize: "0.875rem" }}>Sin pagos registrados</p>
              : historial.map((h) => (
                <div key={h.id} className="flex justify-between items-center" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "0.875rem" }}>
                  <div>
                    <span className="badge badge-success" style={{ marginRight: 8 }}>{h.metodo}</span>
                    {new Date(h.fecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <span className="money text-success">{fmt(h.monto)}</span>
                </div>
              ))}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={cerrarModal}>Cerrar</button>
              {parseFloat(selected.deuda_total) > 0 && (
                <button className="btn btn-success" onClick={() => { setModal(null); setTimeout(() => abrirPago(selected), 50); }}>
                  <DollarSign size={14} /> Cobrar ahora
                </button>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
