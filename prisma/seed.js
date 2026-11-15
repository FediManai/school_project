const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const ANNEE = '2026-2027';

const noteAutour = (base) => {
  const v = base + Math.floor(Math.random() * 5) - 2;
  return Math.max(4, Math.min(19, v));
};

const slug = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const CRENEAUX = [
  ['08:00', '09:00'],
  ['09:00', '10:00'],
  ['10:15', '11:15'],
  ['11:15', '12:15'],
  ['13:00', '14:00'],
  ['14:15', '15:15']
];

// Deux programmes sans conflit d'enseignant entre les classes
const PROGRAMME_1 = {
  Lundi: ['Arabe', 'Mathématiques', 'Français', 'Sciences', 'Informatique', 'Histoire-Géographie'],
  Mardi: ['Mathématiques', 'Arabe', 'Anglais', 'Éducation islamique'],
  Mercredi: ['Français', 'Sciences', 'Mathématiques', 'Sport'],
  Jeudi: ['Arabe', 'Français', 'Mathématiques', 'Anglais'],
  Vendredi: ['Sciences', 'Arabe', 'Éducation islamique', 'Sport'],
  Samedi: ['Mathématiques', 'Français']
};
const PROGRAMME_2 = {
  Lundi: ['Mathématiques', 'Arabe', 'Sciences', 'Français', 'Arts plastiques', 'Informatique'],
  Mardi: ['Arabe', 'Sciences', 'Français', 'Mathématiques'],
  Mercredi: ['Mathématiques', 'Arabe', 'Anglais', 'Français'],
  Jeudi: ['Mathématiques', 'Sciences', 'Arabe', 'Français'],
  Vendredi: ['Français', 'Mathématiques', 'Arabe', 'Sciences'],
  Samedi: ['Arabe', 'Sciences']
};

