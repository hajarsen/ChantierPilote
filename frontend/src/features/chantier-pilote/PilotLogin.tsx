import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, HardHat, ShieldCheck, Users, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { safeNextPath } from '@/features/auth/nextPath';
import { Brand } from './Brand';
import { usePilotCopy } from './copy';
import './pilot.css';

export default function PilotLogin() {
  const { t, i18n } = usePilotCopy();
  const navigate = useNavigate();
  const location = useLocation();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demoEnabled, setDemoEnabled] = useState(false);
  useEffect(() => {
    document.title = 'Banyra';
    if (i18n.language !== 'fr') void i18n.changeLanguage('fr');
    const controller = new AbortController();
    void fetch('/api/v1/auth/first-run', { signal: controller.signal }).then((r) => { if (!r.ok) throw new Error('First-run status unavailable'); return r.json(); })
      .then((data) => setDemoEnabled(data.demo_enabled === true)).catch(() => {});
    return () => controller.abort();
  }, [i18n]);

  async function signIn(demo: boolean, event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    const form = event ? new FormData(event.currentTarget) : null;
    const email = demo ? 'demo@openconstructionerp.com' : String(form?.get('email') ?? '');
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/v1/users/auth/${demo ? 'demo-login' : 'login'}/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...(demo ? {} : { password: form?.get('password') }) }),
      });
      if (!response.ok) throw new Error('Sign-in refused');
      const data = await response.json();
      if (!data.access_token || !data.refresh_token) throw new Error('Invalid session');
      setTokens(data.access_token, data.refresh_token, false, email);
      navigate(safeNextPath(location.search), { replace: true });
    } catch { setError(t('loginError')); }
    finally { setBusy(false); }
  }

  return <div className="cp-app cp-login">
    <section className="cp-login-story">
      <Brand />
      <div className="cp-login-message"><span className="cp-eyebrow">{t('daily')}</span>
        <h1>{t('loginTitle')}</h1><p>{t('loginText')}</p>
        <div className="cp-login-icons"><HardHat /><ShieldCheck /><Users /></div>
      </div>
      <div className="cp-login-photo"><img src="/chantier-pilote/terrain.jpg" alt={t('photoAlt')} />
        <span>{t('loginFoot')} <ArrowUpRight size={20} /></span></div>
    </section>
    <section className="cp-login-form">
      <div className="cp-login-box"><span className="cp-label">BANYRA</span><h2>{t('welcome')}</h2><p>{t('loginSub')}</p>
        <form onSubmit={(e) => void signIn(false, e)}>
          <label>{t('email')}<input name="email" type="email" autoComplete="username" required placeholder="vous@entreprise.fr" /></label>
          <label>{t('password')}<input name="password" type="password" autoComplete="current-password" required /></label>
          <Link className="cp-forgot" to="/forgot-password">{t('forgot')}</Link>
          {error && <p className="cp-error" role="alert">{error}</p>}
          <button className="cp-button cp-primary" disabled={busy}>{busy ? <Loader2 className="cp-spin" size={18} /> : <ArrowRight size={18} />}{t(busy ? 'loginBusy' : 'login')}</button>
        </form>
        {demoEnabled && <div className="cp-demo"><button className="cp-button cp-secondary" disabled={busy} onClick={() => void signIn(true)}>{t('demo')}<ArrowUpRight size={16} /></button><p>{t('demoNote')}</p></div>}
        <Link className="cp-account" to="/register">{t('createAccount')} <ArrowUpRight size={15} /></Link>
      </div>
      <a className="cp-attribution" href="https://github.com/datadrivenconstruction/openconstructionerp" target="_blank" rel="noreferrer">{t('foundation')}</a>
    </section>
  </div>;
}
