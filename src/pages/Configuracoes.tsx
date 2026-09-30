import { useEffect, useState, type FormEvent } from 'react'
import { sb } from '../lib/supabase'
import { useBase } from '../lib/store'
import type { Perfil, Profissional, Regra } from '../lib/types'
import { br, hoje } from '../lib/util'
import { Confirmar, Modal } from '../components/ui'

const PAPEIS: Record<string, string> = { pendente: 'Aguardando liberação', gestao: 'Gestão', recepcao: 'Recepção', profissional: 'Profissional' }
const senhaAleatoria = () => { const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; const a = crypto.getRandomValues(new Uint32Array(10)); a.forEach(n => s += c[n % c.length]); return s }

async function chamarUsuarios(body: Record<string, unknown>): Promise<string | null> {
  const r = await sb.functions.invoke('usuarios', { body })
  if (r.error) {
    try { const j = await (r.error as any).context?.json?.(); if (j?.erro) return j.erro } catch { /* ignora */ }
    return r.error.message
  }
  return (r.data as any)?.erro || null
}

function NovoUsuario({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { profissionais, toast } = useBase()
  const [f, setF] = useState({ nome: '', email: '', senha: senhaAleatoria(), papel: 'recepcao', profissional_id: '' })
  const [busy, setBusy] = useState(false); const [feito, setFeito] = useState<null | { email: string; senha: string }>(null)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  async function salvar(e: FormEvent) {
    e.preventDefault(); if (f.papel === 'profissional' && !f.profissional_id) return toast('Vincule o usuário a um profissional.')
    setBusy(true); const err = await chamarUsuarios({ acao: 'criar', ...f, profissional_id: f.profissional_id || null }); setBusy(false)
    if (err) return toast(err)
    onSaved(); setFeito({ email: f.email, senha: f.senha })
  }
  if (feito) return <Modal title="Usuário criado" onClose={onClose}><div className="pbody" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 18px' }}>
    <p style={{ margin: 0 }}>Envie estes dados para a pessoa. Ela pode trocar a senha em “Minha senha”, no canto superior direito, depois de entrar.</p>
    <dl className="dl"><dt>Endereço</dt><dd>{location.origin}</dd><dt>E-mail</dt><dd>{feito.email}</dd><dt>Senha provisória</dt><dd><b>{feito.senha}</b></dd></dl>
    <div className="inline" style={{ justifyContent: 'flex-end' }}>
      <button className="btn" onClick={() => { navigator.clipboard?.writeText(`Acesso ao sistema CareHub\n${location.origin}\nE-mail: ${feito.email}\nSenha provisória: ${feito.senha}`).then(() => toast('Copiado'), () => toast('Não foi possível copiar')) }}>Copiar mensagem</button>
      <button className="btn pri" onClick={onClose}>Concluir</button></div>
  </div></Modal>
  return <Modal title="Novo usuário" onClose={onClose}>
    <form onSubmit={salvar}>
      <label className="f full">Nome<input id="nu_nome" required value={f.nome} onChange={set('nome')} autoFocus /></label>
      <label className="f full">E-mail (será o login)<input id="nu_email" type="email" required value={f.email} onChange={set('email')} /></label>
      <label className="f">Perfil<select id="nu_papel" value={f.papel} onChange={set('papel')}><option value="recepcao">Recepção</option><option value="profissional">Profissional</option><option value="gestao">Gestão</option></select></label>
      <label className="f">Profissional vinculado<select id="nu_prof" value={f.profissional_id} onChange={set('profissional_id')} disabled={f.papel !== 'profissional'}><option value="">—</option>{profissionais.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="f full">Senha provisória<div className="inline"><input id="nu_senha" required minLength={8} value={f.senha} onChange={set('senha')} style={{ flex: 1 }} /><button type="button" className="btn sm" onClick={() => setF({ ...f, senha: senhaAleatoria() })}>Gerar outra</button></div></label>
      <p className="sub full" style={{ margin: 0 }}>O acesso já sai liberado, sem precisar confirmar e-mail.</p>
      <footer><span /><div className="inline"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" disabled={busy}>{busy ? 'Criando…' : 'Criar usuário'}</button></div></footer>
    </form>
  </Modal>
}

function RedefinirSenha({ u, onClose }: { u: Perfil; onClose: () => void }) {
  const { toast } = useBase(); const [s, setS] = useState(senhaAleatoria()); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false)
  return <Modal title={'Redefinir senha · ' + (u.nome || u.email)} onClose={onClose}>
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); const err = await chamarUsuarios({ acao: 'senha', user_id: u.id, senha: s }); setBusy(false); if (err) toast(err); else setOk(true) }}>
      <label className="f full">Nova senha provisória<input required minLength={8} value={s} onChange={e => setS(e.target.value)} disabled={ok} /></label>
      {ok && <p className="note full" style={{ margin: 0 }}>Senha alterada. Envie a nova senha para {u.email}.</p>}
      <footer><span /><div className="inline">{ok ? <button type="button" className="btn pri" onClick={onClose}>Concluir</button> : <><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" disabled={busy}>Salvar senha</button></>}</div></footer>
    </form>
  </Modal>
}

