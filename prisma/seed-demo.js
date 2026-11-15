require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const ANNEE_SCOLAIRE = process.env.ANNEE_SCOLAIRE || '2026-2027';
const MOT_DE_PASSE_DEMO = 'Demo2026!';
const MATIERES = ['Mathématiques', 'Français', 'Sciences', 'Arabe'];
const PRENOMS = [
  'Youssef', 'Yasmine', 'Aymen', 'Chaima', 'Amine', 'Malek', 'Hamza', 'Nour',
  'Sami', 'Lina', 'Rania', 'Omar', 'Salma', 'Rami', 'Amira', 'Rim',
  'Karim', 'Mariam', 'Adam', 'Ines', 'Mehdi', 'Farah', 'Anis', 'Sana'
];
const NOMS = [
  'Khemiri', 'Dridi', 'Gharbi', 'Trabelsi', 'Mejri', 'Ayari', 'Bouazizi',
  'Ben Amor', 'Haddad', 'Mansour', 'Zouari', 'Fakhfakh', 'Ben Youssef',
  'Khaldi', 'Ben Salah', 'Hammami', 'Jaziri', 'Ben Romdhane', 'Sassi',
  'Mejbri', 'Chebbi', 'Gharsalli', 'Riahi', 'Touati'
];
const ECOLES = [
  {
    code: 'HC',
    nom: 'École Pilote Hédi Chaker',
    adresse: 'Avenue Habib Bourguiba, Sousse',
    nombreEleves: 40,
    administration: [
      { nom: 'Admin', prenom: 'École', email: 'admin@hedichaker.edu.tn', role: 'ADMIN_ECOLE' },
      { nom: 'Hamdi', prenom: 'Walid', email: 'comptable@hedichaker.edu.tn', role: 'COMPTABLE' }
    ],
    directeur: { nom: 'Mansouri', prenom: 'Sonia', email: 'directeur@hedichaker.edu.tn' },
    classes: [
      { nom: '5ème Année A', niveau: '5ème Primaire', capaciteMax: 25 },
      { nom: '6ème Année B', niveau: '6ème Primaire', capaciteMax: 25 }
    ],
    enseignants: [
      { nom: 'Jaziri', prenom: 'Karim', email: 'prof.jaziri@hedichaker.edu.tn', matiere: 'Mathématiques' },
      { nom: 'Ben Salah', prenom: 'Leila', email: 'prof.bensalah@hedichaker.edu.tn', matiere: 'Français' },
      { nom: 'Kacem', prenom: 'Mehdi', email: 'prof.kacem@hedichaker.edu.tn', matiere: 'Sciences' }
    ]
  },
  {
    code: 'OLI',
    nom: 'École Les Oliviers',
    adresse: 'Avenue de la Liberté, Tunis',
    nombreEleves: 24,
    administration: [
      { nom: 'Admin', prenom: 'Tunis', email: 'admin.tunis@ecoles-demo.tn', role: 'ADMIN_ECOLE' },
      { nom: 'Comptable', prenom: 'Tunis', email: 'comptable.tunis@ecoles-demo.tn', role: 'COMPTABLE' }
    ],
    directeur: { nom: 'Ben Salem', prenom: 'Mouna', email: 'directeur.tunis@ecoles-demo.tn' },
    classes: [
      { nom: '6ème Année A', niveau: '6ème Primaire', capaciteMax: 30 },
      { nom: '6ème Année B', niveau: '6ème Primaire', capaciteMax: 30 }
    ],
    enseignants: [
      { nom: 'Baccouche', prenom: 'Karim', email: 'prof.maths.tunis@ecoles-demo.tn', matiere: 'Mathématiques' },
      { nom: 'Jlassi', prenom: 'Ines', email: 'prof.francais.tunis@ecoles-demo.tn', matiere: 'Français' },
      { nom: 'Saidi', prenom: 'Nabil', email: 'prof.sciences.tunis@ecoles-demo.tn', matiere: 'Sciences' }
    ]
  },
  {
    code: 'AMA',
    nom: 'École El Amal',
    adresse: 'Route de Gremda, Sfax',
    nombreEleves: 24,
    directeur: { nom: 'Trabelsi', prenom: 'Hichem', email: 'directeur.sfax@ecoles-demo.tn' },
    classes: [
      { nom: '5ème Année A', niveau: '5ème Primaire', capaciteMax: 30 },
      { nom: '5ème Année B', niveau: '5ème Primaire', capaciteMax: 30 }
    ],
    enseignants: [
      { nom: 'Mabrouk', prenom: 'Fares', email: 'prof.maths.sfax@ecoles-demo.tn', matiere: 'Mathématiques' },
      { nom: 'Haddad', prenom: 'Salma', email: 'prof.arabe.sfax@ecoles-demo.tn', matiere: 'Arabe' },
      { nom: 'Kefi', prenom: 'Amel', email: 'prof.sciences.sfax@ecoles-demo.tn', matiere: 'Sciences' }
    ]
  }
];

