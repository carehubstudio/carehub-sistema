import { useEffect, type ReactNode } from 'react'
import type { StC } from '../lib/store'
import { diff, hoje } from '../lib/util'

const LBL: Record<string, string> = { ok: 'Em dia', vence: 'Vence em breve', atrasado: 'Em atraso', sem: 'Sem vencimento', inativo: 'Inativo', trancado: 'Trancado', fim: 'Pacote concluído', encerrado: 'Encerrado' }
export function Chip({ st, extra }: { st: string; extra?: string }) {
  return <span className={'chip c-' + st}>{LBL[st] || st}{extra ? ' · ' + extra : ''}</span>
}
export function ChipContrato({ st, venc }: { st: StC; venc?: string | null }) {
  if (st === 'atrasado' && venc) return <Chip st={st} extra={-diff(venc, hoje()) + ' d'} />
  if (st === 'vence' && venc) { const d = diff(venc, hoje()); return <Chip st={st} extra={d === 0 ? 'hoje' : d === 1 ? 'amanhã' : 'em ' + d + ' d'} /> }
  return <Chip st={st} />
}

function useEsc(fn: () => void) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') fn() }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h) }, [fn])
}
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEsc(onClose)
  return <div className="scrim modalwrap" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="modal" role="dialog" aria-modal="true" style={wide ? { width: 'min(760px,100%)' } : undefined}>
      <header><h2>{title}</h2><button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar">✕</button></header>
      {children}
    </div>
  </div>
}
export function Drawer({ onClose, header, children }: { onClose: () => void; header: ReactNode; children: ReactNode }) {
  useEsc(onClose)
  return <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <aside className="drawer" role="dialog" aria-modal="true">
      <header><div>{header}</div><button className="btn ghost" onClick={onClose} aria-label="Fechar">✕</button></header>
      {children}
    </aside>
  </div>
}
export function Empty({ t, children }: { t: string; children?: ReactNode }) {
  return <div className="empty"><strong>{t}</strong>{children}</div>
}
export function Confirmar({ label, onConfirm, className = 'btn danger' }: { label: string; onConfirm: () => void; className?: string }) {
  return <button type="button" className={className} onClick={e => {
    const b = e.currentTarget; if (b.dataset.ok) onConfirm(); else { b.dataset.ok = '1'; b.textContent = 'Confirmar: ' + label.toLowerCase() }
  }}>{label}</button>
}