type Dados = Record<string, string>
const CAMPOS_PROF: [string, string, string?][] = [
  ['nome_completo', 'Nome completo'], ['cpf', 'CPF'], ['nascimento', 'Nascimento', 'date'], ['telefone', 'Telefone / WhatsApp', 'tel'],
  ['email', 'E-mail', 'email'], ['registro', 'Registro profissional (CREF, CREFITO…)'], ['especialidades', 'Especialidades / modalidades'],
  ['inicio', 'Na equipe desde', 'date'], ['cnpj', 'CNPJ (se PJ)'], ['razao_social', 'Razão social'], ['pix', 'Chave Pix'], ['banco', 'Banco / agência / conta'],
]
function ProfissionalForm({ prof, onClose }: { prof?: Profissional; onClose: () => void }) {
  const { toast, recarregarConfig } = useBase()
  const [nome, setNome] = useState(prof?.nome || ''); const [d, setD] = useState<Dados>({}); const [busy, setBusy] = useState(false); const [uso, setUso] = useState<number | null>(null)
  useEffect(() => {
    if (!prof) return
    sb.from('profissionais_dados').select('*').eq('profissional_id', prof.id).maybeSingle().then(r => { if (r.data) setD(Object.fromEntries(Object.entries(r.data).map(([k, v]) => [k, v == null ? '' : String(v)]))) })
    sb.rpc('uso_profissional', { p: prof.id }).then(r => setUso(r.data as number))
  }, [prof?.id])
  const set = (k: string) => (e: any) => setD({ ...d, [k]: e.target.value })
  async function salvar(e: FormEvent) {
    e.preventDefault(); if (!nome.trim()) return toast('Informe o nome.')
    setBusy(true)
    let id = prof?.id
    if (prof) { const r = await sb.from('profissionais').update({ nome: nome.trim() }).eq('id', prof.id); if (r.error) { setBusy(false); return toast('Não foi possível salvar: ' + r.error.message) } }
    else { const r = await sb.from('profissionais').insert({ nome: nome.trim() }).select('id').single(); if (r.error) { setBusy(false); return toast('Não foi possível salvar: ' + r.error.message) } id = r.data.id }
    const campos = Object.fromEntries([...CAMPOS_PROF.map(c => c[0]), 'vinculo', 'endereco', 'obs'].map(k => [k, (d[k] || '').trim() || null]))
    const r = await sb.from('profissionais_dados').upsert({ profissional_id: id, ...campos, updated_at: new Date().toISOString() })
    setBusy(false); if (r.error) return toast('Não foi possível salvar os dados: ' + r.error.message)
    await recarregarConfig(); toast('Profissional salvo'); onClose()
  }
  async function excluir() {
    if (!prof) return
    const r = await sb.from('profissionais').delete().eq('id', prof.id)
    if (r.error) return toast('Não foi possível excluir: ' + r.error.message)
    await recarregarConfig(); toast('Profissional excluído'); onClose()
  }
  return <Modal title={prof ? 'Profissional · ' + prof.nome : 'Novo profissional'} onClose={onClose} wide>
    <form onSubmit={salvar}>
      <label className="f">Nome na agenda<input id="pf_nome" required value={nome} onChange={e => setNome(e.target.value)} autoFocus={!prof} /></label>
      <label className="f">Vínculo<select id="pf_vinc" value={d.vinculo || ''} onChange={set('vinculo')}><option value="">—</option>{['PJ', 'CLT', 'Autônomo', 'Parceiro', 'Sócio'].map(v => <option key={v}>{v}</option>)}</select></label>
      {CAMPOS_PROF.map(([k, l, t]) => <label className="f" key={k}>{l}<input id={'pf_' + k} type={t || 'text'} value={d[k] || ''} onChange={set(k)} /></label>)}
      <label className="f full">Endereço<input id="pf_end" value={d.endereco || ''} onChange={set('endereco')} /></label>
      <label className="f full">Observações<textarea id="pf_obs" value={d.obs || ''} onChange={set('obs')} /></label>
      <p className="sub full" style={{ margin: 0 }}>Estes dados só aparecem para a gestão e para o próprio profissional.</p>
      <footer>{prof && uso === 0 ? <Confirmar label="Excluir profissional" onConfirm={excluir} /> : prof ? <span className="sub">Tem histórico no sistema: para retirar da equipe, use “Desativar”.</span> : <span />}
        <div className="inline"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" disabled={busy}>Salvar</button></div></footer>
    </form>
  </Modal>
}

