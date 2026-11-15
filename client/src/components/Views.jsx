import { useCallback, useEffect, useState } from 'react';
import API from '../services/api';
import { card, th, td } from './viewStyles';

// ---------- Styles et petits composants partagés ----------
const bouton = { background: '#2563eb', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer' };
const select = { padding: '0.5rem', borderRadius: 4, border: '1px solid var(--border)', minWidth: 220, background: 'var(--surface)', color: 'var(--text-primary)' };

export function Kpi({ titre, valeur, couleur = '#2563eb' }) {
  return (
    <div style={{ ...card, flex: '1 1 180px' }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{titre}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: couleur }}>{valeur}</div>
    </div>
  );
}

export function Section({ titre, children }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      {titre && <h2 style={{ marginBottom: '0.75rem' }}>{titre}</h2>}
      {children}
    </section>
  );
}

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

// ---------- Emploi du temps (grille de la semaine) ----------
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const COULEURS = {
  Mathématiques: '#dbeafe', Sciences: '#dcfce7', Arabe: '#fef3c7', Français: '#fce7f3',
  Anglais: '#ede9fe', Sport: '#ffedd5', 'Éducation islamique': '#ccfbf1',
  Informatique: '#e0e7ff', 'Histoire-Géographie': '#fee2e2', 'Arts plastiques': '#fae8ff'
};

