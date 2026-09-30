import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useBase } from '../lib/store'
import type { Repasse as R } from '../lib/types'
import { addMonths, baixar, br, brl, csv, hoje, mesLabel } from '../lib/util'
import { Empty } from '../components/ui'

export function Repasse() {
  const { profissionais, perfil, toast } = useBase()
  const [mes, setMes] = useState(hoje().slice(0, 7)); const [rows, setRows] = useState<R[]>([]); const [sel, setSel] = useState<string>(''); const [tick, setTick] = useState(0)
  const gestao = perfil.papel === 'gestao'
  useEffect(() => { sb.from('repasses').select('*').eq('competencia', mes + '-01').order('created_at').then(r => setRows((r.data as R[]) || [])) }, [mes, tick])
  const nome = (id: string) => profissionais.find(p => p.id === id)?.nome || '—'
  const porProf = [...new Set(rows.map(r => r.profissional_id))].map(id => {
    const rs = rows.filter(r => r.profissional_id === id)
    return { id, n: rs.length, base: rs.reduce((s, r) => s + Number(r.base), 0), est: rs.reduce((s, r) => s + Number(r.valor_estudio || 0), 0), prof: rs.reduce((s, r) => s + Number(r.valor_profissional || 0), 0), semRegra: rs.filter(r => r.pct_estudio == null).length }
  }).sort((a, b) => nome(a.id).localeCompare(nome(b.id)))
  const det = rows.filter(r => !sel || r.profissional_id === sel)
  function exportar() {
    baixar(`repasse-${mes}.csv`, csv([['Profissional', 'Origem', 'Descrição', 'Data', 'Base líquida', '% estúdio', 'Estúdio', 'Profissional', 'Base estimada'],
      ...det.map(r => [nome(r.profissional_id), r.origem === 'sessao' ? 'Sessão' : 'Pagamento', r.descricao, br(r.created_at.slice(0, 10)), String(r.base).replace('.', ','), r.pct_estudio ?? 'sem regra', String(r.valor_estudio ?? '').replace('.', ','), String(r.valor_profissional ?? '').replace('.', ','), r.base_estimada ? 'sim' : ''])]))
  }
  return <>
    <div className="viewhead"><div><h1>{gestao ? 'Repasse' : 'Meu repasse'}</h1><p>Planos e avulsos: no mês do pagamento. Pacotes: a cada sessão realizada. Base: valor líquido de taxa de cartão e imposto.</p></div><div className="toolbar" style={{ margin: 0 }}>{gestao && <button className="btn" title="Aplica as regras de repasse atuais aos lançamentos do mês" onClick={async () => { const r = await sb.rpc('recalcular_repasse', { p_mes: mes + '-01' }); if (r.error) toast('Não foi possível recalcular: ' + r.error.message); else { toast('Repasse do mês recalculado'); setTick(t => t + 1) } }}>Recalcular mês</button>}<button className="btn" onClick={exportar}>Exportar CSV</button></div></div>
    <div className="toolbar"><div className="datenav"><button className="btn sm" onClick={() => setMes(addMonths(mes + '-01', -1).slice(0, 7))} aria-label="Mês anterior">‹</button><strong>{mesLabel(mes)}</strong><button className="btn sm" onClick={() => setMes(addMonths(mes + '-01', 1).slice(0, 7))} aria-label="Próximo mês">›</button></div>
      {gestao && porProf.length > 1 && <select value={sel} onChange={e => setSel(e.target.value)} aria-label="Profissional"><option value="">Todos os profissionais</option>{porProf.map(p => <option key={p.id} value={p.id}>{nome(p.id)}</option>)}</select>}</div>
    {!rows.length ? <section className="panel"><Empty t="Nenhum repasse neste mês">O repasse é lançado automaticamente quando um pagamento é registrado ou uma sessão de pacote é marcada.</Empty></section> : <>
      <section className="panel tbl" style={{ marginBottom: 16 }}><table><thead><tr><th>Profissional</th><th className="num">Lançamentos</th><th className="num">Base líquida</th><th className="num">Estúdio</th><th className="num">A pagar ao profissional</th><th></th></tr></thead><tbody>
        {porProf.map(p => <tr key={p.id} className="click" onClick={() => setSel(p.id)}><td><b>{nome(p.id)}</b></td><td className="num">{p.n}</td><td className="num">{brl(p.base)}</td><td className="num">{brl(p.est)}</td><td className="num"><b>{brl(p.prof)}</b></td>
          <td>{p.semRegra ? <span className="chip c-atrasado">{p.semRegra} sem regra</span> : null}</td></tr>)}
      </tbody></table></section>
      <section className="panel tbl"><header><h2>{sel ? 'Lançamentos de ' + nome(sel) : 'Todos os lançamentos'}</h2>{sel && <button className="btn sm ghost" onClick={() => setSel('')}>Ver todos</button>}</header>
        <table><thead><tr><th>Descrição</th><th>Origem</th><th className="num">Base</th><th className="num">% estúdio</th><th className="num">Estúdio</th><th className="num">Profissional</th></tr></thead><tbody>
          {det.map(r => <tr key={r.id}><td>{r.descricao}{gestao && !sel ? <div className="sub">{nome(r.profissional_id)}</div> : null}</td><td className="sub">{r.origem === 'sessao' ? 'Sessão' : 'Pagamento'}</td>
            <td className="num">{brl(r.base)}{r.base_estimada && <span className="tag" title="Pacote ainda sem pagamento registrado: base estimada pelo valor do contrato">estim.</span>}</td>
            <td className="num">{r.pct_estudio == null ? <span className="chip c-atrasado">sem regra</span> : r.pct_estudio + '%'}</td><td className="num">{brl(r.valor_estudio)}</td><td className="num"><b>{brl(r.valor_profissional)}</b></td></tr>)}
        </tbody></table></section></>}
  </>
}
