import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { ehEquipe, stContrato, tituloContrato, useBase, valorCobranca } from '../lib/store'
import type { Contrato, Pagamento } from '../lib/types'
import { br, brl, diff, DIAS, hm, hoje } from '../lib/util'
import { ClienteForm, ContratoForm, PagamentoForm } from './forms'
import { Chip, ChipContrato, Drawer } from './ui'

export function ClienteDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { clientes, contratos, horarios, profissionais, uso, perfil } = useBase()
  const a = clientes.get(id)
  const [pags, setPags] = useState<Pagamento[]>([])
  const [modal, setModal] = useState<null | { k: 'cli' } | { k: 'ct'; c?: Contrato } | { k: 'pg'; ct?: string; p?: Pagamento }>(null)
  const equipe = ehEquipe(perfil)
  const carregaPags = () => { if (equipe) sb.from('pagamentos').select('*').eq('cliente_id', id).order('data', { ascending: false }).limit(30).then(r => setPags((r.data as Pagamento[]) || [])) }
  useEffect(carregaPags, [id])
  if (!a) return null
  const cs = [...contratos.values()].filter(c => c.cliente_id === id).sort((x, y) => (x.status === 'ativo' ? 0 : 1) - (y.status === 'ativo' ? 0 : 1))
  const idade = a.nascimento ? Math.floor(diff(hoje(), a.nascimento) / 365.25) : null
  const prof = (pid: string | null) => profissionais.find(p => p.id === pid)?.nome
  return <>
    <Drawer onClose={onClose} header={<><h2>{a.nome}</h2><div style={{ marginTop: 6 }}><Chip st={a.status === 'ativo' ? 'ok' : a.status} /></div></>}>
      <div className="dsec"><h3>Dados {equipe && <button className="btn sm" onClick={() => setModal({ k: 'cli' })}>Editar</button>}</h3>
        <dl className="dl">
          <dt>Nascimento</dt><dd>{a.nascimento ? `${br(a.nascimento)} (${idade} anos)` : '—'}</dd>
          <dt>Telefone</dt><dd>{a.telefone || '—'}</dd>
          <dt>E-mail</dt><dd>{a.email || '—'}</dd>
          {a.obs && <><dt>Obs.</dt><dd>{a.obs}</dd></>}
        </dl></div>
      <div className="dsec"><h3>Contratos {equipe && <button className="btn sm" onClick={() => setModal({ k: 'ct' })}>+ Contrato</button>}</h3>
        {cs.length ? cs.map(c => {
          const u = uso.get(c.id); const st = stContrato(c, u); const hs = horarios.filter(h => h.contrato_id === c.id).sort((x, y) => x.dia_semana - y.dia_semana || x.hora.localeCompare(y.hora))
          return <div className="card" key={c.id}>
            <div className="row"><div><b>{tituloContrato(c)}</b><div className="sub">{[c.periodicidade, prof(c.profissional_id)].filter(Boolean).join(' · ')}</div></div><ChipContrato st={st} venc={c.vencimento} /></div>
            <dl className="dl">
              {equipe && <><dt>Valor</dt><dd className="num">{brl(c.valor)}{c.tipo === 'pacote' ? ' (pacote)' : ' /mês'}{c.tipo === 'plano' && c.meses > 1 ? ' · ' + brl(valorCobranca(c)) + ' no período' : ''}</dd></>}
              <dt>{c.tipo === 'pacote' ? 'Validade' : 'Vencimento'}</dt><dd>{br(c.vencimento)}</dd>
              <dt>Início</dt><dd>{br(c.inicio)}</dd>
              {c.tipo === 'pacote' && <><dt>Sessões</dt><dd><b>{u?.usadas || 0}</b> de {c.sessoes || '?'} usadas{c.sessoes ? ' · restam ' + Math.max(0, c.sessoes - (u?.usadas || 0)) : ''}{u?.faltas_avisadas ? ` · ${u.faltas_avisadas} falta(s) avisada(s)` : ''}</dd></>}
            </dl>
            <div className="hrs">{hs.length ? hs.map(h => <span key={h.id}>{DIAS[h.dia_semana]} {hm(h.hora)}</span>) : <span className="sub" style={{ background: 'none', padding: 0 }}>Sem horário fixo cadastrado</span>}</div>
            {c.frequencia && c.status === 'ativo' && hs.length !== c.frequencia && c.tipo === 'plano' ? <div className="note">Plano de {c.frequencia}× por semana com {hs.length} horário(s) fixo(s).</div> : null}
            {equipe && <div className="inline"><button className="btn sm pri" onClick={() => setModal({ k: 'pg', ct: c.id })}>Receber</button><button className="btn sm" onClick={() => setModal({ k: 'ct', c })}>Editar contrato</button></div>}
          </div>
        }) : <div className="sub">Nenhum contrato.</div>}
      </div>
      {equipe && <div className="dsec"><h3>Pagamentos <button className="btn sm" onClick={() => setModal({ k: 'pg' })}>+ Pagamento</button></h3>
        {pags.length ? <div className="panel tbl"><table><tbody>{pags.map(p => <tr key={p.id} className="click" onClick={() => setModal({ k: 'pg', p })}>
          <td className="num">{br(p.data)}</td><td className="sub">{p.descricao || p.modalidade}<br />{p.forma}{p.parcelas > 1 ? ' · ' + p.parcelas + 'x' : ''}</td><td className="num"><b>{brl(p.valor)}</b></td></tr>)}</tbody></table></div>
          : <div className="sub">Nenhum pagamento lançado.</div>}
      </div>}
    </Drawer>
    {modal?.k === 'cli' && <ClienteForm cliente={a} onClose={() => setModal(null)} />}
    {modal?.k === 'ct' && <ContratoForm contrato={modal.c} clienteId={id} onClose={() => setModal(null)} />}
    {modal?.k === 'pg' && <PagamentoForm pagamento={modal.p} contratoId={modal.ct} clienteId={id} onClose={() => setModal(null)} onSaved={carregaPags} />}
  </>
}