export function Timetable({ classeId }) {
  const [resultat, setResultat] = useState(null);

  useEffect(() => {
    if (!classeId) return;
    let active = true;
    API.get(`/emploi-du-temps/${classeId}`)
      .then((r) => {
        if (active) setResultat({ classeId: String(classeId), data: r.data });
      })
      .catch((e) => {
        if (active) setResultat({
          classeId: String(classeId),
          erreur: e.response?.data?.error || 'Impossible de charger l\'emploi du temps'
        });
      });
    return () => { active = false; };
  }, [classeId]);

  const resultatClasse = resultat?.classeId === String(classeId) ? resultat : null;
  const data = resultatClasse?.data;
  const erreur = resultatClasse?.erreur;
  if (erreur) return <p style={{ color: '#b91c1c' }}>{erreur}</p>;
  if (!data) return <p>Chargement de l'emploi du temps...</p>;
  if (data.seances.length === 0) return <p>Aucune séance programmée pour cette classe.</p>;

  const creneaux = [...new Set(data.seances.map((s) => `${s.heureDebut}-${s.heureFin}`))].sort();
  const jours = JOURS.filter((j) => data.seances.some((s) => s.jour === j));

  return (
    <div style={{ overflowX: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Emploi du temps – {data.classe.nom}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
        <thead>
          <tr>
            <th style={th}>Horaire</th>
            {jours.map((j) => <th key={j} style={th}>{j}</th>)}
          </tr>
        </thead>
        <tbody>
          {creneaux.map((c) => {
            const [debut, fin] = c.split('-');
            return (
              <tr key={c}>
                <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{debut} – {fin}</td>
                {jours.map((j) => {
                  const s = data.seances.find((x) => x.jour === j && x.heureDebut === debut);
                  return (
                    <td key={j} style={{ ...td, background: s ? COULEURS[s.matiere] || '#f3f4f6' : 'var(--surface)' }}>
                      {s ? (
                        <>
                          <div style={{ fontWeight: 700 }}>{s.matiere}</div>
                          <div style={{ fontSize: 12, color: '#4b5563' }}>
                            {s.enseignant ? `${s.enseignant.prenom} ${s.enseignant.nom}` : ''}
                            {s.salle ? ` • ${s.salle}` : ''}
                          </div>
                        </>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Liste déroulante des classes + emploi du temps ----------
export function ClassesEmploi() {
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    API.get('/classes').then((r) => {
      setClasses(r.data);
      if (r.data.length > 0) setClasseId(String(r.data[0].id));
    }).catch((e) => setErreur(e.response?.data?.error || 'Impossible de charger les classes'));
  }, []);

  return (
    <Section titre="Classes et emplois du temps">
      {erreur && <p style={{ color: '#b91c1c' }}>{erreur}</p>}
      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 8 }}>Choisir une classe :</label>
        <select style={select} value={classeId} onChange={(e) => setClasseId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom} ({c._count.eleves} élèves)
            </option>
          ))}
        </select>
      </div>
      {classeId && <Timetable classeId={classeId} />}
    </Section>
  );
}

// ---------- Espace élève / parent ----------
export function EspaceFamille({ role }) {
  const [enfants, setEnfants] = useState(null);
  const [erreur, setErreur] = useState('');
  const [index, setIndex] = useState(0);
  const [onglet, setOnglet] = useState('emploi');

  useEffect(() => {
    API.get('/mon-espace')
      .then((r) => setEnfants(r.data))
      .catch((e) => setErreur(e.response?.data?.error || 'Impossible de charger votre espace famille'));
  }, []);

  if (erreur) return <p style={{ color: '#b91c1c' }}>{erreur}</p>;
  if (!enfants) return <p>Chargement...</p>;
  if (enfants.length === 0) return <p>Aucun élève rattaché à ce compte.</p>;

  const e = enfants[index] || enfants[0];
  const ongletsDispo = [['emploi', 'Emploi du temps'], ['notes', 'Notes'], ['absences', 'Absences'], ['paiements', 'Paiements']];
  const visibles = role === 'ELEVE' ? ongletsDispo.filter(([k]) => k !== 'paiements') : ongletsDispo;

  return (
    <Section titre={role === 'PARENT' ? 'Suivi de mes enfants' : 'Mon espace élève'}>
      {role === 'PARENT' && enfants.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ marginRight: 8 }}>Enfant :</label>
          <select style={select} value={index} onChange={(ev) => setIndex(Number(ev.target.value))}>
            {enfants.map((x, i) => <option key={x.id} value={i}>{x.prenom} {x.nom} – {x.classe?.nom}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Kpi titre="Élève" valeur={`${e.prenom} ${e.nom}`} />
        <Kpi titre="Classe" valeur={e.classe?.nom || 'N/A'} />
        <Kpi titre="Moyenne générale" valeur={e.moyenne !== null ? `${e.moyenne}/20` : 'N/A'} couleur={e.moyenne !== null && e.moyenne < 10 ? '#b91c1c' : '#047857'} />
        <Kpi titre="Absences" valeur={e.absences.length} couleur="#b45309" />
      </div>

      <nav style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {visibles.map(([k, label]) => (
          <button key={k} onClick={() => setOnglet(k)}
            style={{ ...bouton, background: onglet === k ? '#2563eb' : 'white', color: onglet === k ? 'white' : '#2563eb', border: '1px solid #2563eb' }}>
            {label}
          </button>
        ))}
      </nav>

      {onglet === 'emploi' && <Timetable classeId={e.classeId} />}

      {onglet === 'notes' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
          <thead><tr><th style={th}>Matière</th><th style={th}>Note /20</th><th style={th}>Coefficient</th></tr></thead>
          <tbody>
            {e.notes.map((n) => (
              <tr key={n.id}>
                <td style={td}>{n.matiere}</td>
                <td style={{ ...td, fontWeight: 700, color: n.valeur < 10 ? '#b91c1c' : '#047857' }}>{n.valeur}</td>
                <td style={td}>{n.coefficient}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {onglet === 'absences' && (
        e.absences.length === 0 ? <p>Aucune absence enregistrée.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
            <thead><tr><th style={th}>Date</th><th style={th}>Statut</th></tr></thead>
            <tbody>
              {e.absences.map((a) => (
                <tr key={a.id}>
                  <td style={td}>{formatDate(a.date)}</td>
                  <td style={{ ...td, color: a.justifiee ? '#047857' : '#b91c1c' }}>{a.justifiee ? 'Justifiée' : 'Non justifiée'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {onglet === 'paiements' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
          <thead><tr><th style={th}>Total</th><th style={th}>Payé</th><th style={th}>Reste</th><th style={th}>Statut</th><th style={th}>Mode</th><th style={th}>Date</th></tr></thead>
          <tbody>
            {e.paiements.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.montantTotal} TND</td>
                <td style={td}>{p.montantPaye} TND</td>
                <td style={td}>{p.montantTotal - p.montantPaye} TND</td>
                <td style={td}>{p.statut}</td>
                <td style={td}>{p.modePaiement || '—'}</td>
                <td style={td}>{formatDate(p.datePaiement)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

// ---------- Paiements détaillés (direction / comptabilité) ----------
const couleurStatut = { PAYE: '#047857', PARTIEL: '#b45309', IMPAYE: '#b91c1c' };

export function Paiements() {
  const [liste, setListe] = useState(null);
  const [classe, setClasse] = useState('TOUTES');
  const [statut, setStatut] = useState('TOUS');

  useEffect(() => {
    API.get('/paiements').then((r) => setListe(r.data)).catch(() => setListe([]));
  }, []);

  if (!liste) return <p>Chargement...</p>;

  const classes = [...new Set(liste.map((p) => p.classe))];
  const filtres = liste.filter(
    (p) => (classe === 'TOUTES' || p.classe === classe) && (statut === 'TOUS' || p.statut === statut)
  );
  const attendu = filtres.reduce((s, p) => s + p.montantTotal, 0);
  const encaisse = filtres.reduce((s, p) => s + p.montantPaye, 0);

  return (
    <Section titre="Paiements des élèves">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Kpi titre="Attendu" valeur={`${attendu} TND`} />
        <Kpi titre="Encaissé" valeur={`${encaisse} TND`} couleur="#047857" />
        <Kpi titre="Reste à payer" valeur={`${attendu - encaisse} TND`} couleur="#b91c1c" />
        <Kpi titre="Recouvrement" valeur={`${attendu > 0 ? ((encaisse / attendu) * 100).toFixed(1) : 0}%`} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select style={select} value={classe} onChange={(e) => setClasse(e.target.value)}>
          <option value="TOUTES">Toutes les classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={select} value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="TOUS">Tous les statuts</option>
          <option value="PAYE">Payé</option>
          <option value="PARTIEL">Partiel</option>
          <option value="IMPAYE">Impayé</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
          <thead>
            <tr>
              <th style={th}>Élève</th><th style={th}>Classe</th><th style={th}>Parent</th>
              <th style={th}>Total</th><th style={th}>Payé</th><th style={th}>Reste</th>
              <th style={th}>Statut</th><th style={th}>Mode</th><th style={th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtres.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.eleve}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.matricule}</div></td>
                <td style={td}>{p.classe}</td>
                <td style={td}>{p.parent}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.parentEmail}</div></td>
                <td style={td}>{p.montantTotal} TND</td>
                <td style={td}>{p.montantPaye} TND</td>
                <td style={td}>{p.reste} TND</td>
                <td style={{ ...td, fontWeight: 700, color: couleurStatut[p.statut] || '#111827' }}>{p.statut}</td>
                <td style={td}>{p.modePaiement || '—'}</td>
                <td style={td}>{formatDate(p.datePaiement)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ---------- Annonces ----------
export function Annonces({ role }) {
  const [liste, setListe] = useState([]);
  const [form, setForm] = useState({ titre: '', contenu: '', cible: 'TOUS' });
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const peutPublier = ['ADMIN_ECOLE', 'DIRECTEUR'].includes(role);

  const charger = () => API.get('/annonces')
    .then((r) => setListe(r.data))
    .catch((e) => setErreur(e.response?.data?.error || 'Impossible de charger les annonces'));
  useEffect(() => { charger(); }, []);

  const publier = async (ev) => {
    ev.preventDefault();
    setMessage('');
    try {
      await API.post('/annonces', form);
      setForm({ titre: '', contenu: '', cible: 'TOUS' });
      setMessage('Annonce publiée.');
      charger();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erreur de publication');
    }
  };

  return (
    <Section titre="Annonces de l'établissement">
      {erreur && <p style={{ color: '#b91c1c' }}>{erreur}</p>}
      {peutPublier && (
        <form onSubmit={publier} style={{ ...card, marginBottom: 16, display: 'grid', gap: 8 }}>
          <strong>Publier une annonce</strong>
          <input style={select} placeholder="Titre" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          <textarea style={{ ...select, minHeight: 80 }} placeholder="Contenu" value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} />
          <select style={select} value={form.cible} onChange={(e) => setForm({ ...form, cible: e.target.value })}>
            <option value="TOUS">Tous</option>
            <option value="PARENTS">Parents</option>
            <option value="ELEVES">Élèves</option>
            <option value="ENSEIGNANTS">Enseignants</option>
          </select>
          <div><button type="submit" style={bouton}>Publier</button> <span style={{ marginLeft: 8 }}>{message}</span></div>
        </form>
      )}
      {liste.length === 0 && <p>Aucune annonce.</p>}
      {liste.map((a) => (
        <div key={a.id} style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{a.titre}</strong>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(a.createdAt)} • {a.cible}</span>
          </div>
          <p style={{ marginBottom: 0 }}>{a.contenu}</p>
        </div>
      ))}
    </Section>
  );
}

// ---------- Liste des élèves ----------
export function Eleves() {
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [classesErreur, setClassesErreur] = useState('');
  const [resultat, setResultat] = useState(null);

  useEffect(() => {
    let active = true;
    API.get('/classes')
      .then((r) => {
        if (active) setClasses(r.data);
      })
      .catch((e) => {
        if (active) setClassesErreur(e.response?.data?.error || 'Impossible de charger les classes');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    API.get('/eleves', { params: classeId ? { classeId } : {} })
      .then((r) => {
        if (active) setResultat({ classeId, eleves: r.data });
      })
      .catch((e) => {
        if (active) setResultat({
          classeId,
          erreur: e.response?.data?.error || 'Impossible de charger les élèves'
        });
      });
    return () => { active = false; };
  }, [classeId]);

  const resultatCourant = resultat?.classeId === classeId ? resultat : null;
  const eleves = resultatCourant?.eleves;

  return (
    <Section titre="Élèves">
      {classesErreur && <p style={{ color: '#b91c1c' }}>{classesErreur}</p>}
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="filtre-classe" style={{ marginRight: 8 }}>Filtrer par classe :</label>
        <select id="filtre-classe" style={select} value={classeId} onChange={(e) => setClasseId(e.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map((classe) => <option key={classe.id} value={classe.id}>{classe.nom}</option>)}
        </select>
      </div>
      {resultatCourant?.erreur && <p style={{ color: '#b91c1c' }}>{resultatCourant.erreur}</p>}
      {!resultatCourant && <p>Chargement des élèves...</p>}
      {eleves?.length === 0 && <p>Aucun élève dans cette classe.</p>}
      {eleves?.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
          <thead><tr><th style={th}>Matricule</th><th style={th}>Nom & Prénom</th><th style={th}>Classe</th><th style={th}>Parent</th></tr></thead>
          <tbody>
            {eleves.map((el) => (
              <tr key={el.id}>
                <td style={td}>{el.matricule}</td>
                <td style={td}>{el.nom} {el.prenom}</td>
                <td style={td}>{el.classe?.nom || 'N/A'}</td>
                <td style={td}>{el.parent ? `${el.parent.prenom} ${el.parent.nom}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

export function Ecoles() {
  const [ecoles, setEcoles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    nom: '',
    adresse: '',
    directeurPrenom: '',
    directeurNom: '',
    directeurEmail: '',
    directeurPassword: '',
    enseignantPrenom: '',
    enseignantNom: '',
    enseignantEmail: '',
    enseignantPassword: '',
    matiere: '',
    classeNom: '',
    classeNiveau: '',
    capaciteMax: '25',
    elevePrenom: '',
    eleveNom: '',
    matricule: '',
    parentPrenom: '',
    parentNom: '',
    parentEmail: '',
    parentPassword: ''
  });

  const chargerEcoles = useCallback(() => {
    API.get('/ecoles')
      .then((r) => {
        setEcoles(r.data);
        setErreur('');
      })
      .catch((e) => setErreur(e.response?.data?.error || 'Impossible de charger les établissements'))
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { chargerEcoles(); }, [chargerEcoles]);

  const creerEcole = async (e) => {
    e.preventDefault();
    setErreur('');
    setMessage('');
    try {
      await API.post('/ecoles', form);
      setMessage('Établissement créé avec son directeur, son professeur, sa première classe et son premier élève.');
      setForm({
        nom: '', adresse: '', directeurPrenom: '', directeurNom: '', directeurEmail: '', directeurPassword: '',
        enseignantPrenom: '', enseignantNom: '', enseignantEmail: '', enseignantPassword: '', matiere: '',
        classeNom: '', classeNiveau: '', capaciteMax: '25', elevePrenom: '', eleveNom: '', matricule: '',
        parentPrenom: '', parentNom: '', parentEmail: '', parentPassword: ''
      });
      chargerEcoles();
    } catch (e) {
      setErreur(e.response?.data?.error || 'Impossible de créer l’établissement');
    }
  };

  return (
    <Section titre="Gestion des établissements">
      {erreur && <p style={{ color: '#b91c1c' }}>{erreur}</p>}
      {message && <p style={{ color: '#047857' }}>{message}</p>}

      <form onSubmit={creerEcole} className="school-form" style={{ ...card, marginBottom: 20, display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0 }}>Ajouter une école</h3>
        <input style={select} placeholder="Nom de l’établissement" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
        <input style={select} placeholder="Adresse (facultative)" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
        <div className="school-form-group">
          <strong>Directeur</strong>
          <div className="school-form-grid">
            <input style={select} placeholder="Prénom du directeur" value={form.directeurPrenom} onChange={(e) => setForm({ ...form, directeurPrenom: e.target.value })} required />
            <input style={select} placeholder="Nom du directeur" value={form.directeurNom} onChange={(e) => setForm({ ...form, directeurNom: e.target.value })} required />
            <input style={select} type="email" placeholder="Email du directeur" value={form.directeurEmail} onChange={(e) => setForm({ ...form, directeurEmail: e.target.value })} required />
            <input style={select} type="password" placeholder="Mot de passe (8 caractères minimum)" value={form.directeurPassword} onChange={(e) => setForm({ ...form, directeurPassword: e.target.value })} minLength={8} required />
          </div>
        </div>
        <div className="school-form-group">
          <strong>Premier professeur</strong>
          <div className="school-form-grid">
            <input style={select} placeholder="Prénom" value={form.enseignantPrenom} onChange={(e) => setForm({ ...form, enseignantPrenom: e.target.value })} required />
            <input style={select} placeholder="Nom" value={form.enseignantNom} onChange={(e) => setForm({ ...form, enseignantNom: e.target.value })} required />
            <input style={select} type="email" placeholder="Email du professeur" value={form.enseignantEmail} onChange={(e) => setForm({ ...form, enseignantEmail: e.target.value })} required />
            <input style={select} type="password" placeholder="Mot de passe (8 caractères minimum)" value={form.enseignantPassword} onChange={(e) => setForm({ ...form, enseignantPassword: e.target.value })} minLength={8} required />
            <input style={select} placeholder="Matière enseignée" value={form.matiere} onChange={(e) => setForm({ ...form, matiere: e.target.value })} required />
          </div>
        </div>
        <div className="school-form-group">
          <strong>Première classe</strong>
          <div className="school-form-grid">
            <input style={select} placeholder="Nom de la classe" value={form.classeNom} onChange={(e) => setForm({ ...form, classeNom: e.target.value })} required />
            <input style={select} placeholder="Niveau scolaire" value={form.classeNiveau} onChange={(e) => setForm({ ...form, classeNiveau: e.target.value })} required />
            <label>
              Capacité maximale
              <input style={select} type="number" min="1" max="100" value={form.capaciteMax} onChange={(e) => setForm({ ...form, capaciteMax: e.target.value })} required />
            </label>
          </div>
        </div>
        <div className="school-form-group">
          <strong>Premier élève et son parent</strong>
          <div className="school-form-grid">
            <input style={select} placeholder="Prénom de l’élève" value={form.elevePrenom} onChange={(e) => setForm({ ...form, elevePrenom: e.target.value })} required />
            <input style={select} placeholder="Nom de l’élève" value={form.eleveNom} onChange={(e) => setForm({ ...form, eleveNom: e.target.value })} required />
            <input style={select} placeholder="Matricule de l’élève" value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} required />
            <input style={select} placeholder="Prénom du parent" value={form.parentPrenom} onChange={(e) => setForm({ ...form, parentPrenom: e.target.value })} required />
            <input style={select} placeholder="Nom du parent" value={form.parentNom} onChange={(e) => setForm({ ...form, parentNom: e.target.value })} required />
            <input style={select} type="email" placeholder="Email du parent" value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} required />
            <input style={select} type="password" placeholder="Mot de passe parent (8 caractères minimum)" value={form.parentPassword} onChange={(e) => setForm({ ...form, parentPassword: e.target.value })} minLength={8} required />
          </div>
        </div>
        <div><button type="submit" style={bouton}>Créer l’établissement</button></div>
      </form>

      <h3>Établissements enregistrés</h3>
      {chargement ? <p>Chargement...</p> : ecoles.length === 0 ? <p>Aucun établissement.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
            <thead>
              <tr><th style={th}>Établissement</th><th style={th}>Directeur</th><th style={th}>Adresse</th><th style={th}>Classes</th><th style={th}>Élèves</th><th style={th}>Comptes</th></tr>
            </thead>
            <tbody>
              {ecoles.map((ecole) => (
                <tr key={ecole.id}>
                  <td style={td}>{ecole.nom}</td>
                  <td style={td}>{ecole.directeur ? `${ecole.directeur.prenom} ${ecole.directeur.nom}` : 'Non renseigné'}</td>
                  <td style={td}>{ecole.adresse || '—'}</td>
                  <td style={td}>{ecole._count.classes}</td>
                  <td style={td}>{ecole._count.eleves}</td>
                  <td style={td}>{ecole._count.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}