import { useCallback, useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useBase } from '../lib/store'
import type { Pagamento } from '../lib/types'
import { addMonths, baixar, br, brl, csv, formasDe, hoje, mesLabel } from '../lib/util'
import { PagamentoForm } from '../components/forms'
import { Empty } from '../components/ui'

function Barras({ arr }: { arr: [string, number][] }) {
  const mx = Math.max(1, ...arr.map(x => x[1]))
  return arr.length ? <div className="bars">{arr.slice(0, 8).map(([k, v]) => <div className="bar" key={k}><span>{k}</span><span className="track"><i style={{ width: (v / mx * 100).toFixed(1) + '%' }} /></span><span className="num">{brl(v)}</span></div>)}</div> : <div className="sub">Sem dados.</div>
}
export function Financeiro() {
  const { clientes, profissionais, perfil, config } = useBase()
  const [mes, setMes] = useState(hoje().slice(0, 7)); const [prof, setProf] = useState(''); const [forma, setForma] = useState('')
  const [pags, setPags] = useState<Pagamento[]>([]); const [modal, setModal] = useState<null | { p?: Pagamento }>(null)
  const gestao = perfil.papel === 'gestao'
  const carregar = useCallback(() => {
    const fim = addMonths(mes + '-01', 1)
    sb.from('pagamentos').select('*').gte('data', mes + '-01').lt('data', fim).order('data', { ascending: false }).then(r => setPags((r.data as Pagamento[]) || []))
  }, [mes])
  useEffect(carregar, [carregar])
  const list = pags.filter(p => (!prof || p.profissional_id === prof) && (!forma || p.forma === forma))
  const tot = list.reduce((s, p) => s + Number(p.valor), 0), liq = list.reduce((s, p) => s + Number(p.liquido || 0), 0)
  const agg = (fn: (p: Pagamento) => string) => { const m = new Map<string, number>(); list.forEach(p => { const k = fn(p) || 'Não informado'; m.set(k, (m.get(k) || 0) + Number(p.valor)) }); return [...m.entries()].sort((a, b) => b[1] - a[1]) }
  const nomeProf = (id: string | null) => profissionais.find(p => p.id === id)?.nome || ''
  function exportar() {
    const rows = [['Data', 'Cliente', 'Pago por', 'Descrição', 'Modalidade', 'Profissional', 'Forma', 'Parcelas', 'Valor', 'Taxa %', 'Imposto %', 'Líquido', 'CV', 'NF', 'Observação'],
      ...list.slice().reverse().map(p => [br(p.data), clientes.get(p.cliente_id || '')?.nome, p.pagante, p.descricao, p.modalidade, nomeProf(p.profissional_id), p.forma, p.parcelas,
        String(p.valor).replace('.', ','), String(p.taxa_pct).replace('.', ','), String(p.imposto_pct).replace('.', ','), String(p.liquido).replace('.', ','), p.cv, p.nf, p.obs])]
    baixar(`pagamentos-${mes}.csv`, csv(rows))
  }
  return <>
    <div className="viewhead"><div><h1>Financeiro</h1><p>Recebimentos por mês</p></div><div className="toolbar" style={{ margin: 0 }}><button className="btn" onClick={exportar}>Exportar CSV</button><button className="btn pri" onClick={() => setModal({})}>+ Pagamento</button></div></div>
    <div className="toolbar">
      <div className="datenav"><button className="btn sm" onClick={() => setMes(addMonths(mes + '-01', -1).slice(0, 7))} aria-label="Mês anterior">‹</button><strong>{mesLabel(mes)}</strong><button className="btn sm" onClick={() => setMes(addMonths(mes + '-01', 1).slice(0, 7))} aria-label="Próximo mês">›</button></div>
      <select value={prof} onChange={e => setProf(e.target.value)} aria-label="Profissional"><option value="">Todos os profissionais</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
      <select value={forma} onChange={e => setForma(e.target.value)} aria-label="Forma"><option value="">Todas as formas</option>{formasDe(config).map(f => <option key={f.nome}>{f.nome}</option>)}</select>
    </div>
    <div className="kpis">
      <div className="kpi"><span>Total recebido</span><b className="num">{brl(tot)}</b></div>
      {gestao && <div className="kpi"><span>Líquido (taxa e imposto)</span><b className="num">{brl(liq)}</b><em>{tot ? ((1 - liq / tot) * 100).toFixed(1) + '% de desconto' : ''}</em></div>}
      <div className="kpi"><span>Lançamentos</span><b className="num">{list.length}</b></div>
      <div className="kpi"><span>Ticket médio</span><b className="num">{brl(list.length ? tot / list.length : 0)}</b></div>
    </div>
    <div className="grid2" style={{ marginBottom: 16 }}>
      <section className="panel"><header><h2>Por modalidade</h2></header><div className="pbody"><Barras arr={agg(p => p.modalidade || '')} /></div></section>
      <section className="panel"><header><h2>Por forma de pagamento</h2></header><div className="pbody"><Barras arr={agg(p => p.forma)} /></div></section>
    </div>
    <section className="panel tbl">{list.length ? <table><thead><tr><th>Data</th><th>Cliente</th><th>Descrição</th><th>Profissional</th><th>Forma</th><th className="num">Valor</th>{gestao && <th className="num">Líquido</th>}<th>CV</th><th>NF</th></tr></thead><tbody>
      {list.map(p => <tr key={p.id} className="click" onClick={() => setModal({ p })}><td className="num">{br(p.data)}</td>
        <td><b>{clientes.get(p.cliente_id || '')?.nome || '—'}</b>{p.pagante && <div className="sub">pago por {p.pagante}</div>}</td>
        <td className="sub">{p.descricao || p.modalidade}</td><td className="sub">{nomeProf(p.profissional_id) || '—'}</td>
        <td className="sub">{p.forma}{p.parcelas > 1 ? ' · ' + p.parcelas + 'x' : ''}</td><td className="num"><b>{brl(p.valor)}</b></td>{gestao && <td className="num sub">{brl(p.liquido)}</td>}<td className="sub num">{p.cv}</td><td className="sub num">{p.nf}</td></tr>)}
    </tbody></table> : <Empty t="Nenhum pagamento neste mês">Use “+ Pagamento” para lançar um recebimento.</Empty>}</section>
    {modal && <PagamentoForm pagamento={modal.p} onClose={() => setModal(null)} onSaved={carregar} />}
  </>
}
