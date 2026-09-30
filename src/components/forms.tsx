import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { sb } from '../lib/supabase'
import { tituloContrato, useBase, valorCobranca } from '../lib/store'
import type { Atendimento, Cliente, Contrato, Pagamento, Produto, StatusAt } from '../lib/types'
import { addMonths, br, brl, DIAS, FORMAS, hm, hoje, MESES_PER, norm, parse } from '../lib/util'
import { Confirmar, Modal } from './ui'

const erro = (toast: (m: string) => void, e: any) => {
  const m = String(e?.message || e)
  toast(/row-level security|permission/i.test(m) ? 'Seu perfil não tem permissão para esta ação.' : 'Não foi possível salvar: ' + m)
}

// ---------------- Cliente ----------------
export function ClienteForm({ cliente, nomeInicial, onClose, onSaved }: { cliente?: Cliente; nomeInicial?: string; onClose: () => void; onSaved?: (id: string, nome: string) => void }) {
  const { toast, recarregar } = useBase()
  const [f, setF] = useState({ nome: cliente?.nome || nomeInicial || '', telefone: cliente?.telefone || '', email: cliente?.email || '', nascimento: cliente?.nascimento || '', status: cliente?.status || 'ativo', obs: cliente?.obs || '' })
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  async function salvar(e: FormEvent) {
    e.preventDefault(); if (!f.nome.trim()) return toast('Informe o nome.')
    setBusy(true)
    const doc = { ...f, nome: f.nome.trim(), nascimento: f.nascimento || null, telefone: f.telefone || null, email: f.email || null, obs: f.obs || null }
    const r = cliente ? await sb.from('clientes').update(doc).eq('id', cliente.id).select('id').single() : await sb.from('clientes').insert(doc).select('id').single()
    setBusy(false)
    if (r.error) return erro(toast, r.error)
    await recarregar(); toast(cliente ? 'Cliente atualizado' : 'Cliente cadastrado'); onSaved?.(r.data.id, doc.nome); onClose()
  }
  return <Modal title={cliente ? 'Editar cliente' : 'Novo cliente'} onClose={onClose}>
    <form onSubmit={salvar}>
      <label className="f full">Nome completo<input id="cl_nome" required value={f.nome} onChange={set('nome')} autoFocus /></label>
      <label className="f">Telefone / WhatsApp<input id="cl_tel" inputMode="tel" value={f.telefone} onChange={set('telefone')} /></label>
      <label className="f">Nascimento<input id="cl_nasc" type="date" value={f.nascimento} onChange={set('nascimento')} /></label>
      <label className="f">E-mail<input id="cl_email" type="email" value={f.email} onChange={set('email')} /></label>
      <label className="f">Situação<select id="cl_status" value={f.status} onChange={set('status')}><option value="ativo">Ativo</option><option value="trancado">Trancado</option><option value="inativo">Inativo</option></select></label>
      <label className="f full">Observações<textarea id="cl_obs" value={f.obs} onChange={set('obs')} /></label>
      <footer><span /><div className="inline"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" disabled={busy}>Salvar</button></div></footer>
    </form>
  </Modal>
}