export function Configuracoes() {
  const { profissionais, produtos, config, toast, recarregarConfig, perfil } = useBase()
  const [perfis, setPerfis] = useState<Perfil[]>([]); const [regras, setRegras] = useState<Regra[]>([])
  const [modal, setModal] = useState<null | { k: 'novoUser' } | { k: 'senha'; u: Perfil } | { k: 'prof'; p?: Profissional }>(null)
  const [nr, setNr] = useState({ profissional_id: '', modalidade: '', pct_estudio: '', vigencia_inicio: hoje() })
  const [taxas, setTaxas] = useState<Record<string, string>>({}); const [imp, setImp] = useState(''); const [prazo, setPrazo] = useState('')
  const [modo, setModo] = useState('fixo'); const [fixo, setFixo] = useState('')
  const carregar = () => {
    sb.from('perfis').select('*').order('created_at').then(r => setPerfis((r.data as Perfil[]) || []))
    sb.from('regras_repasse').select('*').order('vigencia_inicio', { ascending: false }).then(r => setRegras((r.data as Regra[]) || []))
  }
  useEffect(carregar, [])
  useEffect(() => {
    setTaxas(Object.fromEntries(Object.entries(config.taxas || {}).map(([k, v]) => [k, String(v)])))
    setImp(String(config.imposto_pct ?? 0)); setPrazo(String(config.prazo_aviso_falta_horas ?? 12)); setModo(config.modo_desconto || 'fixo'); setFixo(String(config.desconto_fixo_pct ?? 0))
  }, [config])
  const mods = [...new Set(produtos.map(p => p.modalidade))].sort()
  const nome = (id: string) => profissionais.find(p => p.id === id)?.nome || '—'
  const ok = (r: { error: any }, msg: string) => { if (r.error) { toast('Não foi possível salvar: ' + r.error.message); return false } toast(msg); return true }

  async function atualizaPerfil(id: string, patch: Partial<Perfil>) { if (ok(await sb.from('perfis').update(patch).eq('id', id), 'Usuário atualizado')) carregar() }
  async function addRegra() {
    if (!nr.profissional_id || nr.pct_estudio === '') return toast('Escolha o profissional e o percentual do estúdio.')
    if (ok(await sb.from('regras_repasse').insert({ ...nr, modalidade: nr.modalidade || null, pct_estudio: Number(nr.pct_estudio) }), 'Regra incluída. Use “Recalcular mês” no Repasse para aplicá-la a lançamentos já feitos.')) { setNr({ ...nr, pct_estudio: '' }); carregar() }
  }
  async function salvarFin() {
    const t = Object.fromEntries(Object.entries(taxas).map(([k, v]) => [k, Number(v) || 0]))
    const r = await sb.from('configuracoes').upsert([{ chave: 'taxas', valor: t }, { chave: 'imposto_pct', valor: Number(imp) || 0 }, { chave: 'prazo_aviso_falta_horas', valor: Number(prazo) || 0 }, { chave: 'modo_desconto', valor: modo }, { chave: 'desconto_fixo_pct', valor: Number(fixo) || 0 }])
    if (ok(r, 'Desconto salvo. Vale para os próximos pagamentos.')) recarregarConfig()
  }
  return <>
    <div className="viewhead"><div><h1>Configurações</h1><p>Usuários, profissionais, regras de repasse e desconto</p></div></div>
    <div className="cfggrid">
      <section className="panel"><header><div><h2>Usuários</h2><p>Crie o acesso aqui, ou a pessoa cria em “Criar conta” e você libera o perfil.</p></div><button className="btn pri sm" onClick={() => setModal({ k: 'novoUser' })}>+ Novo usuário</button></header>
        <div className="tbl"><table><thead><tr><th>Pessoa</th><th>Perfil</th><th>Profissional</th><th></th></tr></thead><tbody>
          {perfis.map(u => <tr key={u.id} style={u.ativo ? undefined : { opacity: .55 }}><td><b>{u.nome || u.email}</b><div className="sub">{u.email}{!u.ativo && ' · bloqueado'}</div></td>
            <td><select aria-label="Perfil" value={u.papel} disabled={u.id === perfil.id} onChange={e => atualizaPerfil(u.id, { papel: e.target.value as any })}>{Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
            <td><select aria-label="Profissional vinculado" value={u.profissional_id || ''} onChange={e => atualizaPerfil(u.id, { profissional_id: e.target.value || null })}><option value="">—</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></td>
            <td className="inline" style={{ flexWrap: 'nowrap' }}>{u.id !== perfil.id && <><button className="btn sm ghost" onClick={() => setModal({ k: 'senha', u })}>Senha</button><button className="btn sm ghost" onClick={() => atualizaPerfil(u.id, { ativo: !u.ativo })}>{u.ativo ? 'Bloquear' : 'Desbloquear'}</button></>}</td></tr>)}
        </tbody></table></div>
        <p className="sub" style={{ padding: '0 16px 12px' }}>Gestão vê tudo. Recepção opera agenda, clientes e pagamentos, mas não vê repasse nem corrige pagamentos. Profissional vê só a própria agenda, os próprios alunos e o próprio repasse.</p></section>

      <section className="panel"><header><div><h2>Profissionais</h2><p>Cadastro com dados pessoais, vínculo e dados para pagamento.</p></div><button className="btn sm" onClick={() => setModal({ k: 'prof' })}>+ Profissional</button></header>
        <div className="pbody listx">{profissionais.map(p => <div key={p.id}><span>{p.nome}{!p.ativo && <span className="tag">inativo</span>}</span>
          <span className="inline" style={{ flexWrap: 'nowrap' }}><button className="btn sm" onClick={() => setModal({ k: 'prof', p })}>Editar</button>
            <button className="btn sm ghost" onClick={async () => { if (ok(await sb.from('profissionais').update({ ativo: !p.ativo }).eq('id', p.id), p.ativo ? 'Profissional desativado' : 'Profissional reativado')) recarregarConfig() }}>{p.ativo ? 'Desativar' : 'Reativar'}</button></span></div>)}</div></section>

      <section className="panel"><header><div><h2>Regras de repasse</h2><p>Percentual que fica com o <b>estúdio</b>, sobre o valor já descontado. Regra por modalidade vale antes da regra geral do profissional.</p></div></header>
        <div className="tbl"><table><thead><tr><th>Profissional</th><th>Modalidade</th><th className="num">% estúdio</th><th className="num">% profissional</th><th>Desde</th><th></th></tr></thead><tbody>
          {regras.map(r => <tr key={r.id}><td>{nome(r.profissional_id)}</td><td className="sub">{r.modalidade || 'Todas'}</td><td className="num">{r.pct_estudio}%</td><td className="num">{100 - r.pct_estudio}%</td><td className="num">{br(r.vigencia_inicio)}</td>
            <td><Confirmar className="btn sm ghost" label="Excluir" onConfirm={async () => { if (ok(await sb.from('regras_repasse').delete().eq('id', r.id), 'Regra excluída')) carregar() }} /></td></tr>)}
          {!regras.length && <tr><td colSpan={6} className="sub">Nenhuma regra ainda. Sem regra, o repasse aparece como “sem regra” e não é calculado.</td></tr>}
        </tbody></table></div>
        <div className="pbody inline" style={{ borderTop: '1px solid var(--line)' }}>
          <select aria-label="Profissional" value={nr.profissional_id} onChange={e => setNr({ ...nr, profissional_id: e.target.value })}><option value="">Profissional…</option>{profissionais.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
          <select aria-label="Modalidade" value={nr.modalidade} onChange={e => setNr({ ...nr, modalidade: e.target.value })}><option value="">Todas as modalidades</option>{mods.map(m => <option key={m}>{m}</option>)}</select>
          <input aria-label="% do estúdio" type="number" min="0" max="100" step="0.5" placeholder="% estúdio" style={{ width: 110 }} value={nr.pct_estudio} onChange={e => setNr({ ...nr, pct_estudio: e.target.value })} />
          <input aria-label="Vigência" type="date" value={nr.vigencia_inicio} onChange={e => setNr({ ...nr, vigencia_inicio: e.target.value })} />
          <button className="btn pri" onClick={addRegra}>Incluir regra</button>
        </div></section>

      <section className="panel"><header><div><h2>Desconto antes do repasse</h2><p>Taxas de cartão e imposto descontados do valor pago antes de calcular o repasse. Cada pagamento guarda o desconto da data em que foi lançado.</p></div></header>
        <div className="pbody" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="seg"><button aria-pressed={modo === 'fixo'} onClick={() => setModo('fixo')}>Percentual único</button><button aria-pressed={modo === 'detalhado'} onClick={() => setModo('detalhado')}>Por forma de pagamento</button></div>
          {modo === 'fixo' ? <label className="f" style={{ maxWidth: 260 }}>Desconto fixo sobre todo pagamento (%)<input type="number" step="0.01" min="0" value={fixo} onChange={e => setFixo(e.target.value)} /><span className="sub">Média de taxas + imposto. Revise a cada trimestre.</span></label> :
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              {Object.keys(taxas).map(k => <label className="f" key={k}>{k} (%)<input type="number" step="0.01" min="0" value={taxas[k]} onChange={e => setTaxas({ ...taxas, [k]: e.target.value })} /></label>)}
              <label className="f">Imposto sobre receita (%)<input type="number" step="0.01" min="0" value={imp} onChange={e => setImp(e.target.value)} /></label>
            </div>}
          <label className="f" style={{ maxWidth: 260 }}>Aviso mínimo de falta (horas)<input type="number" step="1" min="0" value={prazo} onChange={e => setPrazo(e.target.value)} /></label>
        </div>
        <div className="pbody" style={{ borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}><button className="btn pri" onClick={salvarFin}>Salvar</button></div></section>
    </div>
    {modal?.k === 'novoUser' && <NovoUsuario onClose={() => setModal(null)} onSaved={carregar} />}
    {modal?.k === 'senha' && <RedefinirSenha u={modal.u} onClose={() => setModal(null)} />}
    {modal?.k === 'prof' && <ProfissionalForm prof={modal.p} onClose={() => setModal(null)} />}
  </>
}