async function main() {
  console.log('Nettoyage et initialisation des données tunisiennes...');

  await prisma.seance.deleteMany();
  await prisma.annonce.deleteMany();
  await prisma.paiement.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.note.deleteMany();
  await prisma.eleve.deleteMany();
  await prisma.classe.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();

  const passwordHash = bcrypt.hashSync('Demo2026!', 10);

  // 1. École
  const ecole = await prisma.school.create({
    data: { nom: 'École Pilote Hédi Chaker', adresse: 'Avenue Habib Bourguiba, Sousse' }
  });

  // 2. Administration
  const comptesAdmin = [
    { nom: 'Plateforme', prenom: 'Admin', email: 'superadmin@hedichaker.edu.tn', role: 'SUPER_ADMIN' },
    { nom: 'Admin', prenom: 'École', email: 'admin@hedichaker.edu.tn', role: 'ADMIN_ECOLE' },
    { nom: 'Mansouri', prenom: 'Sonia', email: 'directeur@hedichaker.edu.tn', role: 'DIRECTEUR' },
    { nom: 'Hamdi', prenom: 'Walid', email: 'comptable@hedichaker.edu.tn', role: 'COMPTABLE' }
  ];
  for (const c of comptesAdmin) {
    await prisma.user.create({ data: { ...c, password: passwordHash, schoolId: ecole.id } });
  }

  // 3. Enseignants (chacun enseigne des matières précises)
  const profs = {};
  const enseignantsData = [
    { nom: 'Jaziri', prenom: 'Karim', email: 'prof.jaziri@hedichaker.edu.tn', matieres: ['Mathématiques', 'Sciences'] },
    { nom: 'Ben Salah', prenom: 'Leila', email: 'prof.bensalah@hedichaker.edu.tn', matieres: ['Arabe', 'Français'] },
    { nom: 'Kacem', prenom: 'Mehdi', email: 'prof.kacem@hedichaker.edu.tn', matieres: ['Anglais', 'Sport', 'Éducation islamique'] },
    { nom: 'Gharbi', prenom: 'Amel', email: 'prof.gharbi@hedichaker.edu.tn', matieres: ['Informatique'] },
    { nom: 'Trabelsi', prenom: 'Sami', email: 'prof.trabelsi@hedichaker.edu.tn', matieres: ['Arts plastiques', 'Histoire-Géographie'] }
  ];
  const profParMatiere = {};
  for (const p of enseignantsData) {
    const { matieres, ...donnees } = p;
    const user = await prisma.user.create({
      data: { ...donnees, password: passwordHash, role: 'ENSEIGNANT', schoolId: ecole.id }
    });
    profs[p.email] = user;
    matieres.forEach((m) => (profParMatiere[m] = user.id));
  }

  // 4. Classes
  const classe1 = await prisma.classe.create({
    data: { nom: '5ème Année A', niveau: '5ème Primaire', capaciteMax: 25, anneeScolaire: ANNEE, schoolId: ecole.id }
  });
  const classe2 = await prisma.classe.create({
    data: { nom: '6ème Année B', niveau: '6ème Primaire', capaciteMax: 25, anneeScolaire: ANNEE, schoolId: ecole.id }
  });

  // 5. Emplois du temps
  const creerEmploi = async (classe, programme, salle) => {
    const data = [];
    for (const [jour, matieres] of Object.entries(programme)) {
      matieres.forEach((matiere, i) => {
        data.push({
          jour,
          heureDebut: CRENEAUX[i][0],
          heureFin: CRENEAUX[i][1],
          matiere,
          salle,
          anneeScolaire: ANNEE,
          classeId: classe.id,
          enseignantId: profParMatiere[matiere],
          schoolId: ecole.id
        });
      });
    }
    await prisma.seance.createMany({ data });
  };
  await creerEmploi(classe1, PROGRAMME_1, 'Salle 1');
  await creerEmploi(classe2, PROGRAMME_2, 'Salle 2');

  // 6. Élèves + parents + comptes élèves
  const modes = ['Espèces', 'Virement', 'Mobile money'];
  const elevesData = [
    { nom: 'Khemiri', prenom: 'Youssef', matricule: 'HC-2026-001', classeId: classe1.id, parentNom: 'Khemiri', parentPrenom: 'Mohamed', parentEmail: 'parent.khemiri@hedichaker.edu.tn', base: 15, paiement: 'PAYE', absences: 1 },
    { nom: 'Dridi', prenom: 'Yasmine', matricule: 'HC-2026-002', classeId: classe1.id, parentNom: 'Dridi', parentPrenom: 'Sami', parentEmail: 'parent.dridi@hedichaker.edu.tn', base: 17, paiement: 'PAYE', absences: 0 },
    { nom: 'Gharbi', prenom: 'Aymen', matricule: 'HC-2026-003', classeId: classe1.id, parentNom: 'Gharbi', parentPrenom: 'Nabil', parentEmail: 'parent.gharbi@hedichaker.edu.tn', base: 8, paiement: 'IMPAYE', absences: 7 },
    { nom: 'Trabelsi', prenom: 'Chaima', matricule: 'HC-2026-004', classeId: classe1.id, parentNom: 'Trabelsi', parentPrenom: 'Mongi', parentEmail: 'parent.trabelsi@hedichaker.edu.tn', base: 13, paiement: 'PARTIEL', absences: 2 },
    { nom: 'Mejri', prenom: 'Amine', matricule: 'HC-2026-005', classeId: classe2.id, parentNom: 'Mejri', parentPrenom: 'Lotfi', parentEmail: 'parent.mejri@hedichaker.edu.tn', base: 12, paiement: 'PAYE', absences: 3 },
    { nom: 'Ayari', prenom: 'Malek', matricule: 'HC-2026-006', classeId: classe2.id, parentNom: 'Ayari', parentPrenom: 'Radhouane', parentEmail: 'parent.ayari@hedichaker.edu.tn', base: 7, paiement: 'PARTIEL', absences: 8 },
    { nom: 'Bouazizi', prenom: 'Hamza', matricule: 'HC-2026-007', classeId: classe2.id, parentNom: 'Bouazizi', parentPrenom: 'Ridha', parentEmail: 'parent.bouazizi@hedichaker.edu.tn', base: 14, paiement: 'PAYE', absences: 1 },
    { nom: 'Ben Amor', prenom: 'Nour', matricule: 'HC-2026-008', classeId: classe2.id, parentNom: 'Ben Amor', parentPrenom: 'Kamel', parentEmail: 'parent.benamor@hedichaker.edu.tn', base: 16, paiement: 'IMPAYE', absences: 0 },
    { nom: 'Haddad', prenom: 'Sami', matricule: 'HC-2026-009', classeId: classe1.id, parentNom: 'Haddad', parentPrenom: 'Rania', parentEmail: 'parent.haddad@hedichaker.edu.tn', base: 11, paiement: 'PARTIEL', absences: 4 },
    { nom: 'Mansour', prenom: 'Lina', matricule: 'HC-2026-010', classeId: classe1.id, parentNom: 'Mansour', parentPrenom: 'Foued', parentEmail: 'parent.mansour@hedichaker.edu.tn', base: 14, paiement: 'PAYE', absences: 2 },
    { nom: 'Zouari', prenom: 'Rania', matricule: 'HC-2026-011', classeId: classe2.id, parentNom: 'Zouari', parentPrenom: 'Hatem', parentEmail: 'parent.zouari@hedichaker.edu.tn', base: 10, paiement: 'IMPAYE', absences: 5 },
    { nom: 'Fakhfakh', prenom: 'Omar', matricule: 'HC-2026-012', classeId: classe2.id, parentNom: 'Fakhfakh', parentPrenom: 'Sana', parentEmail: 'parent.fakhfakh@hedichaker.edu.tn', base: 9, paiement: 'PARTIEL', absences: 6 },
    { nom: 'Ben Youssef', prenom: 'Salma', matricule: 'HC-2026-013', classeId: classe1.id, parentNom: 'Ben Youssef', parentPrenom: 'Hichem', parentEmail: 'parent.benyoussef@hedichaker.edu.tn', base: 15, paiement: 'PAYE', absences: 1 },
    { nom: 'Khaldi', prenom: 'Rami', matricule: 'HC-2026-014', classeId: classe1.id, parentNom: 'Khaldi', parentPrenom: 'Sana', parentEmail: 'parent.khaldi@hedichaker.edu.tn', base: 12, paiement: 'IMPAYE', absences: 3 },
    { nom: 'Ben Salah', prenom: 'Youssef', matricule: 'HC-2026-015', classeId: classe2.id, parentNom: 'Ben Salah', parentPrenom: 'Leila', parentEmail: 'parent.bensalah@hedichaker.edu.tn', base: 14, paiement: 'PAYE', absences: 2 },
    { nom: 'Hammami', prenom: 'Amira', matricule: 'HC-2026-016', classeId: classe2.id, parentNom: 'Hammami', parentPrenom: 'Sami', parentEmail: 'parent.hammami@hedichaker.edu.tn', base: 13, paiement: 'PARTIEL', absences: 4 },
    { nom: 'Jaziri', prenom: 'Karim', matricule: 'HC-2026-017', classeId: classe1.id, parentNom: 'Jaziri', parentPrenom: 'Nadia', parentEmail: 'parent.jaziri@hedichaker.edu.tn', base: 11, paiement: 'PARTIEL', absences: 4 },
    { nom: 'Ben Romdhane', prenom: 'Sami', matricule: 'HC-2026-018', classeId: classe1.id, parentNom: 'Ben Romdhane', parentPrenom: 'Rania', parentEmail: 'parent.benromdhane@hedichaker.edu.tn', base: 12, paiement: 'PAYE', absences: 2 },
    { nom: 'Bouazizi', prenom: 'Anis', matricule: 'HC-2026-030', classeId: classe1.id, parentNom: 'Bouazizi', parentPrenom: 'Mongi', parentEmail: 'parent.bouazizi@hedichaker.edu.tn', base: 14, paiement: 'PAYE', absences: 1 },
    { nom: 'Sassi', prenom: 'Wafa', matricule: 'HC-2026-031', classeId: classe2.id, parentNom: 'Sassi', parentPrenom: 'Hatem', parentEmail: 'parent.sassi@hedichaker.edu.tn', base: 11, paiement: 'IMPAYE', absences: 4 },
    { nom: 'Mejbri', prenom: 'Bilel', matricule: 'HC-2026-032', classeId: classe2.id, parentNom: 'Mejbri', parentPrenom: 'Ridha', parentEmail: 'parent.mejbri@hedichaker.edu.tn', base: 9, paiement: 'PARTIEL', absences: 5 },
    { nom: 'Chebbi', prenom: 'Emna', matricule: 'HC-2026-033', classeId: classe1.id, parentNom: 'Chebbi', parentPrenom: 'Moncef', parentEmail: 'parent.chebbi@hedichaker.edu.tn', base: 16, paiement: 'PAYE', absences: 0 },
    { nom: 'Dridi', prenom: 'Mourad', matricule: 'HC-2026-034', classeId: classe1.id, parentNom: 'Dridi', parentPrenom: 'Lotfi', parentEmail: 'parent.dridi@hedichaker.edu.tn', base: 12, paiement: 'IMPAYE', absences: 3 },
    { nom: 'Gharsalli', prenom: 'Chiraz', matricule: 'HC-2026-035', classeId: classe2.id, parentNom: 'Gharsalli', parentPrenom: 'Tarek', parentEmail: 'parent.gharsalli@hedichaker.edu.tn', base: 13, paiement: 'PAYE', absences: 2 },
    { nom: 'Riahi', prenom: 'Wissem', matricule: 'HC-2026-036', classeId: classe2.id, parentNom: 'Riahi', parentPrenom: 'Kamel', parentEmail: 'parent.riahi@hedichaker.edu.tn', base: 10, paiement: 'PARTIEL', absences: 4 },
    { nom: 'Touati', prenom: 'Chaima', matricule: 'HC-2026-037', classeId: classe1.id, parentNom: 'Touati', parentPrenom: 'Nabil', parentEmail: 'parent.touati@hedichaker.edu.tn', base: 15, paiement: 'PAYE', absences: 1 },
    { nom: 'Khelifi', prenom: 'Mahdi', matricule: 'HC-2026-038', classeId: classe1.id, parentNom: 'Khelifi', parentPrenom: 'Adel', parentEmail: 'parent.khelifi@hedichaker.edu.tn', base: 11, paiement: 'IMPAYE', absences: 6 },
    { nom: 'Mabrouk', prenom: 'Sondes', matricule: 'HC-2026-039', classeId: classe2.id, parentNom: 'Mabrouk', parentPrenom: 'Bechir', parentEmail: 'parent.mabrouk@hedichaker.edu.tn', base: 14, paiement: 'PAYE', absences: 2 },
    { nom: 'Nasri', prenom: 'Zied', matricule: 'HC-2026-040', classeId: classe1.id, parentNom: 'Nasri', parentPrenom: 'Zouhair', parentEmail: 'parent.nasri@hedichaker.edu.tn', base: 13, paiement: 'PARTIEL', absences: 3 },
    { nom: 'Ayari', prenom: 'Rim', matricule: 'HC-2026-041', classeId: classe2.id, parentNom: 'Ayari', parentPrenom: 'Foued', parentEmail: 'parent.ayari@hedichaker.edu.tn', base: 8, paiement: 'IMPAYE', absences: 7 },
    { nom: 'Jerbi', prenom: 'Mondher', matricule: 'HC-2026-042', classeId: classe1.id, parentNom: 'Jerbi', parentPrenom: 'Sami', parentEmail: 'parent.jerbi@hedichaker.edu.tn', base: 17, paiement: 'PAYE', absences: 0 },
    { nom: 'Lamine', prenom: 'Houda', matricule: 'HC-2026-043', classeId: classe2.id, parentNom: 'Lamine', parentPrenom: 'Hichem', parentEmail: 'parent.lamine@hedichaker.edu.tn', base: 12, paiement: 'PARTIEL', absences: 3 },
    { nom: 'Ben Ammar', prenom: 'Farouk', matricule: 'HC-2026-044', classeId: classe1.id, parentNom: 'Ben Ammar', parentPrenom: 'Karim', parentEmail: 'parent.benammar@hedichaker.edu.tn', base: 15, paiement: 'PAYE', absences: 1 },
    { nom: 'Ferjani', prenom: 'Najla', matricule: 'HC-2026-045', classeId: classe2.id, parentNom: 'Ferjani', parentPrenom: 'Anouar', parentEmail: 'parent.ferjani@hedichaker.edu.tn', base: 9, paiement: 'IMPAYE', absences: 5 },
    { nom: 'Oueslati', prenom: 'Hatem', matricule: 'HC-2026-046', classeId: classe1.id, parentNom: 'Oueslati', parentPrenom: 'Sofiene', parentEmail: 'parent.oueslati@hedichaker.edu.tn', base: 14, paiement: 'PAYE', absences: 2 },
    { nom: 'Gharbi', prenom: 'Olfa', matricule: 'HC-2026-047', classeId: classe2.id, parentNom: 'Gharbi', parentPrenom: 'Mourad', parentEmail: 'parent.gharbi.o@hedichaker.edu.tn', base: 11, paiement: 'PARTIEL', absences: 4 },
    { nom: 'Marzouki', prenom: 'Bechir', matricule: 'HC-2026-048', classeId: classe1.id, parentNom: 'Marzouki', parentPrenom: 'Faouzi', parentEmail: 'parent.marzouki@hedichaker.edu.tn', base: 16, paiement: 'PAYE', absences: 0 },
    { nom: 'Jebali', prenom: 'Nesrine', matricule: 'HC-2026-049', classeId: classe2.id, parentNom: 'Jebali', parentPrenom: 'Walid', parentEmail: 'parent.jebali@hedichaker.edu.tn', base: 10, paiement: 'IMPAYE', absences: 6 }
  ];

  let n = 0;
  const parentsParEmail = new Map();
  for (const item of elevesData) {
    n++;
    let parent = parentsParEmail.get(item.parentEmail);
    if (!parent) {
      parent = await prisma.user.create({
        data: {
          email: item.parentEmail,
          password: passwordHash,
          nom: item.parentNom,
          prenom: item.parentPrenom,
          role: 'PARENT',
          schoolId: ecole.id
        }
      });
      parentsParEmail.set(item.parentEmail, parent);
    }

    const compteEleve = await prisma.user.create({
      data: {
        email: `eleve.${slug(item.nom)}.${String(n).padStart(3, '0')}@hedichaker.edu.tn`,
        password: passwordHash,
        nom: item.nom,
        prenom: item.prenom,
        role: 'ELEVE',
        schoolId: ecole.id
      }
    });

    const eleve = await prisma.eleve.create({
      data: {
        matricule: item.matricule,
        nom: item.nom,
        prenom: item.prenom,
        anneeScolaire: ANNEE,
        schoolId: ecole.id,
        classeId: item.classeId,
        parentId: parent.id,
        userId: compteEleve.id
      }
    });

    await prisma.note.createMany({
      data: ['Mathématiques', 'Sciences', 'Arabe', 'Français', 'Informatique', 'Histoire-Géographie', 'Arts plastiques'].map((matiere) => ({
        matiere,
        valeur: noteAutour(item.base),
        coefficient: 2,
        anneeScolaire: ANNEE,
        eleveId: eleve.id
      }))
    });

    const montantPaye = item.paiement === 'PAYE' ? 1200 : item.paiement === 'PARTIEL' ? 600 : 0;
    await prisma.paiement.create({
      data: {
        montantTotal: 1200,
        montantPaye,
        statut: item.paiement,
        modePaiement: montantPaye > 0 ? modes[n % 3] : null,
        datePaiement: montantPaye > 0 ? new Date(2026, 8, 5 + n) : null,
        anneeScolaire: ANNEE,
        schoolId: ecole.id,
        eleveId: eleve.id
      }
    });

    if (item.absences > 0) {
      const absencesData = [];
      for (let i = 0; i < item.absences; i++) {
        absencesData.push({
          date: new Date(2026, 9 + (i % 2), 3 + i * 2),
          justifiee: i % 3 === 0,
          anneeScolaire: ANNEE,
          eleveId: eleve.id,
          schoolId: ecole.id
        });
      }
      await prisma.absence.createMany({ data: absencesData });
    }
  }

  // 7. Annonces
  await prisma.annonce.createMany({
    data: [
      { titre: 'Rentrée scolaire 2026-2027', contenu: 'Bienvenue à tous les élèves. Les cours reprennent selon l\'emploi du temps affiché.', cible: 'TOUS', schoolId: ecole.id },
      { titre: 'Réunion parents-enseignants', contenu: 'Une réunion aura lieu le samedi 28 novembre à 10h dans la salle polyvalente.', cible: 'PARENTS', schoolId: ecole.id },
      { titre: 'Conseil de classe', contenu: 'Les enseignants sont priés de remettre les moyennes du premier trimestre avant le 15 décembre.', cible: 'ENSEIGNANTS', schoolId: ecole.id }
    ]
  });

  const ecolesDemo = [
    {
      code: 'tunis',
      nom: 'École Les Oliviers',
      adresse: 'Avenue de la Liberté, Tunis',
      administration: [
        { nom: 'Admin', prenom: 'Tunis', email: 'admin.tunis@ecoles-demo.tn', role: 'ADMIN_ECOLE' },
        { nom: 'Comptable', prenom: 'Tunis', email: 'comptable.tunis@ecoles-demo.tn', role: 'COMPTABLE' }
      ],
      directeur: { nom: 'Ben Salem', prenom: 'Mouna', email: 'directeur.tunis@ecoles-demo.tn' },
      enseignants: [
        { nom: 'Baccouche', prenom: 'Karim', email: 'prof.maths.tunis@ecoles-demo.tn', matiere: 'Mathématiques' },
        { nom: 'Jlassi', prenom: 'Ines', email: 'prof.francais.tunis@ecoles-demo.tn', matiere: 'Français' }
      ],
      classe: { nom: '6ème A', niveau: '6ème Primaire' },
      eleves: [
        { nom: 'Bouzid', prenom: 'Mariam', parentNom: 'Bouzid', parentPrenom: 'Sami', base: 15 },
        { nom: 'Khelifi', prenom: 'Adam', parentNom: 'Khelifi', parentPrenom: 'Nadia', base: 13 }
      ]
    },
    {
      code: 'sfax',
      nom: 'École El Amal',
      adresse: 'Route de Gremda, Sfax',
      directeur: { nom: 'Trabelsi', prenom: 'Hichem', email: 'directeur.sfax@ecoles-demo.tn' },
      enseignants: [
        { nom: 'Mabrouk', prenom: 'Fares', email: 'prof.maths.sfax@ecoles-demo.tn', matiere: 'Mathématiques' },
        { nom: 'Haddad', prenom: 'Salma', email: 'prof.arabe.sfax@ecoles-demo.tn', matiere: 'Arabe' }
      ],
      classe: { nom: '5ème B', niveau: '5ème Primaire' },
      eleves: [
        { nom: 'Riahi', prenom: 'Youssef', parentNom: 'Riahi', parentPrenom: 'Amine', base: 14 },
        { nom: 'Gharbi', prenom: 'Lina', parentNom: 'Gharbi', parentPrenom: 'Rim', base: 16 },
        { nom: 'Mansour', prenom: 'Elyes', parentNom: 'Mansour', parentPrenom: 'Walid', base: 11 }
      ]
    }
  ];

  for (const donneesEcole of ecolesDemo) {
    const ecoleDemo = await prisma.school.create({
      data: { nom: donneesEcole.nom, adresse: donneesEcole.adresse }
    });
    for (const compte of donneesEcole.administration || []) {
      await prisma.user.create({
        data: { ...compte, password: passwordHash, schoolId: ecoleDemo.id }
      });
    }
    await prisma.user.create({
      data: {
        ...donneesEcole.directeur,
        password: passwordHash,
        role: 'DIRECTEUR',
        schoolId: ecoleDemo.id
      }
    });
    const professeurs = [];
    for (const enseignant of donneesEcole.enseignants) {
      const { matiere, ...compte } = enseignant;
      const professeur = await prisma.user.create({
        data: { ...compte, password: passwordHash, role: 'ENSEIGNANT', schoolId: ecoleDemo.id }
      });
      professeurs.push({ matiere, userId: professeur.id });
    }

    const classeDemo = await prisma.classe.create({
      data: {
        ...donneesEcole.classe,
        capaciteMax: 30,
        anneeScolaire: ANNEE,
        schoolId: ecoleDemo.id
      }
    });
    await prisma.seance.createMany({
      data: professeurs.map((professeur, index) => ({
        jour: 'Lundi',
        heureDebut: index === 0 ? '08:00' : '09:00',
        heureFin: index === 0 ? '09:00' : '10:00',
        matiere: professeur.matiere,
        salle: `Salle ${index + 1}`,
        anneeScolaire: ANNEE,
        classeId: classeDemo.id,
        enseignantId: professeur.userId,
        schoolId: ecoleDemo.id
      }))
    });

    for (let index = 0; index < donneesEcole.eleves.length; index++) {
      const donneesEleve = donneesEcole.eleves[index];
      const suffixe = `${donneesEcole.code}.${index + 1}`;
      const parent = await prisma.user.create({
        data: {
          email: `parent.${suffixe}@ecoles-demo.tn`,
          password: passwordHash,
          nom: donneesEleve.parentNom,
          prenom: donneesEleve.parentPrenom,
          role: 'PARENT',
          schoolId: ecoleDemo.id
        }
      });
      const compteEleve = await prisma.user.create({
        data: {
          email: `eleve.${suffixe}@ecoles-demo.tn`,
          password: passwordHash,
          nom: donneesEleve.nom,
          prenom: donneesEleve.prenom,
          role: 'ELEVE',
          schoolId: ecoleDemo.id
        }
      });
      const eleve = await prisma.eleve.create({
        data: {
          matricule: `${donneesEcole.code.toUpperCase()}-2026-${String(index + 1).padStart(3, '0')}`,
          nom: donneesEleve.nom,
          prenom: donneesEleve.prenom,
          anneeScolaire: ANNEE,
          schoolId: ecoleDemo.id,
          classeId: classeDemo.id,
          parentId: parent.id,
          userId: compteEleve.id
        }
      });
      await prisma.note.createMany({
        data: professeurs.map((professeur, noteIndex) => ({
          matiere: professeur.matiere,
          valeur: noteAutour(donneesEleve.base - noteIndex),
          coefficient: 2,
          anneeScolaire: ANNEE,
          eleveId: eleve.id
        }))
      });
      await prisma.paiement.create({
        data: {
          montantTotal: 1200,
          montantPaye: 600,
          statut: 'PARTIEL',
          modePaiement: 'Virement',
          datePaiement: new Date(2026, 8, 15 + index),
          anneeScolaire: ANNEE,
          schoolId: ecoleDemo.id,
          eleveId: eleve.id
        }
      });
    }
  }

  console.log('Base peuplée avec succès !');
  console.log('Établissements de démonstration : Hédi Chaker, Les Oliviers (Tunis), El Amal (Sfax).');
  console.log('Comptes de démo (mot de passe : Demo2026!) :');
  console.log(' - superadmin@hedichaker.edu.tn (SUPER_ADMIN)');
  console.log(' - admin@hedichaker.edu.tn (ADMIN_ECOLE)');
  console.log(' - directeur@hedichaker.edu.tn (DIRECTEUR)');
  console.log(' - comptable@hedichaker.edu.tn (COMPTABLE)');
  console.log(' - prof.jaziri@hedichaker.edu.tn (ENSEIGNANT)');
  console.log(' - directeur.tunis@ecoles-demo.tn (DIRECTEUR, École Les Oliviers)');
  console.log(' - admin.tunis@ecoles-demo.tn (ADMIN_ECOLE, École Les Oliviers)');
  console.log(' - comptable.tunis@ecoles-demo.tn (COMPTABLE, École Les Oliviers)');
  console.log(' - prof.maths.tunis@ecoles-demo.tn (ENSEIGNANT, École Les Oliviers)');
  console.log(' - directeur.sfax@ecoles-demo.tn (DIRECTEUR, École El Amal)');
  console.log(' - prof.maths.sfax@ecoles-demo.tn (ENSEIGNANT, École El Amal)');
  console.log(' - parent.tunis.1@ecoles-demo.tn (PARENT, École Les Oliviers)');
  console.log(' - eleve.tunis.1@ecoles-demo.tn (ELEVE, École Les Oliviers)');
  console.log(' - parent.sfax.1@ecoles-demo.tn (PARENT, École El Amal)');
  console.log(' - eleve.sfax.1@ecoles-demo.tn (ELEVE, École El Amal)');
  console.log(' - parent.khemiri@hedichaker.edu.tn (PARENT)');
  console.log(' - eleve.khemiri.001@hedichaker.edu.tn (ELEVE)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });