import { useState } from 'react'
import { sb } from '../lib/supabase'
import { useBase } from '../lib/store'
import type { Produto } from '../lib/types'
import { brl } from '../lib/util'

const PERS = ['Mensal', 'Trimestral', 'Semestral', 'Anual']
const BASE_SESSAO: Record<string, number> = { 'Reabilitação Funcional': 160, 'Body Shape': 130, 'Sauna': 35 }

export function Tabela() {
  const { produtos, config, perfil, toast, recarregarConfig } = useBase()
  const [edit, setEdit] = useState(false); const [vals, setVals] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false)
  const gestao = perfil.papel === 'admin'
  const ativos = produtos.filter(p => p.ativo)
  const num = (v: number) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  const cell = (p?: Produto) => !p ? <span className="sub">—</span> : edit ? <input className="tbin" type="number" step="0.01" aria-label={p.nome} value={vals[p.id] ?? String(p.valor)} onChange={e => setVals({ ...vals, [p.id]: e.target.value })} /> : num(p.valor)
  async function salvar() {
    setBusy(true)
    for (const [id, v] of Object.entries(vals)) {
      const p = produtos.find(x => x.id === id); if (!p || v === '' || Number(v) === Number(p.valor)) continue
      const r = await sb.from('produtos').update({ valor: Number(v), updated_at: new Date().toISOString() }).eq('id', id)
      if (r.error) { setBusy(false); return toast('Não foi possível salvar: ' + r.error.message) }
    }
    await recarregarConfig(); setBusy(false); setEdit(false); setVals({}); toast('Tabela atualizada. Contratos existentes não mudam.')
  }
  const semanais = ativos.filter(p => p.tipo === 'plano_semanal'); const grupos = [...new Set(semanais.map(p => p.grupo))]
  const pacotes = ativos.filter(p => p.tipo === 'pacote'); const gpac = [...new Set(pacotes.map(p => p.grupo))]
  const fixos = ativos.filter(p => p.tipo === 'preco_fixo'); const avulsos = ativos.filter(p => p.tipo === 'avulso')
  const desc = (g: string, per: string) => { const m = semanais.find(p => p.grupo === g && p.periodicidade === 'Mensal' && p.frequencia === 2); const x = semanais.find(p => p.grupo === g && p.periodicidade === per && p.frequencia === 2); return m && x && per !== 'Mensal' ? Math.floor((1 - x.valor / m.valor) * 100 + 1e-6) : 0 }
  return <>
    <div className="viewhead"><div><h1>Planos e valores</h1><p>Tabela de balcão{config.vigencia_tabela ? ' · vigência ' + config.vigencia_tabela : ''}{config.regra_geral ? ' · ' + config.regra_geral : ''}</p></div>
      {gestao && <div className="toolbar" style={{ margin: 0 }}>{edit ? <><button className="btn" onClick={() => { setEdit(false); setVals({}) }}>Cancelar</button><button className="btn pri" disabled={busy} onClick={salvar}>Salvar valores</button></> : <button className="btn" onClick={() => setEdit(true)}>Editar valores</button>}</div>}</div>
    {edit && <p className="note" style={{ marginBottom: 16 }}>Alterar a tabela vale só para contratos novos. Os contratos em andamento mantêm o valor atual.</p>}
    <div className="tbgrid">
      {grupos.map(g => { const ps = semanais.filter(p => p.grupo === g); const fs = [...new Set(ps.map(p => p.frequencia!))].sort(); const cap = ps[0]?.capacidade
        return <section className="panel tb" key={g}><header><div><h2>{g}</h2><p>{ps[0]?.nota}</p></div>{cap && <span className="chip c-ok">até {cap} por horário</span>}</header>
          <div className="tbl"><table><thead><tr><th>Por semana</th>{PERS.map(x => <th key={x} className="num">{x}{desc(g, x) ? <span className="disc"> −{desc(g, x)}%</span> : null}</th>)}</tr></thead><tbody>
            {fs.map(f => <tr key={f}><td><b>{f}×</b></td>{PERS.map(x => <td key={x} className="num">{cell(ps.find(p => p.frequencia === f && p.periodicidade === x))}</td>)}</tr>)}
          </tbody></table></div><p className="sub tbfoot">Valores mensais por pessoa, em R$.</p></section> })}
      <section className="panel tb"><header><div><h2>Avaliações e preço único</h2></div></header><div className="tbl"><table><tbody>
        {fixos.map(p => <tr key={p.id}><td><b>{p.nome}</b><div className="sub">{p.nota}</div></td><td className="num">{cell(p)}<div className="sub">{p.periodicidade === 'Mensal' ? 'por mês' : 'por trimestre'}</div></td></tr>)}
        {avulsos.map(p => <tr key={p.id}><td><b>{p.nome}</b></td><td className="num">{cell(p)}</td></tr>)}
      </tbody></table></div></section>
      {gpac.map(g => { const ps = pacotes.filter(p => p.grupo === g); const b = BASE_SESSAO[g]
        return <section className="panel tb" key={g}><header><div><h2>{g}</h2><p>{ps[0]?.nota}</p></div></header>
          <div className="tbl"><table><thead><tr><th></th><th className="num">Sessões</th><th className="num">Valor</th><th className="num">Por sessão</th><th className="num">Desconto</th></tr></thead><tbody>
            {ps.map(p => { const s = p.valor / (p.sessoes || 1); const d = b ? Math.floor((1 - s / b) * 100 + 1e-6) : 0
              return <tr key={p.id}><td><b>{p.nome.split(' · ').slice(1).join(' · ') || p.nome}</b></td><td className="num">{p.sessoes}</td><td className="num">{cell(p)}</td><td className="num">{brl(s)}</td><td className="num">{(p.sessoes || 0) > 1 && d > 0 ? d + '%' : '—'}</td></tr> })}
          </tbody></table></div></section> })}
      {config.inclusos && <section className="panel tb"><header><div><h2>O que vem junto</h2><p>A diferença real entre um prazo e outro</p></div></header><div className="tbl"><table>
        <thead><tr><th></th>{config.inclusos.colunas.map((c: string) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{config.inclusos.linhas.map((l: any) => <tr key={l.item}><td><b>{l.item}</b></td>{l.v.map((x: string, i: number) => <td key={i}>{x}</td>)}</tr>)}</tbody></table></div></section>}
    </div>
    {(config.notas_balcao || []).length > 0 && <section className="panel" style={{ marginTop: 16 }}><header><h2>Regras do balcão</h2></header><div className="pbody listx">{config.notas_balcao.map((n: string) => <div key={n}><span>{n}</span></div>)}</div></section>}
  </>
}
