import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Modal reutilizable.
 *
 * - NO se cierra al hacer click afuera (protege datos del formulario).
 * - Se cierra con ESC o con el botón X.
 * - Trap de foco: al abrirse hace focus en el contenido.
 *
 * Props:
 *   open      – boolean, si es true muestra el modal
 *   onClose   – callback para cerrar
 *   title     – string, título del modal
 *   wide      – boolean, si es true usa max-width mayor (620px)
 *   children  – contenido del modal (formulario, etc.)
 */
export default function Modal({ open, onClose, title, wide, children }) {
  const modalRef = useRef(null);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;

    const handleKey = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Focus trap: al abrir, enfocar el modal
  useEffect(() => {
    if (open && modalRef.current) {
      modalRef.current.focus();
    }
  }, [open]);

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal"
        style={wide ? { maxWidth: 620 } : undefined}
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button
            className="modal-close-btn"
            onClick={onClose}
            title="Cerrar (Esc)"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
