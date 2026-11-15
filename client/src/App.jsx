import Login from './components/login';
import { ClassesEmploi, Ecoles, EspaceFamille, Paiements, Annonces, Eleves } from './components/Views';
import { useState, useEffect } from 'react';
import API from './services/api';
import { Moon, Sun } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from 'recharts';

const ROLES_BI = ['ADMIN_ECOLE', 'DIRECTEUR', 'COMPTABLE'];

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' };
const th = { padding: '0.6rem', border: '1px solid var(--border)', textAlign: 'left', background: 'var(--surface-muted)' };
const td = { padding: '0.6rem', border: '1px solid var(--border)' };

function getSavedUser() {
  const savedUser = localStorage.getItem('user');
  if (!savedUser) return null;
  try {
    return JSON.parse(savedUser);
  } catch {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    return null;
  }
}

function pageAccueil(user) {
  if (!user) return 'bi';
  if (user.role === 'SUPER_ADMIN') return 'ecoles';
  if (ROLES_BI.includes(user.role)) return 'bi';
  return ['PARENT', 'ELEVE'].includes(user.role) ? 'famille' : 'emploi';
}

function Kpi({ titre, valeur, couleur = '#2563eb' }) {
  return (
    <div style={{ ...card, flex: '1 1 180px' }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{titre}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: couleur }}>{valeur}</div>
    </div>
  );
}

function Section({ titre, children }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ marginBottom: '0.75rem' }}>{titre}</h2>
      {children}
    </section>
  );
}

