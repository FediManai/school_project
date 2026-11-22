const { fetchAll } = require('../supabaseAdmin');

const arrondi = (n, d = 1) => Number(Number(n).toFixed(d));
const idsUniques = (rows, key) => [...new Set(rows.map((row) => row[key]).filter((id) => id !== null && id !== undefined))];

exports.getDashboardBI = async (req, res) => {
  const { schoolId } = req.user;
  const anneeScolaire = req.query.annee || '2026-2027';

  try {
    const [classes, enseignants, tousLesEleves, paiements] = await Promise.all([
      fetchAll('Classe', '*', (query) => query
        .eq('schoolId', schoolId)
        .eq('anneeScolaire', anneeScolaire)
        .order('nom', { ascending: true })),
      fetchAll('User', 'id', (query) => query
        .eq('schoolId', schoolId)
        .eq('role', 'ENSEIGNANT')),
      fetchAll('Eleve', '*', (query) => query.eq('schoolId', schoolId)),
      fetchAll('Paiement', '*', (query) => query
        .eq('schoolId', schoolId)
        .eq('anneeScolaire', anneeScolaire))
    ]);

    const eleves = tousLesEleves.filter((eleve) => eleve.anneeScolaire === anneeScolaire);
    const eleveIds = idsUniques(eleves, 'id');
    const elevesPaiements = idsUniques(paiements, 'eleveId');
    const [notes, absences, elevesAvecPaiements] = await Promise.all([
      eleveIds.length
        ? fetchAll('Note', '*', (query) => query.in('eleveId', eleveIds))
        : [],
      eleveIds.length
        ? fetchAll('Absence', '*', (query) => query
          .eq('schoolId', schoolId)
          .in('eleveId', eleveIds))
        : [],
      elevesPaiements.length
        ? fetchAll('Eleve', 'id,nom,prenom,parentId', (query) => query
          .eq('schoolId', schoolId)
          .in('id', elevesPaiements))
        : []
    ]);
    const parentsIds = idsUniques(elevesAvecPaiements, 'parentId');
    const parents = parentsIds.length
      ? await fetchAll('User', 'id,nom,prenom', (query) => query
        .eq('schoolId', schoolId)
        .in('id', parentsIds))
      : [];

    const effectifs = new Map();
    tousLesEleves.forEach((eleve) => {
      effectifs.set(eleve.classeId, (effectifs.get(eleve.classeId) || 0) + 1);
    });
    const classesParId = new Map(classes.map((classe) => [classe.id, classe]));

    const totalEleves = classes.reduce((total, classe) => total + (effectifs.get(classe.id) || 0), 0);
    const capaciteTotale = classes.reduce((total, classe) => total + Number(classe.capaciteMax), 0);
    const alertesClasses = classes.map((classe) => {
      const effectif = effectifs.get(classe.id) || 0;
      const taux = Number(classe.capaciteMax) > 0
        ? Math.round((effectif / Number(classe.capaciteMax)) * 100)
        : 0;
      return {
        classe: classe.nom,
        niveau: classe.niveau,
        effectif,
        capacite: Number(classe.capaciteMax),
        tauxOccupation: taux,
        statut: taux > 95 ? 'SURCHARGÉE' : taux < 40 ? 'SOUS-REMPLIE' : 'NORMALE'
      };
    });

    const totalAttendu = paiements.reduce((sum, paiement) => sum + Number(paiement.montantTotal), 0);
    const totalEncaisse = paiements.reduce((sum, paiement) => sum + Number(paiement.montantPaye), 0);
    const tauxRecouvrement = totalAttendu > 0 ? arrondi((totalEncaisse / totalAttendu) * 100) : 0;
    const elevesImpayes = new Set(
      paiements
        .filter((paiement) => Number(paiement.montantPaye) < Number(paiement.montantTotal))
        .map((paiement) => paiement.eleveId)
    );
    const repartitionPaiements = [
      { statut: 'Payé', valeur: paiements.filter((p) => Number(p.montantPaye) >= Number(p.montantTotal)).length },
      { statut: 'Partiel', valeur: paiements.filter((p) => Number(p.montantPaye) > 0 && Number(p.montantPaye) < Number(p.montantTotal)).length },
      { statut: 'Impayé', valeur: paiements.filter((p) => Number(p.montantPaye) === 0).length }
    ];

    const elevesParId = new Map(tousLesEleves.map((eleve) => [eleve.id, eleve]));
    const parentsParId = new Map(parents.map((parent) => [parent.id, parent]));
    const retardsPaiement = paiements
      .filter((paiement) => Number(paiement.montantPaye) < Number(paiement.montantTotal))
      .map((paiement) => {
        const eleve = elevesParId.get(paiement.eleveId);
        const parent = eleve?.parentId ? parentsParId.get(eleve.parentId) : null;
        return {
          eleve: eleve ? `${eleve.prenom} ${eleve.nom}` : 'N/A',
          parent: parent ? `${parent.prenom} ${parent.nom}` : 'N/A',
          resteAPayer: Number(paiement.montantTotal) - Number(paiement.montantPaye),
          statut: paiement.statut
        };
      });

    const notesParEleve = new Map();
    notes.forEach((note) => {
      if (!notesParEleve.has(note.eleveId)) notesParEleve.set(note.eleveId, []);
      notesParEleve.get(note.eleveId).push(note);
    });
    const absencesParEleve = new Map();
    absences.forEach((absence) => {
      if (!absencesParEleve.has(absence.eleveId)) absencesParEleve.set(absence.eleveId, []);
      absencesParEleve.get(absence.eleveId).push(absence);
    });

    let sommeMoyennes = 0;
    let compteurMoyennes = 0;
    let reussis = 0;
    let absJustifiees = 0;
    let absNonJustifiees = 0;
    const parMatiere = {};
    const parClasse = {};
    const absParMois = {};
    const earlyWarnings = [];

    eleves.forEach((eleve) => {
      const notesEleve = notesParEleve.get(eleve.id) || [];
      const absencesEleve = absencesParEleve.get(eleve.id) || [];
      let points = 0;
      let coeffs = 0;

      notesEleve.forEach((note) => {
        const valeur = Number(note.valeur);
        const coefficient = Number(note.coefficient);
        points += valeur * coefficient;
        coeffs += coefficient;
        if (!parMatiere[note.matiere]) parMatiere[note.matiere] = { total: 0, nb: 0 };
        parMatiere[note.matiere].total += valeur;
        parMatiere[note.matiere].nb += 1;
      });

      const moyenne = coeffs > 0 ? points / coeffs : null;
      if (moyenne !== null) {
        sommeMoyennes += moyenne;
        compteurMoyennes += 1;
        if (moyenne >= 10) reussis += 1;
        const nomClasse = classesParId.get(eleve.classeId)?.nom || 'N/A';
        if (!parClasse[nomClasse]) parClasse[nomClasse] = { total: 0, nb: 0 };
        parClasse[nomClasse].total += moyenne;
        parClasse[nomClasse].nb += 1;
      }

      absencesEleve.forEach((absence) => {
        if (absence.justifiee) absJustifiees += 1;
        else absNonJustifiees += 1;
        const date = new Date(absence.date);
        const cle = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        absParMois[cle] = (absParMois[cle] || 0) + 1;
      });

      const absencesNJ = absencesEleve.filter((absence) => !absence.justifiee).length;
      const alertes = [];
      if (moyenne !== null && moyenne < 10) alertes.push('Risque d\'échec (moyenne < 10)');
      if (absencesNJ >= 3) alertes.push(`Absentéisme élevé (${absencesNJ} non justifiées)`);
      if (elevesImpayes.has(eleve.id)) alertes.push('Risque d\'impayé');

      if (alertes.length > 0) {
        const nomClasse = classesParId.get(eleve.classeId)?.nom || 'N/A';
        earlyWarnings.push({
          eleve: `${eleve.prenom} ${eleve.nom}`,
          classe: nomClasse,
          moyenne: moyenne !== null ? arrondi(moyenne, 2) : null,
          absencesNJ,
          niveauRisque: alertes.length >= 2 ? 'ÉLEVÉ' : 'MOYEN',
          alertes
        });
      }
    });

    const moyenneEtablissement = compteurMoyennes > 0 ? arrondi(sommeMoyennes / compteurMoyennes, 2) : 0;
    const tauxReussite = compteurMoyennes > 0 ? arrondi((reussis / compteurMoyennes) * 100) : 0;
    const moyennesParMatiere = Object.entries(parMatiere)
      .map(([matiere, valeurs]) => ({ matiere, moyenne: arrondi(valeurs.total / valeurs.nb, 2) }))
      .sort((a, b) => b.moyenne - a.moyenne);
    const moyennesParClasse = Object.entries(parClasse).map(([classe, valeurs]) => ({
      classe,
      moyenne: arrondi(valeurs.total / valeurs.nb, 2)
    }));
    const absencesParMois = Object.entries(absParMois)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mois, nombre]) => ({ mois, nombre }));

    const recommandations = [];
    const risquesEleves = earlyWarnings.filter((eleve) => eleve.niveauRisque === 'ÉLEVÉ');
    if (risquesEleves.length > 0) {
      recommandations.push(
        `${risquesEleves.length} élève(s) cumulent plusieurs facteurs de risque : convoquer les parents et prévoir un soutien pédagogique.`
      );
    }
    if (tauxRecouvrement < 80) {
      recommandations.push(`Taux de recouvrement de ${tauxRecouvrement}% : lancer des relances ciblées auprès des parents en retard.`);
    }
    alertesClasses
      .filter((classe) => classe.statut === 'SURCHARGÉE')
      .forEach((classe) => recommandations.push(`La classe ${classe.classe} est surchargée : envisager d'ouvrir une section.`));
    alertesClasses
      .filter((classe) => classe.statut === 'SOUS-REMPLIE')
      .forEach((classe) => recommandations.push(`La classe ${classe.classe} est sous-remplie : revoir les affectations ou les inscriptions.`));
    if (moyennesParMatiere.length > 0) {
      const pire = moyennesParMatiere[moyennesParMatiere.length - 1];
      if (pire.moyenne < 12) {
        recommandations.push(`La matière « ${pire.matiere} » a la moyenne la plus faible (${pire.moyenne}/20) : proposer du renforcement.`);
      }
    }
    if (recommandations.length === 0) {
      recommandations.push('Aucun point critique détecté pour cette année scolaire.');
    }

    res.json({
      annee: anneeScolaire,
      general: {
        totalEleves,
        totalClasses: classes.length,
        totalEnseignants: enseignants.length,
        capaciteTotale,
        tauxRemplissage: capaciteTotale > 0 ? Math.round((totalEleves / capaciteTotale) * 100) : 0,
        alertesClasses
      },
      financier: {
        totalAttendu,
        totalEncaisse,
        resteARecouvrer: totalAttendu - totalEncaisse,
        tauxRecouvrement,
        repartitionPaiements,
        retardsPaiement
      },
      pedagogique: {
        moyenneEtablissement,
        tauxReussite,
        tauxEchec: arrondi(100 - tauxReussite),
        moyennesParMatiere,
        moyennesParClasse
      },
      absences: {
        total: absJustifiees + absNonJustifiees,
        justifiees: absJustifiees,
        nonJustifiees: absNonJustifiees,
        parMois: absencesParMois
      },
      earlyWarnings,
      recommandations
    });
  } catch (error) {
    console.error('Erreur BI :', error);
    res.status(500).json({ error: 'Erreur lors du calcul BI', details: error.message });
  }
};
