const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const arrondi = (n, d = 1) => Number(Number(n).toFixed(d));

exports.getDashboardBI = async (req, res) => {
  const { schoolId } = req.user;
  const anneeScolaire = req.query.annee || '2026-2027';

  try {
    // ---------- 1. GÉNÉRAL ----------
    const classes = await prisma.classe.findMany({
      where: { schoolId, anneeScolaire },
      include: { _count: { select: { eleves: true } } }
    });

    const totalEnseignants = await prisma.user.count({
      where: { schoolId, role: 'ENSEIGNANT' }
    });

    const totalEleves = classes.reduce((acc, c) => acc + c._count.eleves, 0);
    const capaciteTotale = classes.reduce((acc, c) => acc + c.capaciteMax, 0);

    const alertesClasses = classes.map((c) => {
      const taux = c.capaciteMax > 0 ? Math.round((c._count.eleves / c.capaciteMax) * 100) : 0;
      return {
        classe: c.nom,
        niveau: c.niveau,
        effectif: c._count.eleves,
        capacite: c.capaciteMax,
        tauxOccupation: taux,
        statut: taux > 95 ? 'SURCHARGÉE' : taux < 40 ? 'SOUS-REMPLIE' : 'NORMALE'
      };
    });

    // ---------- 2. FINANCIER ----------
    const paiements = await prisma.paiement.findMany({
      where: { schoolId, anneeScolaire },
      include: { eleve: { include: { parent: true } } }
    });

    const totalAttendu = paiements.reduce((s, p) => s + p.montantTotal, 0);
    const totalEncaisse = paiements.reduce((s, p) => s + p.montantPaye, 0);
    const tauxRecouvrement = totalAttendu > 0 ? arrondi((totalEncaisse / totalAttendu) * 100) : 0;

    const retardsPaiement = paiements
      .filter((p) => p.montantPaye < p.montantTotal)
      .map((p) => ({
        eleve: `${p.eleve.prenom} ${p.eleve.nom}`,
        parent: p.eleve.parent ? `${p.eleve.parent.prenom} ${p.eleve.parent.nom}` : 'N/A',
        resteAPayer: p.montantTotal - p.montantPaye,
        statut: p.statut
      }));

    const elevesImpayes = new Set(
      paiements.filter((p) => p.montantPaye < p.montantTotal).map((p) => p.eleveId)
    );

    const repartitionPaiements = [
      { statut: 'Payé', valeur: paiements.filter((p) => p.montantPaye >= p.montantTotal).length },
      { statut: 'Partiel', valeur: paiements.filter((p) => p.montantPaye > 0 && p.montantPaye < p.montantTotal).length },
      { statut: 'Impayé', valeur: paiements.filter((p) => p.montantPaye === 0).length }
    ];

    // ---------- 3. PÉDAGOGIQUE + ABSENCES + EARLY WARNING ----------
    const eleves = await prisma.eleve.findMany({
      where: { schoolId, anneeScolaire },
      include: { notes: true, absences: true, classe: true }
    });

    let sommeMoyennes = 0;
    let compteurMoyennes = 0;
    let reussis = 0;
    const parMatiere = {};
    const parClasse = {};
    const absParMois = {};
    let absJustifiees = 0;
    let absNonJustifiees = 0;
    const earlyWarnings = [];

    eleves.forEach((eleve) => {
      let points = 0;
      let coeffs = 0;

      eleve.notes.forEach((n) => {
        points += n.valeur * n.coefficient;
        coeffs += n.coefficient;
        if (!parMatiere[n.matiere]) parMatiere[n.matiere] = { total: 0, nb: 0 };
        parMatiere[n.matiere].total += n.valeur;
        parMatiere[n.matiere].nb += 1;
      });

      const moyenne = coeffs > 0 ? points / coeffs : null;
      if (moyenne !== null) {
        sommeMoyennes += moyenne;
        compteurMoyennes++;
        if (moyenne >= 10) reussis++;
        const nomClasse = eleve.classe?.nom || 'N/A';
        if (!parClasse[nomClasse]) parClasse[nomClasse] = { total: 0, nb: 0 };
        parClasse[nomClasse].total += moyenne;
        parClasse[nomClasse].nb += 1;
      }

      eleve.absences.forEach((a) => {
        if (a.justifiee) absJustifiees++;
        else absNonJustifiees++;
        const d = new Date(a.date);
        const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        absParMois[cle] = (absParMois[cle] || 0) + 1;
      });

      const absencesNJ = eleve.absences.filter((a) => !a.justifiee).length;
      const alertes = [];
      if (moyenne !== null && moyenne < 10) alertes.push('Risque d\'échec (moyenne < 10)');
      if (absencesNJ >= 3) alertes.push(`Absentéisme élevé (${absencesNJ} non justifiées)`);
      if (elevesImpayes.has(eleve.id)) alertes.push('Risque d\'impayé');

      if (alertes.length > 0) {
        earlyWarnings.push({
          eleve: `${eleve.prenom} ${eleve.nom}`,
          classe: eleve.classe?.nom || 'N/A',
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
      .map(([matiere, v]) => ({ matiere, moyenne: arrondi(v.total / v.nb, 2) }))
      .sort((a, b) => b.moyenne - a.moyenne);

    const moyennesParClasse = Object.entries(parClasse).map(([classe, v]) => ({
      classe,
      moyenne: arrondi(v.total / v.nb, 2)
    }));

    const absencesParMois = Object.entries(absParMois)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mois, nombre]) => ({ mois, nombre }));

    const totalAbsences = absJustifiees + absNonJustifiees;

    // ---------- 4. RECOMMANDATIONS AUTOMATIQUES ----------
    const recommandations = [];
    const risquesEleves = earlyWarnings.filter((e) => e.niveauRisque === 'ÉLEVÉ');
    if (risquesEleves.length > 0) {
      recommandations.push(
        `${risquesEleves.length} élève(s) cumulent plusieurs facteurs de risque : convoquer les parents et prévoir un soutien pédagogique.`
      );
    }
    if (tauxRecouvrement < 80) {
      recommandations.push(`Taux de recouvrement de ${tauxRecouvrement}% : lancer des relances ciblées auprès des parents en retard.`);
    }
    alertesClasses
      .filter((c) => c.statut === 'SURCHARGÉE')
      .forEach((c) => recommandations.push(`La classe ${c.classe} est surchargée : envisager d'ouvrir une section.`));
    alertesClasses
      .filter((c) => c.statut === 'SOUS-REMPLIE')
      .forEach((c) => recommandations.push(`La classe ${c.classe} est sous-remplie : revoir les affectations ou les inscriptions.`));
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
        totalEnseignants,
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
        total: totalAbsences,
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