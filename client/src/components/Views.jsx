import { useCallback, useEffect, useState } from 'react';
import API from '../services/api';
import { card, th, td } from './viewStyles';

// ---------- Styles et petits composants partagés ----------
const bouton = { background: 'var(--accent)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer' };
const select = { padding: '0.5rem', borderRadius: 4, border: '1px solid var(--border)', minWidth: 220, background: 'var(--surface)', color: 'var(--text-primary)' };

export function Kpi({ titre, valeur, couleur = 'var(--accent)' }) {
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
const slugEmail = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '.')
  .replace(/^\.+|\.+$/g, '');
const messageErreurApi = (error, fallback) => {
  const data = error.response?.data;
  const details = [
    typeof data?.error === 'string' ? data.error : data?.message,
    data?.context && `Étape : ${data.context}`,
    data?.code && `Code : ${data.code}`,
    data?.details,
    data?.hint && `Piste : ${data.hint}`
  ].filter(Boolean);
  return details.length > 0 ? details.join(' — ') : error.message || fallback;
};

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
  if (erreur) return <p style={{ color: 'var(--status-danger)' }}>{erreur}</p>;
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
                    <td
                      key={j}
                      className={`timetable-cell${s ? '' : ' timetable-cell-empty'}`}
                      style={{ ...td, background: s ? COULEURS[s.matiere] || '#f3f4f6' : 'var(--surface)' }}
                    >
                      {s ? (
                        <>
                          <div style={{ fontWeight: 700 }}>{s.matiere}</div>
                          <div className="timetable-teacher" style={{ fontSize: 12 }}>
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
      {erreur && <p style={{ color: 'var(--status-danger)' }}>{erreur}</p>}
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

  if (erreur) return <p style={{ color: 'var(--status-danger)' }}>{erreur}</p>;
  if (!enfants) return <p>Chargement...</p>;
  if (enfants.length === 0) return <p>Aucun élève rattaché à ce compte.</p>;

  const e = enfants[index] || enfants[0];
  const ongletsDispo = [['emploi', 'Emploi du temps'], ['notes', 'Notes'], ['absences', 'Absences'], ['paiements', 'Paiements']];
  const visibles = role === 'ELEVE' ? ongletsDispo.filter(([k]) => k !== 'paiements') : ongletsDispo;
  const absencesNonJustifiees = e.absences.filter((absence) => !absence.justifiee).length;

  return (
    <Section titre={role === 'PARENT' ? 'Suivi de mes enfants' : 'Mon espace élève'}>
      <div className="student-report">
        <div className="student-report-actions print-hide">
          <button type="button" className="print-button" onClick={() => window.print()}>
            Imprimer / Exporter PDF
          </button>
        </div>

        {role === 'PARENT' && enfants.length > 1 && (
          <div className="print-hide" style={{ marginBottom: 16 }}>
            <label style={{ marginRight: 8 }}>Enfant :</label>
            <select style={select} value={index} onChange={(ev) => setIndex(Number(ev.target.value))}>
              {enfants.map((x, i) => <option key={x.id} value={i}>{x.prenom} {x.nom} – {x.classe?.nom}</option>)}
            </select>
          </div>
        )}

        <div className="student-report-summary">
          <Kpi titre="Élève" valeur={`${e.prenom} ${e.nom}`} />
          <Kpi titre="Classe" valeur={e.classe?.nom || 'N/A'} />
          <Kpi
            titre="Moyenne générale pondérée"
            valeur={e.moyenne !== null ? `${Number(e.moyenne).toFixed(2)}/20` : 'Aucune note'}
            couleur={e.moyenne === null ? 'var(--text-muted)' : e.moyenne < 10 ? 'var(--status-danger)' : 'var(--status-success)'}
          />
          <Kpi titre="Absences" valeur={e.absences.length} couleur="var(--status-warning)" />
          <Kpi titre="Non justifiées" valeur={absencesNonJustifiees} couleur="var(--status-danger)" />
        </div>

        <nav className="student-report-tabs print-hide" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {visibles.map(([k, label]) => (
            <button key={k} onClick={() => setOnglet(k)}
              style={{ ...bouton, background: onglet === k ? 'var(--accent)' : 'var(--surface)', color: onglet === k ? '#fff' : 'var(--accent)', border: '1px solid var(--accent)' }}>
              {label}
            </button>
          ))}
        </nav>

        {onglet === 'emploi' && <Timetable classeId={e.classeId} />}

        {onglet === 'notes' && (
          <>
            <h3>Bulletin de notes</h3>
            {e.notes.length === 0 ? <p>Aucune note n’a encore été enregistrée.</p> : (
              <div className="student-report-table">
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
                  <thead>
                    <tr>
                      <th style={th}>Matière</th>
                      <th style={th}>Note /20</th>
                      <th style={th}>Coefficient</th>
                      <th style={th}>Évaluation</th>
                      <th style={th}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.notes.map((n) => (
                      <tr key={n.id}>
                        <td style={td}>{n.matiere}</td>
                        <td className={Number(n.valeur) < 10 ? 'grade-recovery' : 'grade-success'} style={{ ...td, fontWeight: 700 }}>
                          {Number(n.valeur).toFixed(2)}
                        </td>
                        <td style={td}>{n.coefficient}</td>
                        <td style={td}>{n.typeEvaluation || 'Devoir'}</td>
                        <td style={td}>{formatDate(n.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {onglet === 'absences' && (
          <>
            <h3>Historique des absences</h3>
            {e.absences.length === 0 ? <p>Aucune absence enregistrée.</p> : (
              <div className="student-report-table">
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
                  <thead>
                    <tr>
                      <th style={th}>Date</th>
                      <th style={th}>Matière</th>
                      <th style={th}>Statut</th>
                      <th style={th}>Motif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.absences.map((a) => (
                      <tr key={a.id}>
                        <td style={td}>{formatDate(a.date)}</td>
                        <td style={td}>{a.matiere || '—'}</td>
                        <td className={a.justifiee ? 'grade-success' : 'grade-recovery'} style={{ ...td, fontWeight: 650 }}>
                          {a.justifiee ? 'Justifiée' : 'Non justifiée'}
                        </td>
                        <td style={td}>{a.motif || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {onglet === 'paiements' && (
          <div className="student-report-table">
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
          </div>
        )}
      </div>
    </Section>
  );
}

// ---------- Paiements détaillés (direction / comptabilité) ----------
const couleurStatut = {
  PAYE: 'var(--status-success)',
  PARTIEL: 'var(--status-warning)',
  IMPAYE: 'var(--status-danger)'
};

export function Paiements() {
  const [liste, setListe] = useState(null);
  const [erreur, setErreur] = useState('');
  const [classe, setClasse] = useState('TOUTES');
  const [statut, setStatut] = useState('TOUS');

  useEffect(() => {
    let active = true;
    API.get('/paiements')
      .then((r) => {
        if (!Array.isArray(r.data)) throw new Error('Réponse invalide du serveur pour les paiements.');
        if (active) setListe(r.data);
      })
      .catch((e) => {
        if (active) setErreur(e.response?.data?.error || e.message || 'Impossible de charger les paiements');
      });
    return () => { active = false; };
  }, []);

  if (erreur) return <p style={{ color: 'var(--status-danger)' }}>{erreur}</p>;
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
        <Kpi titre="Encaissé" valeur={`${encaisse} TND`} couleur="var(--status-success)" />
        <Kpi titre="Reste à payer" valeur={`${attendu - encaisse} TND`} couleur="var(--status-danger)" />
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
                <td style={{ ...td, fontWeight: 700, color: couleurStatut[p.statut] || 'var(--text-primary)' }}>{p.statut}</td>
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
      {erreur && <p style={{ color: 'var(--status-danger)' }}>{erreur}</p>}
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
export function Eleves({ role, onElevesChanged }) {
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [classesErreur, setClassesErreur] = useState('');
  const [resultat, setResultat] = useState(null);
  const [actualisation, setActualisation] = useState(0);
  const [formulaire, setFormulaire] = useState({ prenom: '', nom: '', classeId: '' });
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [suppressionId, setSuppressionId] = useState(null);
  const [erreurMutation, setErreurMutation] = useState('');
  const [messageMutation, setMessageMutation] = useState('');
  const [compteCree, setCompteCree] = useState(null);
  const peutGerer = ['DIRECTEUR', 'ADMIN_ECOLE'].includes(role);

  useEffect(() => {
    let active = true;
    API.get('/classes')
      .then((r) => {
        if (active) {
          setClasses(r.data);
          setClassesErreur('');
        }
      })
      .catch((e) => {
        if (active) setClassesErreur(e.response?.data?.error || 'Impossible de charger les classes');
      });
    return () => { active = false; };
  }, [actualisation]);

  useEffect(() => {
    let active = true;
    API.get('/eleves', { params: classeId ? { classeId } : {} })
      .then((r) => {
        if (active) setResultat({ classeId, actualisation, eleves: r.data });
      })
      .catch((e) => {
        if (active) setResultat({
          classeId,
          actualisation,
          erreur: e.response?.data?.error || 'Impossible de charger les élèves'
        });
      });
    return () => { active = false; };
  }, [classeId, actualisation]);

  const resultatCourant = resultat?.classeId === classeId && resultat?.actualisation === actualisation
    ? resultat
    : null;
  const eleves = resultatCourant?.eleves;
  const prenomEmail = slugEmail(formulaire.prenom);
  const nomEmail = slugEmail(formulaire.nom);
  const emailApercu = prenomEmail && nomEmail
    ? `etu.${prenomEmail}.${nomEmail}@edu.tn`
    : '';

  const actualiserApresMutation = async () => {
    setResultat(null);
    setActualisation((version) => version + 1);
    await onElevesChanged?.();
  };

  const ajouterEleve = async (event) => {
    event.preventDefault();
    setErreurMutation('');
    setMessageMutation('');
    setCompteCree(null);
    setAjoutEnCours(true);
    try {
      const response = await API.post('/eleves', {
        prenom: formulaire.prenom.trim(),
        nom: formulaire.nom.trim(),
        classeId: Number(formulaire.classeId)
      });
      setCompteCree(response.data.compte);
      setMessageMutation('Élève ajouté.');
      setFormulaire({ prenom: '', nom: '', classeId: '' });
      setClasseId('');
      await actualiserApresMutation();
    } catch (error) {
      setErreurMutation(messageErreurApi(error, 'Impossible d’ajouter cet élève'));
    } finally {
      setAjoutEnCours(false);
    }
  };

  const supprimerEleve = async (eleve) => {
    const confirme = window.confirm(
      `Supprimer ${eleve.prenom} ${eleve.nom} ? Ses notes, absences, paiements et son compte élève seront également supprimés.`
    );
    if (!confirme) return;

    setErreurMutation('');
    setMessageMutation('');
    setCompteCree(null);
    setSuppressionId(eleve.id);
    try {
      await API.delete(`/eleves/${eleve.id}`);
      setMessageMutation('Élève supprimé.');
      await actualiserApresMutation();
    } catch (error) {
      setErreurMutation(messageErreurApi(error, 'Impossible de supprimer cet élève'));
    } finally {
      setSuppressionId(null);
    }
  };

  return (
    <Section titre="Élèves">
      {classesErreur && <p style={{ color: 'var(--status-danger)' }}>{classesErreur}</p>}
      {erreurMutation && <p role="alert" style={{ color: 'var(--status-danger)' }}>{erreurMutation}</p>}
      {messageMutation && <p role="status" style={{ color: 'var(--status-success)' }}>{messageMutation}</p>}
      {compteCree && (
        <div role="status" style={{ ...card, marginBottom: 16 }}>
          <strong>Identifiants du nouvel élève</strong>
          <div>Email : {compteCree.email}</div>
          <div>Mot de passe initial : {compteCree.motDePasseInitial}</div>
        </div>
      )}
      {peutGerer && (
        <form
          onSubmit={ajouterEleve}
          style={{ ...card, display: 'grid', gap: 10, marginBottom: 20 }}
        >
          <h3 style={{ margin: 0 }}>Ajouter un étudiant</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <input
              style={select}
              placeholder="Prénom"
              autoComplete="given-name"
              value={formulaire.prenom}
              onChange={(event) => setFormulaire({ ...formulaire, prenom: event.target.value })}
              required
            />
            <input
              style={select}
              placeholder="Nom"
              autoComplete="family-name"
              value={formulaire.nom}
              onChange={(event) => setFormulaire({ ...formulaire, nom: event.target.value })}
              required
            />
            <select
              style={select}
              value={formulaire.classeId}
              onChange={(event) => setFormulaire({ ...formulaire, classeId: event.target.value })}
              required
              disabled={classes.length === 0}
              aria-label="Classe du nouvel élève"
            >
              <option value="">Choisir une classe</option>
              {classes.map((classe) => (
                <option key={classe.id} value={classe.id}>
                  {classe.nom} ({classe._count.eleves}/{classe.capaciteMax})
                </option>
              ))}
            </select>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Email proposé : <strong>{emailApercu || 'etu.prenom.nom@edu.tn'}</strong>
            {' · '}Mot de passe initial : <strong>Demo2026!</strong>
            {' · '}En cas de doublon, un suffixe sera ajouté à l’email.
          </p>
          <div>
            <button type="submit" style={bouton} disabled={ajoutEnCours || classes.length === 0}>
              {ajoutEnCours ? 'Ajout en cours…' : 'Ajouter un étudiant'}
            </button>
          </div>
        </form>
      )}
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="filtre-classe" style={{ marginRight: 8 }}>Filtrer par classe :</label>
        <select id="filtre-classe" style={select} value={classeId} onChange={(e) => setClasseId(e.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map((classe) => <option key={classe.id} value={classe.id}>{classe.nom}</option>)}
        </select>
      </div>
      {resultatCourant?.erreur && <p style={{ color: 'var(--status-danger)' }}>{resultatCourant.erreur}</p>}
      {!resultatCourant && <p>Chargement des élèves...</p>}
      {eleves?.length === 0 && <p>Aucun élève pour ce filtre.</p>}
      {eleves?.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
            <thead>
              <tr>
                <th style={th}>Matricule</th>
                <th style={th}>Nom & Prénom</th>
                <th style={th}>Classe</th>
                <th style={th}>Parent</th>
                {peutGerer && <th style={th}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {eleves.map((el) => (
                <tr key={el.id}>
                  <td style={td}>{el.matricule}</td>
                  <td style={td}>{el.nom} {el.prenom}</td>
                  <td style={td}>{el.classe?.nom || 'N/A'}</td>
                  <td style={td}>{el.parent ? `${el.parent.prenom} ${el.parent.nom}` : '—'}</td>
                  {peutGerer && (
                    <td style={td}>
                      <button
                        type="button"
                        onClick={() => supprimerEleve(el)}
                        disabled={suppressionId !== null}
                        style={{
                          background: '#dc2626',
                          color: '#fff',
                          border: 0,
                          borderRadius: 4,
                          padding: '0.35rem 0.65rem',
                          cursor: suppressionId !== null ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {suppressionId === el.id ? 'Suppression…' : 'Supprimer'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      {erreur && <p style={{ color: 'var(--status-danger)' }}>{erreur}</p>}
      {message && <p style={{ color: 'var(--status-success)' }}>{message}</p>}

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