async function obtenirCompte({ email, nom, prenom, role, schoolId }, passwordHash) {
  const existant = await prisma.user.findUnique({ where: { email } });
  if (existant) {
    if (existant.schoolId !== schoolId || existant.role !== role) {
      throw new Error(`Le compte ${email} existe déjà dans un autre établissement ou avec un autre rôle.`);
    }
    return existant;
  }
  return prisma.user.create({
    data: { email, nom, prenom, role, password: passwordHash, schoolId }
  });
}

async function obtenirClasse(ecole, details) {
  const existante = await prisma.classe.findFirst({
    where: { schoolId: ecole.id, nom: details.nom }
  });
  if (existante) return existante;
  return prisma.classe.create({
    data: {
      ...details,
      anneeScolaire: ANNEE_SCOLAIRE,
      schoolId: ecole.id
    }
  });
}

async function assurerEleves(ecole, configuration, classes, passwordHash) {
  const totalActuel = await prisma.eleve.count({ where: { schoolId: ecole.id } });
  const effectifs = new Map(
    (await prisma.eleve.groupBy({
      by: ['classeId'],
      where: { schoolId: ecole.id },
      _count: { _all: true }
    })).map((groupe) => [groupe.classeId, groupe._count._all])
  );

  for (let index = totalActuel + 1; index <= configuration.nombreEleves; index++) {
    const classe = classes
      .filter((candidate) => (effectifs.get(candidate.id) || 0) < candidate.capaciteMax)
      .sort((a, b) => (effectifs.get(a.id) || 0) - (effectifs.get(b.id) || 0))[0];
    if (!classe) {
      throw new Error(`Capacité des classes insuffisante pour atteindre ${configuration.nombreEleves} élèves à ${ecole.nom}.`);
    }

    const suffixe = String(index).padStart(3, '0');
    const matricule = `${configuration.code}-DEMO-${suffixe}`;
    const existant = await prisma.eleve.findUnique({ where: { matricule } });
    if (existant) {
      if (existant.schoolId !== ecole.id) throw new Error(`Le matricule ${matricule} est déjà utilisé.`);
      effectifs.set(existant.classeId, (effectifs.get(existant.classeId) || 0) + 1);
      continue;
    }

    const prenom = PRENOMS[(index - 1) % PRENOMS.length];
    const nom = NOMS[(index - 1) % NOMS.length];
    const parentEmail = `parent.demo.${configuration.code.toLowerCase()}.${suffixe}@ecoles-demo.tn`;
    const eleveEmail = `eleve.demo.${configuration.code.toLowerCase()}.${suffixe}@ecoles-demo.tn`;
    const parent = await obtenirCompte({
      email: parentEmail,
      nom,
      prenom: PRENOMS[index % PRENOMS.length],
      role: 'PARENT',
      schoolId: ecole.id
    }, passwordHash);
    const compteEleve = await obtenirCompte({
      email: eleveEmail,
      nom,
      prenom,
      role: 'ELEVE',
      schoolId: ecole.id
    }, passwordHash);
    const eleve = await prisma.eleve.create({
      data: {
        matricule,
        nom,
        prenom,
        anneeScolaire: ANNEE_SCOLAIRE,
        schoolId: ecole.id,
        classeId: classe.id,
        parentId: parent.id,
        userId: compteEleve.id
      }
    });

    await prisma.note.createMany({
      data: MATIERES.map((matiere, matiereIndex) => ({
        matiere,
        valeur: 10 + ((index * 3 + matiereIndex * 2) % 9),
        coefficient: 2,
        anneeScolaire: ANNEE_SCOLAIRE,
        eleveId: eleve.id
      }))
    });

    const montantPaye = index % 3 === 0 ? 1200 : index % 3 === 1 ? 600 : 0;
    await prisma.paiement.create({
      data: {
        montantTotal: 1200,
        montantPaye,
        statut: montantPaye === 1200 ? 'PAYE' : montantPaye > 0 ? 'PARTIEL' : 'IMPAYE',
        modePaiement: montantPaye > 0 ? 'Virement' : null,
        datePaiement: montantPaye > 0 ? new Date(2026, 8, (index % 25) + 1) : null,
        anneeScolaire: ANNEE_SCOLAIRE,
        schoolId: ecole.id,
        eleveId: eleve.id
      }
    });
    effectifs.set(classe.id, (effectifs.get(classe.id) || 0) + 1);
  }
}

