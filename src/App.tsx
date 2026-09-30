import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { sb } from './lib/supabase'
import { BaseProvider, useBase } from './lib/store'
import type { Perfil } from './lib/types'
import { ClienteDrawer } from './components/ClienteDrawer'
import { PagamentoForm } from './components/forms'
import { Dashboard } from './pages/Dashboard'
import { Agenda } from './pages/Agenda'
import { Clientes } from './pages/Clientes'
import { Contratos } from './pages/Contratos'
import { Tabela } from './pages/Tabela'
import { Financeiro } from './pages/Financeiro'
import { Repasse } from './pages/Repasse'
import { Configuracoes } from './pages/Configuracoes'

function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar' | 'senha'>('entrar')
  const [f, setF] = useState({ nome: '', email: '', senha: '' }); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  async function go(e: FormEvent) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true)
    if (modo === 'entrar') { const r = await sb.auth.signInWithPassword({ email: f.email, password: f.senha }); if (r.error) setErr(r.error.message.includes('Invalid') ? 'E-mail ou senha incorretos.' : r.error.message.includes('confirm') ? 'Confirme seu e-mail pelo link que enviamos antes de entrar.' : r.error.message) }
    else if (modo === 'criar') {
      if (f.senha.length < 8) { setBusy(false); return setErr('A senha precisa ter pelo menos 8 caracteres.') }
      const r = await sb.auth.signUp({ email: f.email, password: f.senha, options: { data: { nome: f.nome }, emailRedirectTo: location.origin } })
      if (r.error) setErr(r.error.message); else setMsg('Conta criada. Confirme pelo link enviado ao seu e-mail e aguarde a liberação da gestão.')
    } else { const r = await sb.auth.resetPasswordForEmail(f.email, { redirectTo: location.origin }); if (r.error) setErr(r.error.message); else setMsg('Enviamos um link para redefinir a senha.') }
    setBusy(false)
  }
  return <div className="login"><form className="box" onSubmit={go}>
    <div className="brand">CareHub <small>Studio</small></div>
    <h1>{modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Esqueci a senha'}</h1>
    {modo === 'criar' && <label className="f">Seu nome<input required value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} autoComplete="name" /></label>}
    <label className="f">E-mail<input type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
    {modo !== 'senha' && <label className="f">Senha<input type="password" required value={f.senha} onChange={e => setF({ ...f, senha: e.target.value })} autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} /></label>}
    {err && <div className="err">{err}</div>}{msg && <div className="note">{msg}</div>}
    <button className="btn pri" disabled={busy} style={{ justifyContent: 'center' }}>{modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}</button>
    <div className="inline" style={{ justifyContent: 'space-between' }}>
      {modo !== 'entrar' ? <a href="#" onClick={e => { e.preventDefault(); setModo('entrar') }}>Já tenho conta</a> : <a href="#" onClick={e => { e.preventDefault(); setModo('criar') }}>Criar conta</a>}
      {modo === 'entrar' && <a href="#" onClick={e => { e.preventDefault(); setModo('senha') }}>Esqueci a senha</a>}
    </div>
  </form></div>
}

function NovaSenha({ onDone }: { onDone: () => void }) {
  const [s, setS] = useState(''); const [err, setErr] = useState('')
  return <div className="login"><form className="box" onSubmit={async e => { e.preventDefault(); if (s.length < 8) return setErr('Mínimo de 8 caracteres.'); const r = await sb.auth.updateUser({ password: s }); if (r.error) setErr(r.error.message); else onDone() }}>
    <h1>Definir nova senha</h1><label className="f">Nova senha<input type="password" value={s} onChange={e => setS(e.target.value)} autoComplete="new-password" /></label>
    {err && <div className="err">{err}</div>}<button className="btn pri">Salvar</button></form></div>
}

