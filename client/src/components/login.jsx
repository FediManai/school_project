import { useEffect, useState } from 'react';
import API from '../services/api';
import { ArrowRight, BookOpen, Building2, GraduationCap, LockKeyhole, Mail, Moon, School, Sun, Users } from 'lucide-react';

export default function Login({ onLoginSuccess, darkMode, onToggleTheme }) {
  const [ecoles, setEcoles] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ecolesError, setEcolesError] = useState('');
  const [loadingEcoles, setLoadingEcoles] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    API.get('/ecoles/selection')
      .then((response) => {
        if (!active) return;
        setEcoles(response.data);
        if (response.data.length === 1) setSchoolId(String(response.data[0].id));
      })
      .catch((err) => {
        if (active) setEcolesError(err.response?.data?.error || 'Impossible de charger les établissements');
      })
      .finally(() => {
        if (active) setLoadingEcoles(false);
      });
    return () => { active = false; };
  }, []);

  const ecoleSelectionnee = ecoles.find((ecole) => String(ecole.id) === schoolId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await API.post('/auth/login', { email: email.trim(), password, schoolId: Number(schoolId) });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      onLoginSuccess(response.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`login-page${darkMode ? ' theme-dark' : ''}`}>
      <header className="login-topbar">
        <a className="brand-mark" href="/" aria-label="Portail Scolaire, accueil">
          <span className="brand-icon"><BookOpen size={21} /></span>
          <span>Portail<span className="brand-light">Scolaire</span></span>
        </a>
        <button className="theme-toggle" onClick={onToggleTheme} type="button" aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}>
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          <span>{darkMode ? 'Mode clair' : 'Mode sombre'}</span>
        </button>
      </header>

      <div className="login-layout">
        <section className="login-intro">
          <div className="eyebrow"><span className="status-dot" /> Espace numérique éducatif</div>
          <h1>La vie scolaire,<br /><span>en toute simplicité.</span></h1>
          <p className="intro-copy">
            Notes, absences, emplois du temps et informations de l’établissement réunis dans un espace sécurisé.
          </p>
          <div className="role-list">
            <div><Users size={19} /><span>Familles et élèves</span></div>
            <div><GraduationCap size={19} /><span>Enseignants et direction</span></div>
            <div><Building2 size={19} /><span>Plusieurs établissements</span></div>
          </div>
          {ecoleSelectionnee && (
            <div className="school-summary">
              <span className="summary-label">Établissement sélectionné</span>
              <strong>{ecoleSelectionnee.nom}</strong>
              <span className="summary-director">
                Direction : {ecoleSelectionnee.directeur || 'équipe de direction à définir'}
              </span>
              <div className="summary-stats">
                <span><Users size={16} /> {ecoleSelectionnee.nombreEleves} {ecoleSelectionnee.nombreEleves === 1 ? 'élève' : 'élèves'}</span>
                <span><Building2 size={16} /> {ecoleSelectionnee.nombreClasses} {ecoleSelectionnee.nombreClasses === 1 ? 'classe' : 'classes'}</span>
                <span><GraduationCap size={16} /> {ecoleSelectionnee.nombreEnseignants} enseignants</span>
              </div>
            </div>
          )}
        </section>
        <section className="login-form-panel">
          <div className="form-heading">
            <div className="form-icon"><School size={22} /></div>
            <div>
              <h2>Bon retour parmi nous</h2>
              <p>Connectez-vous à votre espace scolaire.</p>
            </div>
          </div>

          {ecolesError && <div className="alert alert-error" role="alert">{ecolesError}</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="schoolId">Établissement</label>
            <div className="input-wrap">
              <Building2 size={18} aria-hidden="true" />
              <select id="schoolId" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} required disabled={loadingEcoles || ecoles.length === 0}>
                <option value="" disabled>{loadingEcoles ? 'Chargement des établissements…' : 'Choisir un établissement'}</option>
                {ecoles.map((ecole) => (
                  <option key={ecole.id} value={ecole.id}>
                    {ecole.nom} · {ecole.nombreEleves} {ecole.nombreEleves === 1 ? 'élève' : 'élèves'}
                  </option>
                ))}
              </select>
            </div>

            <label className="field-label" htmlFor="email">Adresse email</label>
            <div className="input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input id="email" type="email" autoComplete="username" placeholder="nom@etablissement.tn" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="password-label">
              <label className="field-label" htmlFor="password">Mot de passe</label>
            </div>
            <div className="input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input id="password" type="password" autoComplete="current-password" placeholder="Votre mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <button className="login-submit" type="submit" disabled={loading || loadingEcoles || ecoles.length === 0 || !schoolId}>
              <span>{loading ? 'Connexion en cours…' : 'Se connecter'}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="secure-note"><LockKeyhole size={15} /> Accès sécurisé réservé aux membres de l’établissement</div>
        </section>
      </div>
      <footer className="login-footer">© {new Date().getFullYear()} Portail Scolaire <span>•</span> Un espace pour apprendre et grandir</footer>
    </main>
  );
}