async function assurerEmplois(ecole, classes, enseignants) {
  const planning = [
    [enseignants[0], enseignants[1], enseignants[2]],
    [enseignants[1], enseignants[2], enseignants[0]]
  ];
  const creneaux = [
    ['08:00', '09:00'],
    ['09:00', '10:00'],
    ['10:15', '11:15']
  ];

  for (let index = 0; index < classes.length; index++) {
    const nombreSeances = await prisma.seance.count({
      where: { schoolId: ecole.id, classeId: classes[index].id }
    });
    if (nombreSeances > 0) continue;

    await prisma.seance.createMany({
      data: planning[index % planning.length].map((enseignant, creneauIndex) => ({
        jour: 'Lundi',
        heureDebut: creneaux[creneauIndex][0],
        heureFin: creneaux[creneauIndex][1],
        matiere: enseignants.find((professeur) => professeur.id === enseignant.id).matiere,
        salle: `Salle ${index + 1}`,
        anneeScolaire: ANNEE_SCOLAIRE,
        classeId: classes[index].id,
        enseignantId: enseignant.id,
        schoolId: ecole.id
      }))
    });
  }
}

async function migrerEmailDemo(ecole, { emailActuel, emailAttendu, role }) {
  const cible = await prisma.user.findUnique({ where: { email: emailAttendu } });
  if (cible) {
    if (cible.schoolId !== ecole.id || cible.role !== role) {
      throw new Error(`Le compte ${emailAttendu} existe déjà dans un autre établissement ou avec un autre rôle.`);
    }
    return cible;
  }

  const source = await prisma.user.findUnique({ where: { email: emailActuel } });
  if (!source || source.schoolId !== ecole.id || source.role !== role) {
    throw new Error(`Impossible de retrouver le compte de démonstration ${emailActuel} à ${ecole.nom}.`);
  }
  return prisma.user.update({
    where: { id: source.id },
    data: { email: emailAttendu }
  });
}

async function main() {
  const passwordHash = bcrypt.hashSync(MOT_DE_PASSE_DEMO, 10);

  for (const configuration of ECOLES) {
    let ecole = await prisma.school.findFirst({ where: { nom: configuration.nom } });
    if (!ecole) {
      ecole = await prisma.school.create({
        data: { nom: configuration.nom, adresse: configuration.adresse }
      });
    }

    for (const compte of configuration.administration || []) {
      await obtenirCompte({
        ...compte,
        schoolId: ecole.id
      }, passwordHash);
    }

    await obtenirCompte({
      ...configuration.directeur,
      role: 'DIRECTEUR',
      schoolId: ecole.id
    }, passwordHash);

    const enseignants = [];
    for (const professeur of configuration.enseignants) {
      const compte = await obtenirCompte({
        ...professeur,
        role: 'ENSEIGNANT',
        schoolId: ecole.id
      }, passwordHash);
      enseignants.push({ ...compte, matiere: professeur.matiere });
    }

    const classes = [];
    for (const classe of configuration.classes) {
      classes.push(await obtenirClasse(ecole, classe));
    }

    await assurerEmplois(ecole, classes, enseignants);
    await assurerEleves(ecole, configuration, classes, passwordHash);
  }

  const ecolePrincipale = await prisma.school.findFirst({
    where: { nom: ECOLES[0].nom }
  });
  const ecoleOliviers = await prisma.school.findFirst({
    where: { nom: ECOLES[1].nom }
  });
  await migrerEmailDemo(ecolePrincipale, {
    emailActuel: 'eleve.khemiri@hedichaker.edu.tn',
    emailAttendu: 'eleve.khemiri.001@hedichaker.edu.tn',
    role: 'ELEVE'
  });
  await migrerEmailDemo(ecoleOliviers, {
    emailActuel: 'parent.demo.oli.001@ecoles-demo.tn',
    emailAttendu: 'parent.tunis.1@ecoles-demo.tn',
    role: 'PARENT'
  });
  await migrerEmailDemo(ecoleOliviers, {
    emailActuel: 'eleve.demo.oli.001@ecoles-demo.tn',
    emailAttendu: 'eleve.tunis.1@ecoles-demo.tn',
    role: 'ELEVE'
  });

  await obtenirCompte({
    email: 'superadmin@hedichaker.edu.tn',
    nom: 'Plateforme',
    prenom: 'Admin',
    role: 'SUPER_ADMIN',
    schoolId: ecolePrincipale.id
  }, passwordHash);

  const resultats = await prisma.school.findMany({
    orderBy: { nom: 'asc' },
    select: {
      nom: true,
      _count: { select: { eleves: true, classes: true } }
    }
  });
  console.log('Données de démonstration ajoutées sans supprimer les données existantes :');
  resultats.forEach((ecole) => {
    console.log(` - ${ecole.nom} : ${ecole._count.eleves} élèves, ${ecole._count.classes} classes`);
  });
  console.log(`Mot de passe des comptes de démonstration : ${MOT_DE_PASSE_DEMO}`);
}

main()
  .catch((error) => {
    console.error('Échec du remplissage de démonstration :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