export default function App() {
  const [user, setUser] = useState(getSavedUser);
  const [bi, setBi] = useState(null);
  const [biErreur, setBiErreur] = useState('');
  const [vue, setVue] = useState(() => pageAccueil(getSavedUser()));
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  const peutVoirBI = user && ROLES_BI.includes(user.role);

  useEffect(() => {
    document.body.classList.toggle('theme-dark-body', darkMode);
    return () => document.body.classList.remove('theme-dark-body');
  }, [darkMode]);

  const pages = peutVoirBI
    ? [['bi', 'Tableau de bord'], ['eleves', 'Élèves'], ['emploi', 'Emplois du temps'], ['annonces', 'Annonces'], ['paiements', 'Paiements']]
    : user?.role === 'SUPER_ADMIN'
      ? [['ecoles', 'Établissements']]
      : user?.role === 'PARENT' || user?.role === 'ELEVE'
        ? [['famille', user.role === 'PARENT' ? 'Espace parent' : 'Mon espace'], ['annonces', 'Annonces']]
        : [['emploi', 'Emplois du temps'], ['annonces', 'Annonces']];

  useEffect(() => {
    if (!peutVoirBI) return;
    API.get('/bi/dashboard')
      .then((res) => setBi(res.data))
      .catch((err) => setBiErreur(err.response?.data?.error || 'Impossible de charger le dashboard'));
  }, [peutVoirBI]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setBi(null);
  };

  const changerTheme = () => {
    const prochainMode = !darkMode;
    setDarkMode(prochainMode);
    localStorage.setItem('theme', prochainMode ? 'dark' : 'light');
  };

  if (!user) return <Login darkMode={darkMode} onToggleTheme={changerTheme} onLoginSuccess={(userData) => {
    setUser(userData);
    setVue(pageAccueil(userData));
  }} />;

  return (
    <div className={`school-app${darkMode ? ' theme-dark' : ''}`} style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 1100, margin: '0 auto', color: 'var(--text-primary)', minHeight: '100vh' }}>
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>{user.etablissement}</h1>
          <p style={{ margin: '0.25rem 0 0' }}>
            Bienvenue, <strong>{user.prenom} {user.nom}</strong> ({user.role})
          </p>
        </div>
        <div className="app-actions">
          <button className="theme-toggle" onClick={changerTheme} aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}>
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span>{darkMode ? 'Mode clair' : 'Mode sombre'}</span>
          </button>
          <button onClick={handleLogout} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer' }}>
            Déconnexion
          </button>
        </div>
      </header>

      <nav className="app-nav" style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {pages.map(([cle, label]) => (
            <button
              key={cle}
              onClick={() => setVue(cle)}
              style={{ padding: '0.5rem 1rem', borderRadius: 4, border: '1px solid #2563eb', cursor: 'pointer', background: vue === cle ? '#2563eb' : 'white', color: vue === cle ? 'white' : '#2563eb' }}
            >
              {label}
            </button>
          ))}
      </nav>

      {/* ---------- DASHBOARD BI ---------- */}
      {peutVoirBI && vue === 'bi' && (
        <>
          {biErreur && <p style={{ color: '#b91c1c' }}>{biErreur}</p>}
          {!bi && !biErreur && <p>Chargement du dashboard...</p>}
          {bi && (
            <>
              <Section titre={`Vue générale – ${bi.annee}`}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                  <Kpi titre="Élèves" valeur={bi.general.totalEleves} />
                  <Kpi titre="Enseignants" valeur={bi.general.totalEnseignants} />
                  <Kpi titre="Classes" valeur={bi.general.totalClasses} />
                  <Kpi titre="Taux de remplissage" valeur={`${bi.general.tauxRemplissage}%`} />
                </div>
                <div style={{ ...card, height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={bi.general.alertesClasses}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="classe" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="effectif" name="Effectif" fill="#2563eb" />
                      <Bar dataKey="capacite" name="Capacité" fill="#d1d5db" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, background: 'var(--surface)' }}>
                  <thead><tr><th style={th}>Classe</th><th style={th}>Effectif</th><th style={th}>Occupation</th><th style={th}>Statut</th></tr></thead>
                  <tbody>
                    {bi.general.alertesClasses.map((c) => (
                      <tr key={c.classe}>
                        <td style={td}>{c.classe}</td>
                        <td style={td}>{c.effectif} / {c.capacite}</td>
                        <td style={td}>{c.tauxOccupation}%</td>
                        <td style={{ ...td, color: c.statut === 'NORMALE' ? '#047857' : '#b91c1c', fontWeight: 600 }}>{c.statut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              <Section titre="Financier">
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                  <Kpi titre="Attendu" valeur={`${bi.financier.totalAttendu} TND`} />
                  <Kpi titre="Encaissé" valeur={`${bi.financier.totalEncaisse} TND`} couleur="#047857" />
                  <Kpi titre="Reste à recouvrer" valeur={`${bi.financier.resteARecouvrer} TND`} couleur="#b91c1c" />
                  <Kpi titre="Taux de recouvrement" valeur={`${bi.financier.tauxRecouvrement}%`} />
                </div>
                <h3>Parents en retard de paiement</h3>
                {bi.financier.retardsPaiement.length === 0 ? (
                  <p>Aucun retard de paiement.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
                    <thead><tr><th style={th}>Élève</th><th style={th}>Parent</th><th style={th}>Reste à payer</th></tr></thead>
                    <tbody>
                      {bi.financier.retardsPaiement.map((r, i) => (
                        <tr key={i}><td style={td}>{r.eleve}</td><td style={td}>{r.parent}</td><td style={td}>{r.resteAPayer} TND</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>

              <Section titre="Pédagogique">
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                  <Kpi titre="Moyenne de l'établissement" valeur={`${bi.pedagogique.moyenneEtablissement}/20`} />
                  <Kpi titre="Taux de réussite" valeur={`${bi.pedagogique.tauxReussite}%`} couleur="#047857" />
                  <Kpi titre="Taux d'échec" valeur={`${bi.pedagogique.tauxEchec}%`} couleur="#b91c1c" />
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ ...card, flex: '1 1 400px', height: 260 }}>
                    <strong>Moyenne par matière</strong>
                    <ResponsiveContainer>
                      <BarChart data={bi.pedagogique.moyennesParMatiere}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="matiere" />
                        <YAxis domain={[0, 20]} />
                        <Tooltip />
                        <Bar dataKey="moyenne" fill="#7c3aed" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ ...card, flex: '1 1 400px', height: 260 }}>
                    <strong>Moyenne par classe</strong>
                    <ResponsiveContainer>
                      <BarChart data={bi.pedagogique.moyennesParClasse}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="classe" />
                        <YAxis domain={[0, 20]} />
                        <Tooltip />
                        <Bar dataKey="moyenne" fill="#0891b2" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Section>

              <Section titre="Absences">
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                  <Kpi titre="Total absences" valeur={bi.absences.total} />
                  <Kpi titre="Justifiées" valeur={bi.absences.justifiees} couleur="#047857" />
                  <Kpi titre="Non justifiées" valeur={bi.absences.nonJustifiees} couleur="#b91c1c" />
                </div>
                <div style={{ ...card, height: 240 }}>
                  <strong>Évolution mensuelle</strong>
                  <ResponsiveContainer>
                    <BarChart data={bi.absences.parMois}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mois" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="nombre" name="Absences" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section titre="Early Warning – élèves à risque">
                {bi.earlyWarnings.length === 0 ? (
                  <p>Aucun élève à risque.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
                    <thead><tr><th style={th}>Élève</th><th style={th}>Classe</th><th style={th}>Moyenne</th><th style={th}>Risque</th><th style={th}>Alertes</th></tr></thead>
                    <tbody>
                      {bi.earlyWarnings.map((e, i) => (
                        <tr key={i}>
                          <td style={td}>{e.eleve}</td>
                          <td style={td}>{e.classe}</td>
                          <td style={td}>{e.moyenne ?? 'N/A'}</td>
                          <td style={{ ...td, fontWeight: 700, color: e.niveauRisque === 'ÉLEVÉ' ? '#b91c1c' : '#b45309' }}>{e.niveauRisque}</td>
                          <td style={td}>{e.alertes.join(' • ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>

              <Section titre="Recommandations automatiques">
                <ul style={{ ...card, margin: 0, paddingLeft: '2rem', lineHeight: 1.7 }}>
                  {bi.recommandations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </Section>
            </>
          )}
        </>
      )}

      {vue === 'eleves' && <Eleves />}
      {vue === 'ecoles' && user.role === 'SUPER_ADMIN' && <Ecoles />}
      {vue === 'emploi' && <ClassesEmploi />}
      {vue === 'famille' && <EspaceFamille role={user.role} />}
      {vue === 'annonces' && <Annonces role={user.role} />}
      {vue === 'paiements' && <Paiements />}
    </div>
  );
}