// ---------------- Contrato ----------------
type H = { dia_semana: number; hora: string }
export function ContratoForm({ contrato, clienteId, onClose, onSaved }: { contrato?: Contrato; clienteId: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const { produtos, profissionais, horarios, toast, recarregar, clientes } = useBase()
  const semanais = produtos.filter(p => p.tipo === 'plano_semanal' && p.ativo)
  const grupos = [...new Set(semanais.map(p => p.grupo))]
  const outros = produtos.filter(p => (p.tipo === 'preco_fixo' || p.tipo === 'pacote') && p.ativo)
  const prod0 = produtos.find(p => p.id === contrato?.produto_id)
  const [base, setBase] = useState<string>(prod0 ? (prod0.tipo === 'plano_semanal' ? 'g:' + prod0.grupo : prod0.id) : contrato ? '' : (grupos[0] ? 'g:' + grupos[0] : ''))
  const [freq, setFreq] = useState<number>(prod0?.frequencia || contrato?.frequencia || 2)
  const [per, setPer] = useState<string>(prod0?.periodicidade || contrato?.periodicidade || 'Mensal')
  const [f, setF] = useState({
    profissional_id: contrato?.profissional_id || '', modalidade: contrato?.modalidade || '', descricao: contrato?.descricao || '',
    valor: contrato?.valor != null ? String(contrato.valor) : '', sessoes: contrato?.sessoes != null ? String(contrato.sessoes) : '',
    inicio: contrato?.inicio || hoje(), vencimento: contrato?.vencimento || '', status: contrato?.status || 'ativo', obs: contrato?.obs || '',
  })
  const [hs, setHs] = useState<H[]>(contrato ? horarios.filter(h => h.contrato_id === contrato.id).map(h => ({ dia_semana: h.dia_semana, hora: hm(h.hora) })) : [])
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })

  const sel: Produto | undefined = base.startsWith('g:') ? semanais.find(p => p.grupo === base.slice(2) && p.frequencia === freq && p.periodicidade === per) : produtos.find(p => p.id === base)
  const tipo: 'plano' | 'pacote' = sel ? (sel.tipo === 'pacote' ? 'pacote' : 'plano') : (f.sessoes ? 'pacote' : 'plano')
  const meses = sel ? (sel.tipo === 'pacote' ? 0 : sel.meses || MESES_PER[sel.periodicidade || ''] || 1) : (MESES_PER[per] || 1)
  const freqs = base.startsWith('g:') ? [...new Set(semanais.filter(p => p.grupo === base.slice(2)).map(p => p.frequencia!))].sort() : []
  const pers = base.startsWith('g:') ? ['Mensal', 'Trimestral', 'Semestral', 'Anual'] : []

  // aplica tabela quando muda a escolha (só em contrato novo ou quando o usuário mexe)
  function aplicar(b: string, fr: number, pe: string) {
    const p = b.startsWith('g:') ? semanais.find(x => x.grupo === b.slice(2) && x.frequencia === fr && x.periodicidade === pe) : produtos.find(x => x.id === b)
    if (!p) { if (b.startsWith('g:')) setF(v => ({ ...v, valor: '' })); return }
    const m = p.tipo === 'pacote' ? 0 : p.meses || 1
    const valor = p.tipo === 'preco_fixo' ? Math.round(p.valor / m * 100) / 100 : p.valor
    const venc = p.tipo === 'pacote' ? (p.validade_meses ? addMonths(f.inicio, p.validade_meses) : '') : addMonths(f.inicio, m)
    setF(v => ({ ...v, modalidade: p.modalidade, valor: String(valor), sessoes: p.sessoes ? String(p.sessoes) : '', vencimento: venc, descricao: '' }))
  }
  // contrato novo: já preenche com o produto sugerido
  useEffect(() => { if (!contrato) aplicar(base, freq, per) }, [])
  const hint = sel ? (sel.tipo === 'pacote'
    ? `${sel.sessoes} sessão(ões) · ${brl(sel.valor / (sel.sessoes || 1))} por sessão${sel.validade_meses ? ' · válido por ' + sel.validade_meses + ' meses' : ''}. ${sel.nota || ''}`
    : sel.tipo === 'preco_fixo' ? `${brl(sel.valor)} por ${sel.periodicidade === 'Mensal' ? 'mês' : 'trimestre'}. ${sel.nota || ''}`
      : `Tabela: ${brl(sel.valor)}/mês${meses > 1 ? ' · ' + brl(sel.valor * meses) + ' no período' : ''}. Até ${sel.capacidade} por horário.`)
    : base.startsWith('g:') ? `${freq}× por semana não é vendido no ${per.toLowerCase()}.` : 'Contrato fora da tabela: preencha modalidade e valor.'

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!f.modalidade.trim()) return toast('Informe a modalidade.')
    if (f.valor === '') return toast('Informe o valor.')
    setBusy(true)
    const doc = {
      cliente_id: clienteId, produto_id: sel?.id || null, profissional_id: f.profissional_id || null, tipo,
      modalidade: f.modalidade.trim(), descricao: f.descricao.trim() || null, frequencia: sel?.frequencia || (base.startsWith('g:') ? freq : null),
      periodicidade: sel?.periodicidade || (tipo === 'plano' ? per : null), meses, valor: Number(f.valor), sessoes: tipo === 'pacote' && f.sessoes ? Number(f.sessoes) : null,
      inicio: f.inicio, vencimento: f.vencimento || null, status: f.status, obs: f.obs.trim() || null,
    }
    const r = contrato ? await sb.from('contratos').update(doc).eq('id', contrato.id).select('id').single() : await sb.from('contratos').insert(doc).select('id').single()
    if (r.error) { setBusy(false); return erro(toast, r.error) }
    const id = r.data.id
    const d = await sb.from('horarios').delete().eq('contrato_id', id)
    if (d.error) { setBusy(false); return erro(toast, d.error) }
    const uniq = [...new Map(hs.filter(h => h.hora).map(h => [h.dia_semana + '@' + h.hora, h])).values()]
    if (uniq.length) { const i = await sb.from('horarios').insert(uniq.map(h => ({ contrato_id: id, ...h }))); if (i.error) { setBusy(false); return erro(toast, i.error) } }
    await recarregar(); setBusy(false); toast('Contrato salvo'); onSaved?.(id); onClose()
  }
  async function excluir() {
    if (!contrato) return
    const r = await sb.from('contratos').delete().eq('id', contrato.id)
    if (r.error) return erro(toast, r.error)
    await recarregar(); toast('Contrato excluído'); onClose()
  }
  const nomeCli = clientes.get(clienteId)?.nome || ''
  return <Modal title={(contrato ? 'Editar contrato · ' : 'Novo contrato · ') + nomeCli} onClose={onClose} wide>
    <form onSubmit={salvar}>
      <label className="f full">Produto da tabela
        <select id="ct_base" value={base} onChange={e => { setBase(e.target.value); aplicar(e.target.value, freq, per) }}>
          <optgroup label="Planos semanais">{grupos.map(g => <option key={g} value={'g:' + g}>{g}</option>)}</optgroup>
          {[...new Set(outros.map(o => o.grupo))].map(g => <optgroup key={g} label={g}>{outros.filter(o => o.grupo === g).map(o => <option key={o.id} value={o.id}>{o.nome} · {brl(o.valor)}</option>)}</optgroup>)}
          <option value="">Personalizado (fora da tabela)</option>
        </select></label>
      {base.startsWith('g:') && <>
        <label className="f">Frequência<select id="ct_freq" value={freq} onChange={e => { setFreq(+e.target.value); aplicar(base, +e.target.value, per) }}>{freqs.map(n => <option key={n} value={n}>{n}× por semana</option>)}</select></label>
        <label className="f">Periodicidade<select id="ct_per" value={per} onChange={e => { setPer(e.target.value); aplicar(base, freq, e.target.value) }}>{pers.map(n => <option key={n}>{n}</option>)}</select></label>
      </>}
      {!sel && !base.startsWith('g:') && <label className="f">Periodicidade<select id="ct_per2" value={f.sessoes ? '' : per} onChange={e => setPer(e.target.value)}><option>Mensal</option><option>Trimestral</option><option>Semestral</option><option>Anual</option></select></label>}
      <p className="sub full" style={{ margin: '-4px 0 0' }}>{hint}</p>
      <label className="f">Modalidade<input id="ct_mod" value={f.modalidade} onChange={set('modalidade')} /></label>
      <label className="f">Profissional<select id="ct_prof" value={f.profissional_id} onChange={set('profissional_id')}><option value="">—</option>{profissionais.filter(p => p.ativo || p.id === f.profissional_id).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="f">{tipo === 'pacote' ? 'Valor do pacote (R$)' : 'Valor mensal (R$)'}<input id="ct_valor" type="number" step="0.01" min="0" value={f.valor} onChange={set('valor')} /></label>
      {tipo === 'pacote' || !sel ? <label className="f">Sessões no pacote<input id="ct_sess" type="number" min="1" value={f.sessoes} onChange={set('sessoes')} placeholder={sel ? '' : 'só para pacotes'} /></label> : <span />}
      <label className="f">Início<input id="ct_ini" type="date" required value={f.inicio} onChange={set('inicio')} /></label>
      <label className="f">{tipo === 'pacote' ? 'Validade' : 'Próximo vencimento'}<input id="ct_venc" type="date" value={f.vencimento} onChange={set('vencimento')} /></label>
      <label className="f">Situação<select id="ct_status" value={f.status} onChange={set('status')}><option value="ativo">Ativo</option><option value="encerrado">Encerrado</option></select></label>
      <label className="f">Descrição (opcional)<input id="ct_desc" value={f.descricao} onChange={set('descricao')} placeholder="ex.: Treino em dupla com Ana" /></label>
      <div className="full">
        <div className="sub" style={{ fontWeight: 500, marginBottom: 6 }}>Horários fixos na semana{sel?.frequencia && hs.length !== sel.frequencia ? ` · o plano prevê ${sel.frequencia}` : ''}</div>
        {hs.map((h, i) => <div className="hrow" key={i}>
          <select aria-label="Dia" value={h.dia_semana} onChange={e => setHs(hs.map((x, j) => j === i ? { ...x, dia_semana: +e.target.value } : x))}>{[1, 2, 3, 4, 5, 6, 0].map(d => <option key={d} value={d}>{DIAS[d]}</option>)}</select>
          <input type="time" step={900} aria-label="Horário" value={h.hora} onChange={e => setHs(hs.map((x, j) => j === i ? { ...x, hora: e.target.value } : x))} />
          <button type="button" className="btn sm ghost" aria-label="Remover horário" onClick={() => setHs(hs.filter((_, j) => j !== i))}>✕</button>
        </div>)}
        <button type="button" className="btn sm" onClick={() => setHs([...hs, { dia_semana: hs.length ? (hs[hs.length - 1].dia_semana % 6) + 1 : 1, hora: hs[0]?.hora || '07:00' }])}>+ Horário</button>
      </div>
      <label className="f full">Observações<textarea id="ct_obs" value={f.obs} onChange={set('obs')} /></label>
      <footer>{contrato ? <Confirmar label="Excluir contrato" onConfirm={excluir} /> : <span />}<div className="inline"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" disabled={busy}>Salvar</button></div></footer>
    </form>
  </Modal>
}