const TABS: { k: string; l: string; papeis: string[] }[] = [
  { k: 'dashboard', l: 'Dashboard', papeis: ['gestao', 'recepcao'] },
  { k: 'agenda', l: 'Agenda', papeis: ['gestao', 'recepcao', 'profissional'] },
  { k: 'clientes', l: 'Clientes', papeis: ['gestao', 'recepcao', 'profissional'] },
  { k: 'contratos', l: 'Contratos', papeis: ['gestao', 'recepcao'] },
  { k: 'tabela', l: 'Planos e valores', papeis: ['gestao', 'recepcao', 'profissional'] },
  { k: 'financeiro', l: 'Financeiro', papeis: ['gestao', 'recepcao'] },
  { k: 'repasse', l: 'Repasse', papeis: ['gestao', 'profissional'] },
  { k: 'config', l: 'Configurações', papeis: ['gestao'] },
]

function Shell() {
  const { perfil, carregado } = useBase()
  const tabs = TABS.filter(t => t.papeis.includes(perfil.papel))
  const [tab, setTab] = useState(() => { const h = location.hash.slice(1); return tabs.some(t => t.k === h) ? h : tabs[0].k })
  const [filtro, setFiltro] = useState<string | undefined>(); const [cli, setCli] = useState<string | null>(null); const [pg, setPg] = useState(false)
  useEffect(() => { history.replaceState(null, '', '#' + tab) }, [tab])
  const ir = (k: string, f?: string) => { setFiltro(f); setTab(k); window.scrollTo(0, 0) }
  const equipe = perfil.papel === 'gestao' || perfil.papel === 'recepcao'
  return <>
    <header className="top"><div className="topin">
      <div className="brand">CareHub <small>Studio</small></div>
      <nav className="tabs" role="tablist">{tabs.map(t => <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => ir(t.k)}>{t.l === 'Clientes' && perfil.papel === 'profissional' ? 'Meus alunos' : t.l}</button>)}</nav>
      <div className="topact">
        {equipe && <button className="btn pri" onClick={() => setPg(true)}>+ Pagamento</button>}
        <div className="userbox"><span>{perfil.nome || perfil.email}</span><button className="btn sm ghost" onClick={() => sb.auth.signOut()}>Sair</button></div>
      </div>
    </div></header>
    <main className="wrap">{!carregado ? <div className="loading">Carregando…</div> :
      tab === 'dashboard' ? <Dashboard abrirCliente={setCli} ir={ir} /> :
      tab === 'agenda' ? <Agenda abrirCliente={setCli} /> :
      tab === 'clientes' ? <Clientes abrirCliente={setCli} /> :
      tab === 'contratos' ? <Contratos key={filtro} abrirCliente={setCli} filtro0={filtro} /> :
      tab === 'tabela' ? <Tabela /> :
      tab === 'financeiro' ? <Financeiro /> :
      tab === 'repasse' ? <Repasse /> : <Configuracoes />}
    </main>
    {cli && <ClienteDrawer id={cli} onClose={() => setCli(null)} />}
    {pg && <PagamentoForm onClose={() => setPg(false)} />}
  </>
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [recovery, setRecovery] = useState(false)
  useEffect(() => {
    sb.auth.getSession().then(r => setSession(r.data.session))
    const { data } = sb.auth.onAuthStateChange((ev, s) => { setSession(s); if (ev === 'PASSWORD_RECOVERY') setRecovery(true) })
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) { setPerfil(null); return }
    sb.from('perfis').select('*').eq('id', session.user.id).single().then(r => setPerfil(r.data as Perfil))
  }, [session?.user.id])
  if (session === undefined) return <div className="loading">Carregando…</div>
  if (recovery && session) return <NovaSenha onDone={() => setRecovery(false)} />
  if (!session) return <Login />
  if (!perfil) return <div className="loading">Carregando seu perfil…</div>
  if (perfil.papel === 'pendente' || !perfil.ativo) return <div className="login"><div className="box">
    <div className="brand">CareHub <small>Studio</small></div>
    <h1>{perfil.ativo ? 'Aguardando liberação' : 'Acesso bloqueado'}</h1>
    <p className="muted">{perfil.ativo ? 'Sua conta foi criada. A gestão do estúdio precisa liberar seu acesso e definir seu perfil.' : 'Fale com a gestão do estúdio.'}</p>
    <div className="inline"><button className="btn" onClick={() => location.reload()}>Verificar de novo</button><button className="btn ghost" onClick={() => sb.auth.signOut()}>Sair</button></div>
  </div></div>
  return <BaseProvider perfil={perfil}><Shell /></BaseProvider>
}
