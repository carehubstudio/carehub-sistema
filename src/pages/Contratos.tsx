import { useState } from 'react'
import { stContrato, tituloContrato, useBase, valorCobranca } from '../lib/store'
import type { Contrato } from '../lib/types'
import { br, brl, DIAS, hm, modCls, norm } from '../lib/util'
import { ChipContrato, Empty } from '../components/ui'

export function Contratos({ abrirCliente, filtro0 }: { abrirCliente: (id: string) => void; filtro0?: string }) {
  const { contratos, clientes, uso, horarios, profissionais, perfil } = useBase()
  const [f, setF] = useState(filtro0 || 'ativos'); const [prof, setProf] = useState(''); const [q, setQ] = useState('')
  const all = [...contratos.values()]
  const st = (c: Contrato) => stContrato(c, uso.get(c.id))
  const F: Record<string, (c: Contrato) => boolean> = {
    ativos: c => c.status === 'ativo', atrasado: c => st(c) === 'atrasado', vence: c => st(c) === 'vence', sem: c => st(c) === 'sem',
    semhorario: c => c.status === 'ativo' && c.tipo === 'plano' && !horarios.some(h => h.contrato_id === c.id), fim: c => st(c) === 'fim', pacotes: c => c.tipo === 'pacote' && c.status === 'ativo', inativos: c => c.status !== 'ativo', todos: () => true,
  }
  const L: Record<string, string> = { ativos: 'Ativos', atrasado: 'Em atraso', vence: 'Vence em 7 d', sem: 'Sem vencimento', semhorario: 'Sem horário', pacotes: 'Pacotes', fim: 'Pacote concluído', inativos: 'Encerrados', todos: 'Todos' }
  const nm = (c: Contrato) => clientes.get(c.cliente_id)?.nome || ''
  const base = all.filter(c => !prof || c.profissional_id === prof)
  const list = base.filter(F[f]).filter(c => !q || norm(nm(c)).includes(norm(q))).sort((a, b) => (a.vencimento || '9').localeCompare(b.vencimento || '9'))
  const mrr = base.filter(c => c.status === 'ativo' && c.tipo === 'plano' && c.valor).reduce((s, c) => s + Number(c.valor), 0)
  const equipe = perfil.papel !== 'profissional'
  return <>
    <div className="viewhead"><div><h1>Contratos</h1><p>{base.filter(c => c.status === 'ativo').length} ativos{equipe ? ' · receita recorrente de planos: ' + brl(mrr) + ' por mês' : ''}</p></div></div>
    <div className="toolbar"><input type="search" placeholder="Buscar cliente" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar" />
      {equipe && <select value={prof} onChange={e => setProf(e.target.value)} aria-label="Profissional"><option value="">Todos os profissionais</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>}
      <div className="seg">{Object.keys(L).map(k => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{L[k]}<b>{base.filter(F[k]).length}</b></button>)}</div></div>
    <section className="panel tbl">{list.length ? <table><thead><tr><th>Cliente</th><th>Contrato</th><th>Profissional</th><th>Horários</th>{equipe && <th className="num">Valor</th>}<th className="num">Vencimento</th><th>Situação</th></tr></thead><tbody>
      {list.map(c => { const u = uso.get(c.id); return <tr key={c.id} className="click" onClick={() => abrirCliente(c.cliente_id)}>
        <td><b>{nm(c)}</b><div className="sub">{c.periodicidade || (c.tipo === 'pacote' ? 'Pacote' : '')}</div></td>
        <td><span className={'mdot ' + modCls(c.modalidade)} />{tituloContrato(c)}{c.tipo === 'pacote' && c.sessoes ? <div className="sub">{u?.usadas || 0}/{c.sessoes} sessões</div> : null}</td>
        <td className="sub">{profissionais.find(p => p.id === c.profissional_id)?.nome || '—'}</td>
        <td><div className="hrs">{horarios.filter(h => h.contrato_id === c.id).sort((x, y) => x.dia_semana - y.dia_semana).map(h => <span key={h.id}>{DIAS[h.dia_semana]} {hm(h.hora)}</span>)}</div></td>
        {equipe && <td className="num">{brl(valorCobranca(c))}</td>}<td className="num">{br(c.vencimento)}</td><td><ChipContrato st={st(c)} venc={c.vencimento} /></td></tr> })}
    </tbody></table> : <Empty t="Nenhum contrato neste filtro">{all.length ? 'Troque o filtro ou a busca.' : 'Os contratos são criados na ficha do cliente.'}</Empty>}</section>
  </>
}