// Aviso + atalho quando o nome digitado não corresponde a um cliente cadastrado
function ClienteNaoEncontrado({ nome, onCadastrar }: { nome: string; onCadastrar: () => void }) {
  if (nome.trim().length < 3) return null
  return <div className="note full inline" style={{ justifyContent: 'space-between' }}>
    <span>Cliente não encontrado.</span>
    <button type="button" className="btn sm pri" onClick={onCadastrar}>+ Cadastrar “{nome.trim()}”</button>
  </div>
}

// ---------------- Pagamento ----------------
export function PagamentoForm({ pagamento, contratoId, clienteId, onClose, onSaved }: { pagamento?: Pagamento; contratoId?: string; clienteId?: string; onClose: () => void; onSaved?: () => void }) {
  const { clientes, contratos, produtos, profissionais, config, perfil, toast, recarregar } = useBase()
  const ct0 = contratoId ? contratos.get(contratoId) : pagamento?.contrato_id ? contratos.get(pagamento.contrato_id) : undefined
  const cli0 = clientes.get(pagamento?.cliente_id || ct0?.cliente_id || clienteId || '')
  const [nome, setNome] = useState(cli0?.nome || '')
  const [sub, setSub] = useState<null | 'cli' | 'ct'>(null); const [pendCt, setPendCt] = useState<string | null>(null)
  const cli = useMemo(() => [...clientes.values()].find(c => norm(c.nome) === norm(nome)), [nome, clientes])
  const cts = cli ? [...contratos.values()].filter(c => c.cliente_id === cli.id) : []
  const [ctId, setCtId] = useState(ct0?.id || '')
  const ct = ctId ? contratos.get(ctId) : undefined
  const [itemId, setItemId] = useState(pagamento?.produto_id && !pagamento.contrato_id ? pagamento.produto_id : '')
  const item = produtos.find(p => p.id === itemId)
  const [f, setF] = useState({
    data: pagamento?.data || hoje(), valor: pagamento ? String(pagamento.valor) : ct0 ? String(valorCobranca(ct0) ?? '') : '',
    forma: pagamento?.forma || 'Pix', parcelas: String(pagamento?.parcelas || 1), cv: pagamento?.cv || '', nf: pagamento?.nf || '',
    pagante: pagamento?.pagante || '', obs: pagamento?.obs || '', profissional_id: pagamento?.profissional_id || ct0?.profissional_id || '',
  })
  const [renova, setRenova] = useState(true)
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const novoVenc = !pagamento && ct && ct.tipo === 'plano' && ct.meses ? addMonths(ct.vencimento || f.data, ct.meses) : null
  const taxas = config.taxas || {}
  const kTaxa = f.forma === 'Cartão de crédito' && +f.parcelas > 1 ? 'Cartão de crédito parcelado' : f.forma
  const fixo = (config.modo_desconto || 'fixo') === 'fixo'
  const taxa = fixo ? Number(config.desconto_fixo_pct || 0) : Number(taxas[kTaxa] || 0), imp = fixo ? 0 : Number(config.imposto_pct || 0)
  const liq = f.valor ? Number(f.valor) * (1 - (taxa + imp) / 100) : 0

  useEffect(() => { if (pendCt && contratos.has(pendCt)) { escolheCt(pendCt); setPendCt(null) } }, [pendCt, contratos])
  function escolheCt(id: string) { setCtId(id); const c = contratos.get(id); if (c) { setItemId(''); setF(v => ({ ...v, valor: String(valorCobranca(c) ?? ''), profissional_id: c.profissional_id || '' })) } }
  function escolheItem(id: string) { setItemId(id); const p = produtos.find(x => x.id === id); if (p) { setCtId(''); setF(v => ({ ...v, valor: String(p.valor) })) } }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!cli) return toast('Escolha um cliente da lista (ou cadastre-o primeiro).')
    if (!ct && !item && !pagamento) return toast('Escolha o contrato ou um item da tabela.')
    setBusy(true)
    let contrato_id = ct?.id || pagamento?.contrato_id || null
    // Venda de pacote sem contrato: cria o contrato do pacote automaticamente
    if (!pagamento && !ct && item && item.tipo === 'pacote') {
      const r = await sb.from('contratos').insert({
        cliente_id: cli.id, produto_id: item.id, profissional_id: f.profissional_id || null, tipo: 'pacote', modalidade: item.modalidade,
        descricao: item.nome, meses: 0, valor: item.valor, sessoes: item.sessoes, inicio: f.data,
        vencimento: item.validade_meses ? addMonths(f.data, item.validade_meses) : null,
      }).select('id').single()
      if (r.error) { setBusy(false); return erro(toast, r.error) }
      contrato_id = r.data.id
    }
    const doc = {
      data: f.data, cliente_id: cli.id, contrato_id, produto_id: item?.id || ct?.produto_id || pagamento?.produto_id || null,
      profissional_id: f.profissional_id || null, descricao: ct ? tituloContrato(ct) : item ? item.nome : pagamento?.descricao || null,
      modalidade: ct ? ct.modalidade : item ? item.modalidade : pagamento?.modalidade || null, valor: Number(f.valor), forma: f.forma,
      parcelas: Number(f.parcelas) || 1, cv: f.cv || null, nf: f.nf || null, pagante: f.pagante || null, obs: f.obs || null,
    }
    const r = pagamento ? await sb.from('pagamentos').update(doc).eq('id', pagamento.id) : await sb.from('pagamentos').insert(doc)
    if (r.error) { setBusy(false); return erro(toast, r.error) }
    if (renova && novoVenc && ct) { const u = await sb.from('contratos').update({ vencimento: novoVenc }).eq('id', ct.id); if (u.error) erro(toast, u.error) }
    await recarregar(); setBusy(false); toast(pagamento ? 'Pagamento atualizado' : 'Pagamento registrado' + (renova && novoVenc ? ' · vence ' + br(novoVenc) : '')); onSaved?.(); onClose()
  }
  async function excluir() {
    if (!pagamento) return
    const r = await sb.from('pagamentos').delete().eq('id', pagamento.id)
    if (r.error) return erro(toast, r.error)
    toast('Pagamento excluído'); onSaved?.(); onClose()
  }
  const vendaveis = produtos.filter(p => p.ativo && (p.tipo === 'avulso' || p.tipo === 'pacote'))
  return <Modal title={pagamento ? 'Editar pagamento' : 'Registrar pagamento'} onClose={onClose}>
    <form onSubmit={salvar}>
      <label className="f full">Cliente<input id="pg_cli" list="dlClientes" required value={nome} onChange={e => { setNome(e.target.value); setCtId('') }} placeholder="Digite o nome" autoComplete="off" /></label>
      {!cli && !pagamento && <ClienteNaoEncontrado nome={nome} onCadastrar={() => setSub('cli')} />}
      <datalist id="dlClientes">{[...clientes.values()].map(c => <option key={c.id} value={c.nome} />)}</datalist>
      <label className="f full">Contrato<select id="pg_ct" value={ctId} onChange={e => escolheCt(e.target.value)}>
        <option value="">{cli ? (cts.length ? 'Sem contrato (venda avulsa)' : 'Cliente sem contrato') : 'Escolha o cliente primeiro'}</option>
        {cts.map(c => <option key={c.id} value={c.id}>{tituloContrato(c)}{c.status !== 'ativo' ? ' (encerrado)' : ''}{c.vencimento ? ' · vence ' + br(c.vencimento) : ''}</option>)}
      </select>{cli && !pagamento && <button type="button" className="btn sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => setSub('ct')}>+ Novo contrato para {cli.nome.split(' ')[0]}</button>}</label>
      {!ctId && !pagamento && <label className="f full">Item da tabela<select id="pg_item" value={itemId} onChange={e => escolheItem(e.target.value)}>
        <option value="">—</option>
        {[...new Set(vendaveis.map(p => p.grupo))].map(g => <optgroup key={g} label={g}>{vendaveis.filter(p => p.grupo === g).map(p => <option key={p.id} value={p.id}>{p.nome} · {brl(p.valor)}</option>)}</optgroup>)}
      </select>{item?.tipo === 'pacote' && <span className="sub">O contrato do pacote será criado automaticamente.</span>}</label>}
      <label className="f">Data<input id="pg_data" type="date" required value={f.data} onChange={set('data')} /></label>
      <label className="f">Valor (R$)<input id="pg_valor" type="number" step="0.01" min="0" required value={f.valor} onChange={set('valor')} /></label>
      <label className="f">Forma<select id="pg_forma" value={f.forma} onChange={set('forma')}>{FORMAS.map(x => <option key={x}>{x}</option>)}</select></label>
      <label className="f">Parcelas<select id="pg_parc" value={f.parcelas} onChange={set('parcelas')}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <option key={n} value={n}>{n === 1 ? 'À vista' : n + 'x'}</option>)}</select></label>
      <label className="f">Profissional (repasse)<select id="pg_prof" value={f.profissional_id} onChange={set('profissional_id')}><option value="">Nenhum (100% estúdio)</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="f">CV / autorização<input id="pg_cv" value={f.cv} onChange={set('cv')} /></label>
      <label className="f">Nota fiscal<input id="pg_nf" value={f.nf} onChange={set('nf')} /></label>
      <label className="f">Pago por (se outra pessoa)<input id="pg_pagante" value={f.pagante} onChange={set('pagante')} /></label>
      <label className="f full">Observação<input id="pg_obs" value={f.obs} onChange={set('obs')} /></label>
      {perfil.papel === 'gestao' && f.valor && <p className="sub full" style={{ margin: 0 }}>Líquido estimado {brl(liq)} ({fixo ? `desconto fixo ${taxa}%` : `taxa ${taxa}% · imposto ${imp}%`}).{ct?.tipo === 'pacote' || item?.tipo === 'pacote' ? ' Pacote: o repasse é lançado a cada sessão realizada.' : ''}</p>}
      {novoVenc && <label className="check full"><input type="checkbox" checked={renova} onChange={e => setRenova(e.target.checked)} /> Atualizar o vencimento do contrato para {br(novoVenc)}</label>}
      <footer>{pagamento && perfil.papel === 'gestao' ? <Confirmar label="Excluir" onConfirm={excluir} /> : <span />}<div className="inline"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" disabled={busy}>{pagamento ? 'Salvar' : 'Registrar'}</button></div></footer>
    </form>
    {sub === 'cli' && <ClienteForm nomeInicial={nome.trim()} onClose={() => setSub(null)} onSaved={(_, n) => { setNome(n); setCtId('') }} />}
    {sub === 'ct' && cli && <ContratoForm clienteId={cli.id} onClose={() => setSub(null)} onSaved={id => setPendCt(id)} />}
  </Modal>
}

