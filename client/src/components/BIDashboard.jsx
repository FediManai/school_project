import { useEffect, useState } from 'react';
import API from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { Kpi, Section } from './Views';
import { card, th, td } from './viewStyles';

function Graphique({ titre, data, cle, nom, categorie, couleur, domaine }) {
  return (
    <div style={{ ...card, flex: '1 1 400px', height: 260 }}>
      <strong>{titre}</strong>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={categorie} />
          <YAxis domain={domaine} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey={cle} name={nom} fill={couleur} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function BIDashboard() {
  const [bi, setBi] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    API.get('/bi/dashboard')
      .then((r) => setBi(r.data))
      .catch((e) => setErreur(e.response?.data?.error || 'Impossible de charger le dashboard'));
  }, []);

  if (erreur) return <p style={{ color: '#b91c1c' }}>{erreur}</p>;
  if (!bi) return <p>Chargement du dashboard...</p>;

  return (
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
                <td style={{ ...td, fontWeight: 600, color: c.statut === 'NORMALE' ? '#047857' : '#b91c1c' }}>{c.statut}</td>
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
        <Graphique titre="Répartition des paiements" data={bi.financier.repartitionPaiements} cle="valeur" nom="Élèves" categorie="statut" couleur="#0891b2" />
      </Section>

      <Section titre="Pédagogique">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <Kpi titre="Moyenne de l'établissement" valeur={`${bi.pedagogique.moyenneEtablissement}/20`} />
          <Kpi titre="Taux de réussite" valeur={`${bi.pedagogique.tauxReussite}%`} couleur="#047857" />
          <Kpi titre="Taux d'échec" valeur={`${bi.pedagogique.tauxEchec}%`} couleur="#b91c1c" />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Graphique titre="Moyenne par matière" data={bi.pedagogique.moyennesParMatiere} cle="moyenne" nom="Moyenne" categorie="matiere" couleur="#7c3aed" domaine={[0, 20]} />
          <Graphique titre="Moyenne par classe" data={bi.pedagogique.moyennesParClasse} cle="moyenne" nom="Moyenne" categorie="classe" couleur="#0891b2" domaine={[0, 20]} />
        </div>
      </Section>

      <Section titre="Absences">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <Kpi titre="Total" valeur={bi.absences.total} />
          <Kpi titre="Justifiées" valeur={bi.absences.justifiees} couleur="#047857" />
          <Kpi titre="Non justifiées" valeur={bi.absences.nonJustifiees} couleur="#b91c1c" />
        </div>
        <Graphique titre="Évolution mensuelle" data={bi.absences.parMois} cle="nombre" nom="Absences" categorie="mois" couleur="#f59e0b" />
      </Section>

      <Section titre="Early Warning – élèves à risque">
        {bi.earlyWarnings.length === 0 ? <p>Aucun élève à risque.</p> : (
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
  );
}