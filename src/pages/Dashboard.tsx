import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { stContrato, tituloContrato, useBase, valorCobranca } from '../lib/store'
import type { Contrato } from '../lib/types'
import { addMonths, br, brl, DIAS_L, hoje, MESES } from '../lib/util'
import { PagamentoForm } from '../components/forms'
import { ChipContrato, Empty } from '../components/ui'
import { useSlots } from './Agenda'

export function Dashboard({ abrirCliente, ir }: { abrirCliente: (id: string) => void; ir: (tab: string, filtro?: string) => void }) {
  const { clientes, contratos, uso, profissionais, horarios, perfil } = useBase()
  const t = hoje(); const mes = t.slice(0, 7); const mesAnt = addMonths(t, -1).slice(0, 7)
  const [rec, setRec] = useState<{ m: number; a: number } | null>(null)
  const [pg, setPg] = useState<string | null>(null)
  const { porDia } = useSlots(t, t)
  const gestao = perfil.papel === 'admin'
  useEffect(() => {
    sb.from('pagamentos').select('valor,data').gte('data', mesAnt + '-01').then(r => {
      const d = (r.data as { valor: number; data: string }[]) || []
      setRec({ m: d.filter(x => x.data.startsWith(mes)).reduce((s, x) => s + Number(x.valor), 0), a: d.filter(x => x.data.startsWith(mesAnt)).reduce((s, x) => s + Number(x.valor), 0) })
    })
  }, [pg])
  const ativos = [...clientes.values()].filter(c => c.status === 'ativo')
  const cs = [...contratos.values()].filter(c => c.status === 'ativo' && clientes.get(c.cliente_id)?.status === 'ativo')
  const st = (c: Contrato) => stContrato(c, uso.get(c.id))
  const atr = cs.filter(c => st(c) === 'atrasado').sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''))
  const vence = cs.filter(c => st(c) === 'vence').sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''))
  const fim = cs.filter(c => st(c) === 'fim')
  const semH = cs.filter(c => c.tipo === 'plano' && !horarios.some(h => h.contrato_id === c.id))
  const mm = t.slice(5, 7)
  const aniv = ativos.filter(a => a.nascimento?.slice(5, 7) === mm).sort((a, b) => a.nascimento!.slice(8).localeCompare(b.nascimento!.slice(8)))
  const hojeN = (porDia.get(t) || []).length
  const Tab = ({ list, vazio }: { list: Contrato[]; vazio: string }) => list.length ? <div className="tbl"><table><thead><tr><th>Cliente</th><th className="num">Vencimento</th><th>Situação</th><th className="num">A receber</th><th></th></tr></thead><tbody>
    {list.map(c => <tr key={c.id} className="click" onClick={() => abrirCliente(c.cliente_id)}>
      <td><b>{clientes.get(c.cliente_id)?.nome}</b><div className="sub">{tituloContrato(c)}{c.profissional_id ? ' · ' + profissionais.find(p => p.id === c.profissional_id)?.nome : ''}</div></td>
      <td className="num">{br(c.vencimento)}</td><td><ChipContrato st={st(c)} venc={c.vencimento} /></td><td className="num">{brl(valorCobranca(c))}</td>
      <td className="num"><button className="btn sm" onClick={e => { e.stopPropagation(); setPg(c.id) }}>Receber</button></td></tr>)}
  </tbody></table></div> : <Empty t={vazio} />
  return <>
    <div className="viewhead"><div><h1>Dashboard</h1><p>{DIAS_L[new Date().getDay()]}, {+t.slice(8)} de {MESES[+mm - 1]}</p></div></div>
    <div className="kpis">
      <div className="kpi"><span>Clientes ativos</span><b className="num">{ativos.length}</b><em>{hojeN} atendimentos hoje</em></div>
      <div className="kpi bad"><span>Em atraso</span><b className="num">{atr.length}</b><em>{brl(atr.reduce((s, c) => s + (valorCobranca(c) || 0), 0))}</em></div>
      <div className="kpi warn"><span>Vencem em 7 dias</span><b className="num">{vence.length}</b><em>{brl(vence.reduce((s, c) => s + (valorCobranca(c) || 0), 0))}</em></div>
      <div className="kpi"><span>Recebido em {MESES[+mm - 1]}</span><b className="num">{rec ? brl(rec.m) : '…'}</b><em>{MESES[+mesAnt.slice(5) - 1]}: {rec ? brl(rec.a) : '…'}</em></div>
    </div>
    <div className="grid2">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <section className="panel"><header><div><h2>Em atraso</h2><p>Contratos ativos com vencimento passado</p></div></header><Tab list={atr} vazio="Nenhum cliente em atraso." /></section>
        <section className="panel"><header><div><h2>Vencem nos próximos 7 dias</h2><p>Bom momento para lembrar o cliente</p></div></header><Tab list={vence} vazio="Nenhum vencimento nos próximos 7 dias." /></section>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <section className="panel"><header><h2>Atenção</h2></header><div className="pbody listx">
          <div><span>Pacotes concluídos (oferecer renovação)</span><button className="btn sm" onClick={() => ir('contratos', 'fim')}>{fim.length}</button></div>
          <div><span>Planos sem horário fixo</span><button className="btn sm" onClick={() => ir('contratos', 'semhorario')}>{semH.length}</button></div>
          <div><span>Contratos sem vencimento</span><button className="btn sm" onClick={() => ir('contratos', 'sem')}>{cs.filter(c => st(c) === 'sem').length}</button></div>
        </div></section>
        <section className="panel"><header><h2>Aniversariantes de {MESES[+mm - 1]}</h2></header><div className="pbody listx">
          {aniv.length ? aniv.map(a => <div key={a.id}><a style={{ cursor: 'pointer' }} onClick={() => abrirCliente(a.id)}>{a.nome}</a><span className="num sub">{a.nascimento!.slice(8)}/{mm}</span></div>) : <div className="sub">Nenhum aniversariante com data cadastrada.</div>}
        </div></section>
        {gestao && <p className="sub">Dica: as regras de repasse, taxas de cartão e imposto ficam em Configurações.</p>}
      </div>
    </div>
    {pg && <PagamentoForm contratoId={pg} onClose={() => setPg(null)} />}
  </>
}
