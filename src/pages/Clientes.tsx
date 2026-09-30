import { useState } from 'react'
import { RANK, stContrato, tituloContrato, useBase } from '../lib/store'
import type { Cliente } from '../lib/types'
import { br, norm } from '../lib/util'
import { ClienteForm } from '../components/forms'
import { Chip, Empty } from '../components/ui'

export function Clientes({ abrirCliente }: { abrirCliente: (id: string) => void }) {
  const { clientes, contratos, uso, profissionais, perfil } = useBase()
  const [q, setQ] = useState(''); const [f, setF] = useState('ativos'); const [novo, setNovo] = useState(false)
  const equipe = perfil.papel !== 'profissional'
  const all = [...clientes.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  const cts = (id: string) => [...contratos.values()].filter(c => c.cliente_id === id && c.status === 'ativo')
  const st = (a: Cliente): string => { if (a.status !== 'ativo') return a.status; const s = cts(a.id).map(c => stContrato(c, uso.get(c.id))).sort((x, y) => RANK[x] - RANK[y]); return s[0] || 'sem_contrato' }
  const F: Record<string, (a: Cliente) => boolean> = {
    ativos: a => a.status === 'ativo', atrasado: a => st(a) === 'atrasado', vence: a => st(a) === 'vence', semct: a => a.status === 'ativo' && !cts(a.id).length,
    inativos: a => a.status !== 'ativo', todos: () => true,
  }
  const L: Record<string, string> = { ativos: 'Ativos', atrasado: 'Em atraso', vence: 'Vence em 7 d', semct: 'Sem contrato', inativos: 'Inativos', todos: 'Todos' }
  const list = all.filter(F[f]).filter(a => !q || norm(a.nome).includes(norm(q)))
  return <>
    <div className="viewhead"><div><h1>{equipe ? 'Clientes' : 'Meus alunos'}</h1><p>{all.length} cadastrados</p></div>{equipe && <button className="btn pri" onClick={() => setNovo(true)}>+ Novo cliente</button>}</div>
    <div className="toolbar"><input type="search" placeholder="Buscar pelo nome" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar" />
      <div className="seg">{Object.keys(L).map(k => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{L[k]}<b>{all.filter(F[k]).length}</b></button>)}</div></div>
    <section className="panel tbl">{list.length ? <table><thead><tr><th>Cliente</th><th>Contratos</th><th>Profissional</th><th className="num">Vencimento</th><th>Situação</th></tr></thead><tbody>
      {list.map(a => {
        const c = cts(a.id); const prox = c.filter(x => x.vencimento).sort((x, y) => x.vencimento!.localeCompare(y.vencimento!))[0]; const s = st(a)
        return <tr key={a.id} className="click" onClick={() => abrirCliente(a.id)}><td><b>{a.nome}</b>{a.telefone && <div className="sub">{a.telefone}</div>}</td>
          <td className="sub">{c.map(tituloContrato).join(', ') || '—'}</td>
          <td className="sub">{[...new Set(c.map(x => profissionais.find(p => p.id === x.profissional_id)?.nome).filter(Boolean))].join(', ') || '—'}</td>
          <td className="num">{prox ? br(prox.vencimento) : '—'}</td><td>{s === 'sem_contrato' ? <span className="chip c-sem">Sem contrato</span> : <Chip st={s} />}</td></tr>
      })}</tbody></table> : <Empty t={all.length ? 'Nenhum cliente neste filtro' : 'Nenhum cliente cadastrado ainda'}>{all.length ? 'Troque o filtro ou a busca.' : equipe ? 'Use “+ Novo cliente” a cada novo fechamento ou renovação.' : ''}</Empty>}</section>
    {novo && <ClienteForm onClose={() => setNovo(false)} onSaved={id => abrirCliente(id)} />}
  </>
}