// ---------------- Atendimento ----------------
export const ST: Record<StatusAt, { l: string; i: string }> = {
  confirmado: { l: 'Confirmado', i: '✓' }, compareceu: { l: 'Compareceu', i: '●' }, falta: { l: 'Faltou', i: '✕' },
  falta_avisada: { l: 'Faltou (avisou)', i: '◌' }, reposicao: { l: 'Reposição', i: '↻' }, cancelado: { l: 'Cancelado', i: '—' },
}
export interface Slot { data: string; hora: string; cliente_id: string; contrato_id: string | null; profissional_id: string | null; at?: Atendimento; origem: 'fixo' | 'extra' }
export function AtendimentoModal({ slot, onClose, onSaved, abrirCliente }: { slot: Slot; onClose: () => void; onSaved: () => void; abrirCliente: (id: string) => void }) {
  const { clientes, contratos, profissionais, config, toast, recarregar } = useBase()
  const c = slot.contrato_id ? contratos.get(slot.contrato_id) : undefined
  const st = slot.at?.status || 'confirmado'
  const prazo = config.prazo_aviso_falta_horas ?? 12
  async function set(novo: StatusAt) {
    const r = slot.at
      ? await sb.from('atendimentos').update({ status: novo }).eq('id', slot.at.id)
      : await sb.from('atendimentos').insert({ data: slot.data, hora: slot.hora, cliente_id: slot.cliente_id, contrato_id: slot.contrato_id, profissional_id: slot.profissional_id, origem: slot.origem, status: novo })
    if (r.error) return erro(toast, r.error)
    toast('Status: ' + ST[novo].l); onSaved(); if (c?.tipo === 'pacote') recarregar(); onClose()
  }
  async function remover() {
    if (!slot.at) return
    const r = await sb.from('atendimentos').delete().eq('id', slot.at.id)
    if (r.error) return erro(toast, r.error)
    toast('Agendamento removido'); onSaved(); recarregar(); onClose()
  }
  const b = (v: StatusAt, cls: string, lbl?: string) => <button type="button" className={'act ' + cls} aria-pressed={st === v} onClick={() => set(v)}>{ST[v].i} {lbl || ST[v].l}</button>
  const prof = profissionais.find(p => p.id === slot.profissional_id)
  return <Modal title={clientes.get(slot.cliente_id)?.nome || 'Atendimento'} onClose={onClose}>
    <div className="pbody" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 18px' }}>
      <div className="sub">{[c ? tituloContrato(c) : 'Aula extra', prof?.nome, hm(slot.hora)].filter(Boolean).join(' • ')} · {DIAS[parse(slot.data).getDay()]} {br(slot.data)}</div>
      <div>Status atual: <b>{ST[st].i} {ST[st].l}</b></div>
      <div className="acts">{b('compareceu', 'a-ok')}{b('reposicao', 'a-repos')}{b('falta', 'a-falta', 'Faltou sem aviso')}{b('falta_avisada', 'a-cancel', `Avisou (≥ ${prazo} h)`)}{b('cancelado', 'a-cancel', 'Cancelar')}</div>
      {c?.tipo === 'pacote' && <p className="sub" style={{ margin: 0 }}>Pacote: compareceu, reposição e falta sem aviso consomem uma sessão e geram repasse. Falta avisada com {prazo} h ou mais não consome.</p>}
      <div className="inline" style={{ justifyContent: 'space-between' }}>
        {slot.at && st !== 'confirmado' ? <button type="button" className="btn sm ghost" onClick={() => set('confirmado')}>Voltar para Confirmado</button> : slot.at && slot.origem === 'extra' ? <Confirmar className="btn sm danger" label="Remover agendamento" onConfirm={remover} /> : <span />}
        <button type="button" className="btn sm" onClick={() => { onClose(); abrirCliente(slot.cliente_id) }}>Abrir ficha do cliente</button>
      </div>
    </div>
  </Modal>
}

