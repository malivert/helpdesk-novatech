import { KeyRound, ShieldCheck, TicketCheck } from "lucide-react";
import Link from "next/link";
import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand auth-brand"><span className="brand-mark">N</span><div><strong>HelpDesk</strong><span>NovaTech</span></div></div>
        <p className="eyebrow">Centre de services IT</p>
        <h1>Un support fiable, du signalement à la résolution.</h1>
        <p>Tickets centralisés, responsabilités claires et historique complet.</p>
        <ul><li><ShieldCheck/>Accès sécurisé par rôle</li><li><TicketCheck/>Suivi de chaque intervention</li></ul>
      </section>
      <section className="auth-card">
        <KeyRound />
        <h2>Accéder au HelpDesk</h2>
        <p>Connectez-vous ou créez un compte demandeur.</p>
        {params.error && <div className="form-alert error">{params.error}</div>}
        {params.message && <div className="form-alert success">{params.message}</div>}
        <form className="auth-form">
          <label>Nom complet<input name="fullName" minLength={2} placeholder="Claire Robert" /></label>
          <label>Service<input name="department" placeholder="Finance" /></label>
          <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
          <label>Mot de passe<input name="password" type="password" required minLength={8} autoComplete="current-password" /></label>
          <button className="primary-button" formAction={login}>Se connecter</button>
          <button className="secondary-button" formAction={signup}>Créer un compte demandeur</button>
        </form>
        <div className="demo-entry"><span>ou</span><Link className="demo-button" href="/">Continuer en mode démonstration</Link><small>Aucun compte requis · données conservées dans ce navigateur</small></div>
      </section>
    </main>
  );
}
