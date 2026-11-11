import { useState } from 'react';
import { login, register } from '../services/documentsApi.js';

export default function AuthForm({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      if (mode === 'register') {
        await register({ email, password });
        setMode('login');
        setPassword('');
        setMessage({ type: 'success', text: 'Cadastro realizado. Entre com sua conta.' });
      } else {
        onLogin(await login({ email, password }));
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setMessage(null);
    setPassword('');
  }

  return (
    <main className="workspace auth-workspace">
      <header className="topbar">
        <a className="brand" href="#inicio"><span className="brand-mark">D</span><span>DMS<span className="brand-period">.</span></span></a>
      </header>
      <section className="auth-section" id="inicio" aria-labelledby="auth-title">
        <p className="eyebrow">ARQUIVO PESSOAL</p>
        <h1 id="auth-title">{mode === 'login' ? 'Acesse sua conta' : 'Crie sua conta'}<span className="heading-period">.</span></h1>
        <div className="auth-tabs" aria-label="Acesso à conta">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')} disabled={isSubmitting}>Entrar</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')} disabled={isSubmitting}>Cadastrar</button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="auth-password">Senha</label>
          <input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          {message && <p className={`auth-message auth-message-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
        </form>
      </section>
    </main>
  );
}