export function NovoAgendamento({ data, onClose, onSaved }: { data: string; onClose: () => void; onSaved: () => void }) {
  const { clientes, contratos, profissionais, toast } = useBase()
  const [nome, setNome] = useState(''); const [ctId, setCtId] = useState(''); const [sub, setSub] = useState<null | 'cli' | 'ct'>(null); const [f, setF] = useState({ data, hora: '07:00', profissional_id: '', obs: '' })
  const cli = [...clientes.values()].find(c => norm(c.nome) === norm(nome))
  const cts = cli ? [...contratos.values()].filter(c => c.cliente_id === cli.id && c.status === 'ativo') : []
  async function salvar(e: FormEvent) {
    e.preventDefault(); if (!cli) return toast('Escolha um cliente da lista.')
    const ct = contratos.get(ctId)
    const r = await sb.from('atendimentos').insert({ data: f.data, hora: f.hora, cliente_id: cli.id, contrato_id: ctId || null, profissional_id: f.profissional_id || ct?.profissional_id || null, origem: 'extra', status: 'confirmado', obs: f.obs || null })
    if (r.error) return erro(toast, r.error)
    toast('Agendamento criado'); onSaved(); onClose()
  }
  return <Modal title="Novo agendamento" onClose={onClose}>
    <form onSubmit={salvar}>
      <label className="f full">Cliente<input id="ag_cli" list="dlClientes2" required value={nome} onChange={e => { setNome(e.target.value); setCtId('') }} placeholder="Digite o nome" autoComplete="off" autoFocus /></label>
      {!cli && <ClienteNaoEncontrado nome={nome} onCadastrar={() => setSub('cli')} />}
      <datalist id="dlClientes2">{[...clientes.values()].filter(c => c.status === 'ativo').map(c => <option key={c.id} value={c.nome} />)}</datalist>
      <label className="f full">Contrato / pacote<select id="ag_ct" value={ctId} onChange={e => { setCtId(e.target.value); const c = contratos.get(e.target.value); if (c?.profissional_id) setF(v => ({ ...v, profissional_id: c.profissional_id! })) }}>
        <option value="">{cli ? 'Sem contrato (aula experimental, cortesia…)' : 'Escolha o cliente primeiro'}</option>
        {cts.map(c => <option key={c.id} value={c.id}>{tituloContrato(c)}</option>)}</select>{cli && <button type="button" className="btn sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => setSub('ct')}>+ Novo contrato / pacote</button>}</label>
      <label className="f">Data<input id="ag_data" type="date" required value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></label>
      <label className="f">Horário<input id="ag_hora" type="time" step={900} required value={f.hora} onChange={e => setF({ ...f, hora: e.target.value })} /></label>
      <label className="f">Profissional<select id="ag_prof" value={f.profissional_id} onChange={e => setF({ ...f, profissional_id: e.target.value })}><option value="">—</option>{profissionais.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="f">Observação<input id="ag_obs" value={f.obs} onChange={e => setF({ ...f, obs: e.target.value })} /></label>
      <footer><span /><div className="inline"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn pri">Agendar</button></div></footer>
    </form>
    {sub === 'cli' && <ClienteForm nomeInicial={nome.trim()} onClose={() => setSub(null)} onSaved={(_, n) => { setNome(n); setCtId('') }} />}
    {sub === 'ct' && cli && <ContratoForm clienteId={cli.id} onClose={() => setSub(null)} onSaved={id => setCtId(id)} />}
  </Modal>
}
