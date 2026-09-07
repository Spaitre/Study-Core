import { useState } from 'react'
import { createPortal } from 'react-dom'
import { abrirCaja } from '../api.js'
import { buscarCosmetico, RAREZA_LABEL } from './cosmeticos.js'

const ICONO_RECOMPENSA = { monedas: '🪙', xp: '✨' }
const NOMBRE_RECOMPENSA = { monedas: 'monedas', xp: 'XP' }

// Modal para abrir las cajas de regalo ganadas por mantener la racha. La
// recompensa se sortea en el servidor al abrir (no antes), así que aquí solo
// se pide abrir y se muestra el resultado.
export default function CajasModal({ cajas, onCerrar, onCambio }) {
  const [abriendoId, setAbriendoId] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)

  async function abrir(id) {
    setError(null)
    setAbriendoId(id)
    try {
      const r = await abrirCaja(id)
      setResultado(r)
      await onCambio?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setAbriendoId(null)
    }
  }

  const quedan = cajas.length > 0

  // Portal a document.body: el sidebar usa backdrop-filter, que crea un
  // "containing block" y atraparía un position:fixed anidado dentro de él.
  return createPortal(
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-cajas" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-titulo">🎁 Cajas de regalo</h2>

        {resultado ? (
          <div className="caja-resultado">
            {resultado.tipo === 'cosmetico' ? (
              <>
                {(() => {
                  const c = buscarCosmetico(resultado.clave)
                  return c?.icono ? (
                    <div className="caja-resultado-icono">{c.icono}</div>
                  ) : (
                    <div
                      className="caja-resultado-marco"
                      style={{ background: `linear-gradient(135deg, ${c?.color}, ${c?.color2})` }}
                    />
                  )
                })()}
                <p className="modal-mensaje">
                  ¡Cosmético nuevo! <strong>{buscarCosmetico(resultado.clave)?.nombre}</strong>
                  <br />
                  <span className={`rareza rareza-${resultado.rareza}`}>
                    {RAREZA_LABEL[resultado.rareza]}
                  </span>
                </p>
              </>
            ) : (
              <>
                <div className="caja-resultado-icono">{ICONO_RECOMPENSA[resultado.tipo]}</div>
                <p className="modal-mensaje">
                  ¡Ganaste{' '}
                  <strong>
                    {resultado.cantidad} {NOMBRE_RECOMPENSA[resultado.tipo]}
                  </strong>
                  !
                </p>
              </>
            )}
            <button className="btn-mini primary" onClick={() => setResultado(null)}>
              {quedan ? 'Seguir abriendo' : 'Genial'}
            </button>
          </div>
        ) : quedan ? (
          <>
            <p className="modal-mensaje">
              Ganaste estas cajas por mantener tu racha de estudio. Ábrelas para ver qué hay
              dentro.
            </p>
            <div className="cajas-lista">
              {cajas.map((c) => (
                <button
                  key={c.id}
                  className="caja-item"
                  disabled={abriendoId === c.id}
                  onClick={() => abrir(c.id)}
                >
                  🎁
                  <span>{abriendoId === c.id ? 'Abriendo…' : 'Abrir'}</span>
                </button>
              ))}
            </div>
            {error && <p className="form-error">{error}</p>}
          </>
        ) : (
          <p className="modal-mensaje">Ya abriste todas tus cajas. ¡Vuelve mañana por más!</p>
        )}

        <div className="modal-acciones">
          <button className="btn-mini" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
