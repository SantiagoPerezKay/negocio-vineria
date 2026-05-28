import { useState, useEffect, useCallback } from "react";
import { promosAPI, stockAPI } from "../api";
import { Plus, Edit2, Trash2, Package, Loader } from "lucide-react";
import Modal from "../components/Modal";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

export default function Promos() {
  const [promos, setPromos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ nombre: "", descripcion: "", precio_promo: "" });
  const [items, setItems] = useState([{ producto_id: "", cantidad: "1" }]);

  const cerrarModal = useCallback(() => setModal(null), []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [promosR, prodsR] = await Promise.all([
        promosAPI.listar({ activo: true }),
        stockAPI.productos({ activo: true }),
      ]);
      setPromos(promosR.data);
      setProductos(prodsR.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const precioSinPromo = items.reduce((s, it) => {
    const prod = productos.find((p) => p.id === parseInt(it.producto_id));
    return s + (prod ? parseFloat(prod.precio_venta) * (parseFloat(it.cantidad) || 1) : 0);
  }, 0);

  const abrirNueva = () => {
    setForm({ nombre: "", descripcion: "", precio_promo: "" });
    setItems([{ producto_id: "", cantidad: "1" }]);
    setSelected(null);
    setModal("form");
  };

  const abrirEditar = (promo) => {
    setSelected(promo);
    setForm({
      nombre: promo.nombre,
      descripcion: promo.descripcion || "",
      precio_promo: promo.precio_promo,
    });
    setItems(
      promo.productos?.map((pp) => ({
        producto_id: String(pp.producto_id || pp.producto?.id),
        cantidad: String(pp.cantidad),
      })) || [{ producto_id: "", cantidad: "1" }]
    );
    setModal("form");
  };

  const addItem = () => setItems((p) => [...p, { producto_id: "", cantidad: "1" }]);
  const removeItem = (i) => setItems((p) => p.filter((_, j) => j !== i));
  const updateItem = (i, field, val) => setItems((p) => p.map((it, j) => j === i ? { ...it, [field]: val } : it));

  const guardar = async () => {
    const validItems = items.filter((it) => it.producto_id);
    if (!form.nombre || !form.precio_promo || validItems.length === 0) {
      alert("Completar nombre, precio y al menos un producto");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        precio_promo: parseFloat(form.precio_promo),
        productos: validItems.map((it) => ({
          producto_id: parseInt(it.producto_id),
          cantidad: parseFloat(it.cantidad) || 1,
        })),
      };
      if (selected) {
        await promosAPI.actualizar(selected.id, payload);
      } else {
        await promosAPI.crear(payload);
      }
      setModal(null);
      cargar();
    } finally {
      setSaving(false);
    }
  };

  const desactivar = async (id) => {
    if (!confirm("¿Desactivar esta promo?")) return;
    await promosAPI.desactivar(id);
    cargar();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Promos / Combos</h2>
          <p className="page-sub">{promos.length} promos activas</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNueva}>
          <Plus size={16} /> <span className="btn-label">Nueva promo</span>
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Loader size={32} className="text-muted spin" />
        </div>
      ) : promos.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <Package size={48} style={{ color: "var(--text3)", marginBottom: 12 }} />
          <p className="text-muted">No hay promos creadas todavía</p>
          <button className="btn btn-primary mt-4" onClick={abrirNueva}>Crear primera promo</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {promos.map((promo) => {
            const precioOriginal = promo.productos?.reduce((s, pp) => {
              const prod = pp.producto;
              return s + (prod ? parseFloat(prod.precio_venta) * parseFloat(pp.cantidad) : 0);
            }, 0) || 0;
            const ahorro = precioOriginal - parseFloat(promo.precio_promo);

            return (
              <div key={promo.id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: 2 }}>{promo.nombre}</h3>
                    {promo.descripcion && <p className="text-muted" style={{ fontSize: "0.8rem" }}>{promo.descripcion}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(promo)}><Edit2 size={13} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => desactivar(promo.id)}><Trash2 size={13} /></button>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  {promo.productos?.map((pp, i) => (
                    <div key={i} className="flex justify-between" style={{ fontSize: "0.82rem", padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
                      <span>{pp.producto?.nombre || `Producto #${pp.producto_id}`}</span>
                      <span className="text-muted">x{parseFloat(pp.cantidad)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center" style={{ paddingTop: 8, borderTop: "2px solid var(--border)" }}>
                  <div>
                    {precioOriginal > parseFloat(promo.precio_promo) && (
                      <span className="text-muted" style={{ textDecoration: "line-through", fontSize: "0.8rem", marginRight: 8 }}>
                        {fmt(precioOriginal)}
                      </span>
                    )}
                    <span className="money text-success" style={{ fontSize: "1.3rem", fontWeight: 800 }}>
                      {fmt(promo.precio_promo)}
                    </span>
                  </div>
                  {ahorro > 0 && (
                    <span className="badge badge-success" style={{ fontSize: "0.75rem" }}>
                      -{fmt(ahorro)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modal === "form"} onClose={cerrarModal} title={selected ? "Editar promo" : "Nueva promo"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "60vh", overflowY: "auto" }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Nombre de la promo *</label>
              <input className="form-input" placeholder='Ej: "Pack Asado"' value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Precio promo *</label>
              <input type="number" className="form-input" placeholder="$" value={form.precio_promo} onChange={(e) => setForm((p) => ({ ...p, precio_promo: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descripción (opcional)</label>
            <input className="form-input" placeholder="Descripción breve..." value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} />
          </div>

          <hr className="divider" />
          <div className="flex justify-between items-center">
            <h4 style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text2)" }}>Productos del combo</h4>
            <button className="btn btn-ghost btn-sm" onClick={addItem}><Plus size={14} /> Agregar</button>
          </div>

          {items.map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 30px", gap: 8, alignItems: "end" }}>
              <div className="form-group">
                {i === 0 && <label className="form-label">Producto</label>}
                <select className="form-select" value={it.producto_id} onChange={(e) => updateItem(i, "producto_id", e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} ({fmt(p.precio_venta)})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                {i === 0 && <label className="form-label">Cant.</label>}
                <input type="number" className="form-input" value={it.cantidad} onChange={(e) => updateItem(i, "cantidad", e.target.value)} />
              </div>
              <button className="btn btn-ghost btn-sm" style={{ padding: "6px", marginBottom: 2 }} onClick={() => removeItem(i)}>×</button>
            </div>
          ))}

          {precioSinPromo > 0 && (
            <div style={{ background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: 12, border: "1px solid var(--border)" }}>
              <div className="flex justify-between" style={{ fontSize: "0.85rem" }}>
                <span className="text-muted">Precio individual sumado</span>
                <span className="money" style={{ textDecoration: "line-through" }}>{fmt(precioSinPromo)}</span>
              </div>
              <div className="flex justify-between" style={{ fontSize: "1rem", fontWeight: 700, marginTop: 4 }}>
                <span>Precio promo</span>
                <span className="money text-success">{fmt(parseFloat(form.precio_promo) || 0)}</span>
              </div>
              {parseFloat(form.precio_promo) > 0 && parseFloat(form.precio_promo) < precioSinPromo && (
                <div className="flex justify-between" style={{ fontSize: "0.85rem", marginTop: 4, color: "var(--success)" }}>
                  <span>Ahorro cliente</span>
                  <span>{fmt(precioSinPromo - parseFloat(form.precio_promo))}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving}>
            {saving ? "Guardando..." : selected ? "Actualizar" : "Crear promo"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
