require('dotenv/config');

const bcrypt = require('bcryptjs');
const { supabaseAdmin, execute, fetchAll } = require('./src/supabaseAdmin');

const ANNEE_SCOLAIRE = process.env.ANNEE_SCOLAIRE || '2026-2027';
const MOT_DE_PASSE = 'Demo2026!';
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const CRENEAUX = [
  ['08:00', '09:00'],
  ['09:00', '10:00'],
  ['10:15', '11:15'],
  ['11:15', '12:15']
];

const ECOLES = [
  {
    nom: 'Collège Hédi Chaker',
    domaine: 'hedichaker',
    directeur: { prenom: 'Sonia', nom: 'Mansouri' },
    comptable: { prenom: 'Walid', nom: 'Hamdi' },
    enseignants: [
      { prenom: 'Karim', nom: 'Jaziri', matiere: 'Mathématiques' },
      { prenom: 'Leila', nom: 'Ben Salah', matiere: 'Français' },
      { prenom: 'Mehdi', nom: 'Kacem', matiere: 'Sciences' },
      { prenom: 'Amira', nom: 'Trabelsi', matiere: 'Arabe' },
      { prenom: 'Fares', nom: 'Mabrouk', matiere: 'Anglais' }
    ],
    classes: [
      ['7ème B1', '7ème année de base'],
      ['8ème B2', '8ème année de base'],
      ['9ème B1', '9ème année de base'],
      ['9ème B2', '9ème année de base']
    ],
    eleves: [
      ['Youssef', 'Khemiri'], ['Yasmine', 'Dridi'], ['Aymen', 'Gharbi'], ['Chaima', 'Trabelsi'],
      ['Amine', 'Mejri'], ['Nour', 'Ayari'], ['Sami', 'Bouazizi'], ['Lina', 'Ben Amor'],
      ['Rania', 'Haddad'], ['Omar', 'Mansour'], ['Salma', 'Zouari'], ['Rami', 'Fakhfakh'],
      ['Amira', 'Ben Youssef'], ['Rim', 'Khaldi'], ['Karim', 'Ben Salah'], ['Mariam', 'Hammami']
    ]
  },
  {
    nom: 'Lycée Pilote de Sousse',
    domaine: 'pilotesousse',
    directeur: { prenom: 'Mouna', nom: 'Baccouche' },
    comptable: { prenom: 'Nabil', nom: 'Saidi' },
    enseignants: [
      { prenom: 'Sami', nom: 'Gharbi', matiere: 'Mathématiques' },
      { prenom: 'Ines', nom: 'Dridi', matiere: 'Français' },
      { prenom: 'Nabil', nom: 'Kefi', matiere: 'Sciences' },
      { prenom: 'Salma', nom: 'Ayari', matiere: 'Arabe' },
      { prenom: 'Rami', nom: 'Mansour', matiere: 'Anglais' }
    ],
    classes: [
      ['1ère Sciences', '1ère année secondaire'],
      ['2ème Mathématiques', '2ème année secondaire'],
      ['Bac Sciences', '4ème année secondaire'],
      ['Bac Informatique', '4ème année secondaire']
    ],
    eleves: [
      ['Fares', 'Jlassi'], ['Sana', 'Bouzid'], ['Malek', 'Hajri'], ['Rim', 'Masmoudi'],
      ['Anis', 'Karray'], ['Hela', 'Chaabane'], ['Tarek', 'Sassi'], ['Nour', 'Ben Salem'],
      ['Meriem', 'Brahmi'], ['Bilel', 'Hammami'], ['Amina', 'Khlifi'], ['Seif', 'Jebali'],
      ['Dorra', 'Maatoug'], ['Yassine', 'Kooli'], ['Farah', 'Chouchane'], ['Wael', 'Miled'],
      ['Fedi', 'Mannai', 'Bac Sciences']
    ]
  },
  {
    nom: 'Collège Ibn Khaldoun',
    domaine: 'ibnkhaldoun',
    directeur: { prenom: 'Hichem', nom: 'Trabelsi' },
    comptable: { prenom: 'Amel', nom: 'Mabrouk' },
    enseignants: [
      { prenom: 'Mariem', nom: 'Haddad', matiere: 'Mathématiques' },
      { prenom: 'Walid', nom: 'Saidi', matiere: 'Français' },
      { prenom: 'Sana', nom: 'Bouazizi', matiere: 'Sciences' },
      { prenom: 'Anis', nom: 'Mejri', matiere: 'Arabe' },
      { prenom: 'Hela', nom: 'Riahi', matiere: 'Anglais' }
    ],
    classes: [
      ['7ème A', '7ème année de base'],
      ['8ème B', '8ème année de base'],
      ['9ème A', '9ème année de base'],
      ['9ème B', '9ème année de base']
    ],
    eleves: [
      ['Adem', 'Mansouri'], ['Rania', 'Khemiri'], ['Mehdi', 'Brahmi'], ['Ines', 'Jaziri'],
      ['Oussama', 'Khaldi'], ['Maha', 'Touati'], ['Fedi', 'Guesmi'], ['Rim', 'Mabrouk'],
      ['Yara', 'Karray'], ['Sofiene', 'Miled'], ['Nesrine', 'Jebali'], ['Bassem', 'Kooli'],
      ['Lamia', 'Baccouche'], ['Taha', 'Hajri'], ['Sirine', 'Sassi'], ['Zied', 'Chaabane']
    ]
  },
  {
    nom: 'Institut Privé El Manar',
    domaine: 'elmanar',
    directeur: { prenom: 'Meriem', nom: 'Jlassi' },
    comptable: { prenom: 'Adel', nom: 'Touati' },
    enseignants: [
      { prenom: 'Omar', nom: 'Khemiri', matiere: 'Mathématiques' },
      { prenom: 'Rim', nom: 'Jlassi', matiere: 'Français' },
      { prenom: 'Adel', nom: 'Touati', matiere: 'Sciences' },
      { prenom: 'Mariem', nom: 'Chebbi', matiere: 'Arabe' },
      { prenom: 'Nader', nom: 'Zouari', matiere: 'Anglais' }
    ],
    classes: [
      ['7ème A', '7ème année de base'],
      ['8ème A', '8ème année de base'],
      ['9ème B', '9ème année de base'],
      ['Bac Informatique', '4ème année secondaire']
    ],
    eleves: [
      ['Alaa', 'Gharbi'], ['Syrine', 'Dridi'], ['Fares', 'Ayari'], ['Rym', 'Ben Amor'],
      ['Yassine', 'Haddad'], ['Marwa', 'Mansour'], ['Hamza', 'Fakhfakh'], ['Nour', 'Khaldi'],
      ['Sami', 'Hammami'], ['Lina', 'Baccouche'], ['Aymen', 'Kefi'], ['Chaima', 'Masmoudi'],
      ['Amine', 'Karray'], ['Salma', 'Brahmi'], ['Rami', 'Jebali'], ['Yasmine', 'Maatoug']
    ]
  }
];

const PRENOMS_DEMO = [
  'Adem', 'Alaa', 'Amine', 'Amira', 'Anis', 'Aymen', 'Bassem', 'Chaima', 'Dorra', 'Fares',
  'Farah', 'Hela', 'Hamza', 'Ines', 'Lamia', 'Lina', 'Malek', 'Maha', 'Mariam', 'Marwa',
  'Mehdi', 'Meriem', 'Nour', 'Omar', 'Rania', 'Rim', 'Rym', 'Salma', 'Sami', 'Sana',
  'Seif', 'Sirine', 'Syrine', 'Taha', 'Tarek', 'Wael', 'Yara', 'Yasmine', 'Yassine', 'Youssef'
];
const NOMS_DEMO = [
  'Ayari', 'Baccouche', 'Ben Amor', 'Ben Salah', 'Bouzid', 'Brahmi', 'Chaabane', 'Chebbi',
  'Dridi', 'Fakhfakh', 'Gharbi', 'Haddad', 'Hajri', 'Hammami', 'Jaziri', 'Jebali', 'Karray',
  'Kefi', 'Khaldi', 'Khemiri', 'Kooli', 'Mabrouk', 'Mansour', 'Mansouri', 'Masmoudi',
  'Maatoug', 'Mejri', 'Miled', 'Saidi', 'Sassi', 'Touati', 'Trabelsi', 'Zouari', 'Ben Youssef',
  'Ben Salem', 'Bouazizi', 'Jlassi', 'Kacem', 'Riahi', 'Salah'
];
const MATIERES_DEMO = ['Mathématiques', 'Français', 'Sciences', 'Arabe', 'Anglais'];
const MODES_PAIEMENT = ['Espèces', 'Virement', 'Chèque', 'Carte'];
const COLONNES_OPTIONNELLES = {
  Note: ['date', 'typeEvaluation'],
  Absence: ['matiere', 'motif']
};

const slug = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

function lotsDe(lignes, taille = 250) {
  const lots = [];
  for (let index = 0; index < lignes.length; index += taille) {
    lots.push(lignes.slice(index, index + taille));
  }
  return lots;
}

async function colonneDisponible(table, colonne) {
  try {
    await execute(
      supabaseAdmin.from(table).select(colonne).limit(0),
      `Vérification de la colonne ${table}.${colonne}`
    );
    return true;
  } catch (error) {
    if (error.code === 'PGRST204' || error.code === '42703') return false;
    throw error;
  }
}

async function inspecterColonnesOptionnelles() {
  const resultats = await Promise.all(
    Object.entries(COLONNES_OPTIONNELLES).flatMap(([table, colonnes]) => colonnes.map(async (colonne) => ({
      cle: `${table}.${colonne}`,
      disponible: await colonneDisponible(table, colonne)
    })))
  );
  return Object.fromEntries(resultats.map(({ cle, disponible }) => [cle, disponible]));
}

function configurationPourEcole(school, index, domainesUtilises) {
  const modele = ECOLES.find((ecole) => ecole.nom === school.nom);
  const domaineBase = modele?.domaine || slug(school.nom) || `ecole${school.id}`;
  let domaine = domaineBase;
  let suffixeDomaine = 1;
  while (domainesUtilises.has(domaine)) {
    domaine = `${domaineBase}${school.id}${suffixeDomaine === 1 ? '' : suffixeDomaine}`;
    suffixeDomaine += 1;
  }
  domainesUtilises.add(domaine);

  if (modele) {
    return {
      ...modele,
      directeur: { ...modele.directeur },
      comptable: { ...modele.comptable },
      enseignants: modele.enseignants.map((enseignant) => ({ ...enseignant })),
      classes: modele.classes.map((classe) => [...classe]),
      eleves: modele.eleves.map((eleve) => [...eleve]),
      domaine
    };
  }

  const nomNormalise = slug(school.nom);
  const directeur = {
    prenom: PRENOMS_DEMO[index % PRENOMS_DEMO.length],
    nom: NOMS_DEMO[(index * 3) % NOMS_DEMO.length]
  };
  const comptable = {
    prenom: PRENOMS_DEMO[(index + 7) % PRENOMS_DEMO.length],
    nom: NOMS_DEMO[(index * 5 + 9) % NOMS_DEMO.length]
  };

  return {
    nom: school.nom,
    domaine,
    directeur,
    comptable,
    enseignants: MATIERES_DEMO.map((matiere, matiereIndex) => ({
      prenom: PRENOMS_DEMO[(index * 5 + matiereIndex * 7) % PRENOMS_DEMO.length],
      nom: NOMS_DEMO[(index * 11 + matiereIndex * 3) % NOMS_DEMO.length],
      matiere
    })),
    classes: [],
    eleves: []
  };
}

function emailEleve({ prenom, nom }) {
  return `etu.${slug(prenom)}.${slug(nom)}@edu.tn`;
}

function classesPourEcole(configuration, nombre) {
  const definitions = configuration.classes.map((classe) => [...classe]);
  const nomsExistants = new Set(definitions.map(([nom]) => nom));
  const nomNormalise = slug(configuration.nom);
  const classesCollege = [
    ['7ème A', '7ème année de base'], ['7ème B', '7ème année de base'],
    ['8ème A', '8ème année de base'], ['8ème B', '8ème année de base'],
    ['9ème A', '9ème année de base'], ['9ème B', '9ème année de base'],
    ['9ème C', '9ème année de base']
  ];
  const classesLycee = [
    ['1ère Lettres', '1ère année secondaire'], ['2ème Sciences', '2ème année secondaire'],
    ['3ème Sciences', '3ème année secondaire'], ['Bac Économie', '4ème année secondaire'],
    ['Bac Lettres', '4ème année secondaire'], ['Bac Sciences', '4ème année secondaire'],
    ['Bac Informatique', '4ème année secondaire']
  ];
  const classesGeneriques = [
    ['Niveau 1 - Groupe A', 'Niveau 1'], ['Niveau 1 - Groupe B', 'Niveau 1'],
    ['Niveau 2 - Groupe A', 'Niveau 2'], ['Niveau 2 - Groupe B', 'Niveau 2'],
    ['Niveau 3 - Groupe A', 'Niveau 3'], ['Niveau 3 - Groupe B', 'Niveau 3'],
    ['Niveau 4 - Groupe A', 'Niveau 4']
  ];
  const pool = nomNormalise.includes('college')
    ? classesCollege
    : nomNormalise.includes('lycee') || nomNormalise.includes('institut')
      ? classesLycee
      : classesGeneriques;

  for (const classe of pool) {
    if (definitions.length >= nombre) break;
    if (!nomsExistants.has(classe[0])) {
      definitions.push(classe);
      nomsExistants.add(classe[0]);
    }
  }
  while (definitions.length < nombre) {
    const numero = definitions.length + 1;
    const nom = `Groupe ${numero}`;
    definitions.push([nom, `Niveau ${numero}`]);
  }
  return definitions.slice(0, nombre);
}

function nomsElevesPourEcole(configuration, nombre, schoolId) {
  const eleves = configuration.eleves.map(([prenom, nom, classeNom]) => ({ prenom, nom, classeNom }));
  const nomsDejaUtilises = new Set(eleves.map(({ prenom, nom }) => `${slug(prenom)}|${slug(nom)}`));
  let curseur = 0;

  while (eleves.length < nombre) {
    const combinaison = (schoolId * 31 + curseur) % (PRENOMS_DEMO.length * NOMS_DEMO.length);
    curseur += 1;
    const prenom = PRENOMS_DEMO[combinaison % PRENOMS_DEMO.length];
    const nom = NOMS_DEMO[Math.floor(combinaison / PRENOMS_DEMO.length)];
    const cle = `${slug(prenom)}|${slug(nom)}`;
    if (nomsDejaUtilises.has(cle)) continue;
    nomsDejaUtilises.add(cle);
    eleves.push({ prenom, nom, classeNom: null });
  }
  return eleves.slice(0, nombre);
}

function cibleEffectif(indexEcole) {
  return 120 + ((indexEcole * 13 + 6) % 61);
}

function construirePlansEcoles(ecoles, elevesExistants, utilisateursExistants) {
  const domainesUtilises = new Set();
  const utilisateursParId = new Map(utilisateursExistants.map((utilisateur) => [utilisateur.id, utilisateur]));

  return ecoles.map((school, index) => {
    const configuration = configurationPourEcole(school, index, domainesUtilises);
    const effectifCible = cibleEffectif(index);
    const elevesEcole = elevesExistants.filter((eleve) => eleve.schoolId === school.id);
    const prefixeMatricule = `${slug(configuration.domaine).toUpperCase()}-DEMO-`;
    const elevesHorsDemo = elevesEcole.filter((eleve) => !eleve.matricule.startsWith(prefixeMatricule)).length;
    const elevesDemoExistants = elevesEcole.length - elevesHorsDemo;
    const nombreElevesDemo = Math.max(configuration.eleves.length, effectifCible - elevesHorsDemo);
    const effectifPrevu = elevesHorsDemo + Math.max(nombreElevesDemo, elevesDemoExistants);
    if (effectifPrevu > 180) {
      throw new Error(
        `${school.nom} compte déjà ${elevesEcole.length} élèves ; le seed ne supprimera aucun élève pour forcer une cible maximale de 180.`
      );
    }
    const nombreClasses = Math.max(5, Math.min(7, Math.ceil(effectifPrevu / 26)));
    const classes = classesPourEcole(configuration, nombreClasses);
    const noms = nomsElevesPourEcole(configuration, nombreElevesDemo, school.id);
    const elevesDemo = noms.map((eleve, eleveIndex) => ({
      ...eleve,
      matricule: `${prefixeMatricule}${String(eleveIndex + 1).padStart(3, '0')}`,
      classeNom: eleve.classeNom || classes[eleveIndex % classes.length][0]
    }));
    const classesId = new Set();

    return {
      school,
      configuration,
      index,
      effectifCible,
      effectifPrevu,
      classes,
      elevesDemo,
      elevesExistants: elevesEcole,
      classesId,
      roster: [],
      comptes: []
    };
  }).map((plan) => {
    plan.utilisateursParId = utilisateursParId;
    return plan;
  });
}

function construireComptesEcole(plans, utilisateursExistants, elevesExistants) {
  const utilisateursParEmail = new Map(
    utilisateursExistants.map((utilisateur) => [utilisateur.email.toLowerCase(), utilisateur])
  );
  const emailsUtilises = new Set();
  const comptes = [];

  const ajouterCompte = (compte, plan, estEleve = false) => {
    const emailNormalise = compte.email.toLowerCase();
    const compteExistant = utilisateursParEmail.get(emailNormalise);
    if (!estEleve && compteExistant
      && (compteExistant.role !== compte.role || compteExistant.schoolId !== plan.school.id)) {
      throw new Error(`L'adresse ${compte.email} est déjà utilisée par un autre compte ou établissement.`);
    }
    if (emailsUtilises.has(emailNormalise)) {
      throw new Error(`L'adresse de démonstration ${compte.email} est attribuée plusieurs fois.`);
    }
    emailsUtilises.add(emailNormalise);
    const ligne = { ...compte, schoolId: plan.school.id };
    comptes.push(ligne);
    if (estEleve) plan.comptes.push(ligne);
  };

  for (const plan of plans) {
    const configuration = plan.configuration;
    const comptesEcole = [
      {
        email: `directeur@${configuration.domaine}.edu.tn`,
        ...configuration.directeur,
        role: 'DIRECTEUR'
      },
      {
        email: `comptable@${configuration.domaine}.edu.tn`,
        ...configuration.comptable,
        role: 'COMPTABLE'
      },
      ...configuration.enseignants.map((enseignant) => ({
        email: `prof.${slug(enseignant.nom)}@${configuration.domaine}.edu.tn`,
        prenom: enseignant.prenom,
        nom: enseignant.nom,
        role: 'ENSEIGNANT'
      }))
    ];
    comptesEcole.forEach((compte) => ajouterCompte(compte, plan));
  }

  for (const plan of plans) {
    const classesParNom = new Map(plan.classes.map((classe) => [classe[0], classe]));
    const classesEcole = plan.classesDisponibles || [];
    const classesParNomId = new Map(classesEcole.map((classe) => [classe.nom, classe.id]));
    const elevesParMatricule = new Map(plan.elevesExistants.map((eleve) => [eleve.matricule, eleve]));
    const rosterParMatricule = new Map();
    const utilisateursValides = plan.utilisateursParId;

    const ajouterEleveRoster = (eleve, index) => {
      const existant = elevesParMatricule.get(eleve.matricule);
      const utilisateurLie = existant?.userId ? utilisateursValides.get(existant.userId) : null;
      const classeExistanteValide = existant && plan.classesId.has(existant.classeId);
      const classeNom = classesParNom.has(eleve.classeNom) ? eleve.classeNom : null;
      const classeId = classeNom
        ? classesParNomId.get(classeNom)
        : classeExistanteValide
          ? existant.classeId
          : classesEcole[index % classesEcole.length]?.id;
      const parent = existant?.parentId ? utilisateursValides.get(existant.parentId) : null;
      const parentId = parent?.role === 'PARENT' && parent.schoolId === plan.school.id
        ? parent.id
        : null;

      rosterParMatricule.set(eleve.matricule, {
        matricule: eleve.matricule,
        prenom: eleve.prenom || existant?.prenom,
        nom: eleve.nom || existant?.nom,
        schoolId: plan.school.id,
        classeId,
        parentId,
        userId: utilisateurLie?.role === 'ELEVE' && utilisateurLie.schoolId === plan.school.id
          ? utilisateurLie.id
          : null,
        emailExistant: utilisateurLie?.role === 'ELEVE' && utilisateurLie.schoolId === plan.school.id
          ? utilisateurLie.email
          : null,
        anneeScolaire: existant?.anneeScolaire || ANNEE_SCOLAIRE
      });
    };

    plan.elevesDemo.forEach(ajouterEleveRoster);
    plan.elevesExistants.forEach((eleve, index) => {
      if (!rosterParMatricule.has(eleve.matricule)) ajouterEleveRoster(eleve, index);
    });
    plan.roster = [...rosterParMatricule.values()];

    for (const eleve of plan.roster) {
      const base = emailEleve(eleve);
      let email = eleve.emailExistant;
      if (!email || emailsUtilises.has(email.toLowerCase())) {
        email = base;
        let suffixe = 2;
        while (
          utilisateursParEmail.has(email.toLowerCase())
          || emailsUtilises.has(email.toLowerCase())
        ) {
          email = base.replace('@edu.tn', `.${suffixe}@edu.tn`);
          suffixe += 1;
        }
      }
      ajouterCompte({
        email,
        prenom: eleve.prenom,
        nom: eleve.nom,
        role: 'ELEVE',
        matricule: eleve.matricule
      }, plan, true);
      eleve.email = email;
    }
  }

  return comptes;
}

async function insererParLots(table, lignes, taille, contexte) {
  const resultats = [];
  for (const lot of lotsDe(lignes, taille)) {
    resultats.push(...await execute(
      supabaseAdmin.from(table).insert(lot).select('*'),
      contexte
    ));
  }
  return resultats;
}

async function upsertComptes(comptes, passwordHash) {
  const utilisateurs = [];
  for (const lot of lotsDe(comptes, 200)) {
    const lignes = lot.map(({ matricule, ...compte }) => ({ ...compte, password: passwordHash }));
    utilisateurs.push(...await execute(
      supabaseAdmin.from('User').upsert(lignes, { onConflict: 'email' }).select('id,email,role,schoolId'),
      'Création ou mise à jour des comptes de démonstration'
    ));
  }
  return utilisateurs;
}

async function assurerClasses(plans, classesExistantes) {
  const parCle = new Map(classesExistantes.map((classe) => [`${classe.schoolId}|${classe.nom}`, classe]));
  const aInserer = [];
  for (const plan of plans) {
    for (const [nom, niveau] of plan.classes) {
      if (!parCle.has(`${plan.school.id}|${nom}`)) {
        aInserer.push({
          nom,
          niveau,
          capaciteMax: 30,
          anneeScolaire: ANNEE_SCOLAIRE,
          schoolId: plan.school.id
        });
      }
    }
  }
  const nouvellesClasses = await insererParLots(
    'Classe',
    aInserer,
    200,
    'Création des classes de démonstration'
  );
  const toutesLesClasses = [...classesExistantes, ...nouvellesClasses];

  for (const plan of plans) {
    plan.classesDisponibles = toutesLesClasses.filter((classe) => classe.schoolId === plan.school.id);
    plan.classesId = new Set(plan.classesDisponibles.map((classe) => classe.id));
  }
  return toutesLesClasses;
}

async function assurerEleves(plans, utilisateurs) {
  const utilisateursParEmail = new Map(utilisateurs.map((utilisateur) => [utilisateur.email.toLowerCase(), utilisateur]));
  const lignes = [];
  for (const plan of plans) {
    for (const eleve of plan.roster) {
      const utilisateur = utilisateursParEmail.get(eleve.email.toLowerCase());
      if (!utilisateur || utilisateur.role !== 'ELEVE' || utilisateur.schoolId !== plan.school.id) {
        throw new Error(`Compte élève incohérent pour ${eleve.email} à ${plan.school.nom}.`);
      }
      if (!eleve.classeId || !plan.classesId.has(eleve.classeId)) {
        throw new Error(`Classe manquante ou hors établissement pour ${eleve.prenom} ${eleve.nom} à ${plan.school.nom}.`);
      }
      lignes.push({
        matricule: eleve.matricule,
        nom: eleve.nom,
        prenom: eleve.prenom,
        anneeScolaire: eleve.anneeScolaire || ANNEE_SCOLAIRE,
        schoolId: plan.school.id,
        classeId: eleve.classeId,
        parentId: eleve.parentId,
        userId: utilisateur.id
      });
    }
  }

  const eleves = [];
  for (const lot of lotsDe(lignes, 200)) {
    eleves.push(...await execute(
      supabaseAdmin.from('Eleve').upsert(lot, { onConflict: 'matricule' })
        .select('id,matricule,nom,prenom,classeId,schoolId,parentId,userId'),
      'Création ou mise à jour des élèves de démonstration'
    ));
  }
  const elevesParId = new Map(eleves.map((eleve) => [eleve.id, eleve]));
  for (const plan of plans) {
    plan.eleves = eleves
      .filter((eleve) => eleve.schoolId === plan.school.id)
      .map((eleve) => ({ ...eleve }));
    plan.emailsEleves = plan.roster.map((eleve) => eleve.email);
  }
  return [...elevesParId.values()];
}

const EVALUATIONS_DEMO = [
  { matiere: 'Mathématiques', coefficient: 2, typeEvaluation: 'Devoir surveillé', date: '2026-10-15' },
  { matiere: 'Français', coefficient: 1, typeEvaluation: 'Expression écrite', date: '2026-10-22' },
  { matiere: 'Sciences', coefficient: 2, typeEvaluation: 'Travaux pratiques', date: '2026-11-05' },
  { matiere: 'Arabe', coefficient: 1, typeEvaluation: 'Devoir de synthèse', date: '2026-11-12' }
];

const jourIso = (value) => String(value || '').slice(0, 10);
const cleNoteSansMetadata = (note) => [
  note.eleveId,
  note.matiere,
  note.anneeScolaire
].join('|');
function cleNote(note, colonnes) {
  return [
    cleNoteSansMetadata(note),
    colonnes['Note.date'] ? jourIso(note.date) : '',
    colonnes['Note.typeEvaluation'] ? note.typeEvaluation : ''
  ].join('|');
}

const cleAbsenceSansMetadata = (absence) => [
  absence.eleveId,
  jourIso(absence.date)
].join('|');
function cleAbsence(absence, colonnes) {
  return [
    cleAbsenceSansMetadata(absence),
    colonnes['Absence.matiere'] ? absence.matiere : ''
  ].join('|');
}

async function assurerNotesEtAbsences(ecole, eleves, indexEcole, colonnes) {
  const eleveIds = eleves.map((eleve) => eleve.id);
  const [notesExistantes, absencesExistantes] = await Promise.all([
    fetchAll('Note', '*', (query) => query.in('eleveId', eleveIds)),
    fetchAll('Absence', '*', (query) => query
      .eq('schoolId', ecole.id)
      .in('eleveId', eleveIds))
  ]);
  const notesParCle = new Map(notesExistantes.map((note) => [cleNote(note, colonnes), note]));
  const notesParCleSansMetadata = new Map(notesExistantes.map((note) => [cleNoteSansMetadata(note), note]));
  const absencesParCle = new Map(absencesExistantes.map((absence) => [cleAbsence(absence, colonnes), absence]));
  const absencesParCleSansMetadata = new Map(absencesExistantes.map((absence) => [cleAbsenceSansMetadata(absence), absence]));
  const notesAInserer = [];
  const notesAMettreAJour = [];
  const absencesAInserer = [];
  const absencesAMettreAJour = [];

  eleves.forEach((eleve, indexEleve) => {
    const estFedi = ecole.configuration.domaine === 'pilotesousse'
      && eleve.prenom.toLowerCase() === 'fedi'
      && eleve.nom.toLowerCase() === 'mannai';

    EVALUATIONS_DEMO.forEach((evaluation, indexEvaluation) => {
      const variation = ((indexEleve * 3 + indexEvaluation * 5 + indexEcole) % 11) - 5;
      const valeur = estFedi
        ? [8, 14, 12, 16][indexEvaluation]
        : Math.max(6, Math.min(20, 13 + variation));
      const note = {
        eleveId: eleve.id,
        matiere: evaluation.matiere,
        valeur,
        coefficient: evaluation.coefficient,
        anneeScolaire: ANNEE_SCOLAIRE,
        ...(colonnes['Note.date'] ? { date: `${evaluation.date}T09:00:00.000Z` } : {}),
        ...(colonnes['Note.typeEvaluation'] ? { typeEvaluation: evaluation.typeEvaluation } : {})
      };
      const existante = notesParCle.get(cleNote(note, colonnes))
        || notesParCleSansMetadata.get(cleNoteSansMetadata(note));
      if (!existante) {
        notesAInserer.push(note);
      } else if (
        Number(existante.valeur) !== note.valeur
        || Number(existante.coefficient) !== note.coefficient
        || existante.anneeScolaire !== note.anneeScolaire
        || (colonnes['Note.date'] && jourIso(existante.date) !== jourIso(note.date))
        || (colonnes['Note.typeEvaluation'] && existante.typeEvaluation !== note.typeEvaluation)
      ) {
        notesAMettreAJour.push({ id: existante.id, note });
      }
    });

    const nombreAbsences = estFedi ? 2 : (indexEleve + indexEcole) % 3;
    for (let indexAbsence = 0; indexAbsence < nombreAbsences; indexAbsence += 1) {
      const date = new Date(Date.UTC(2026, 9 + indexAbsence, 6 + ((indexEleve * 2) % 20), 8));
      const matiere = EVALUATIONS_DEMO[(indexEleve + indexAbsence) % EVALUATIONS_DEMO.length].matiere;
      const justifiee = estFedi ? indexAbsence === 0 : (indexEleve + indexAbsence + indexEcole) % 2 === 0;
      const absence = {
        date: date.toISOString(),
        justifiee,
        anneeScolaire: ANNEE_SCOLAIRE,
        eleveId: eleve.id,
        schoolId: ecole.id,
        ...(colonnes['Absence.matiere'] ? { matiere } : {}),
        ...(colonnes['Absence.motif']
          ? { motif: justifiee ? 'Justificatif médical transmis' : 'Absence non signalée' }
          : {})
      };
      const existante = absencesParCle.get(cleAbsence(absence, colonnes))
        || absencesParCleSansMetadata.get(cleAbsenceSansMetadata(absence));
      if (!existante) {
        absencesAInserer.push(absence);
      } else if (
        existante.justifiee !== absence.justifiee
        || (colonnes['Absence.matiere'] && existante.matiere !== absence.matiere)
        || (colonnes['Absence.motif'] && existante.motif !== absence.motif)
        || existante.anneeScolaire !== absence.anneeScolaire
        || jourIso(existante.date) !== jourIso(absence.date)
      ) {
        absencesAMettreAJour.push({ id: existante.id, absence, eleveId: eleve.id });
      }
    }
  });

  for (const { id, note } of notesAMettreAJour) {
    await execute(
      supabaseAdmin.from('Note').update(note).eq('id', id).eq('eleveId', note.eleveId),
      `Mise à jour d'une note à ${ecole.nom}`
    );
  }
  for (const lot of lotsDe(notesAInserer, 300)) {
    await execute(supabaseAdmin.from('Note').insert(lot), `Ajout des notes à ${ecole.nom}`);
  }
  for (const { id, absence, eleveId } of absencesAMettreAJour) {
    await execute(
      supabaseAdmin.from('Absence').update(absence)
        .eq('id', id)
        .eq('eleveId', eleveId)
        .eq('schoolId', ecole.id),
      `Mise à jour d'une absence à ${ecole.nom}`
    );
  }
  for (const lot of lotsDe(absencesAInserer, 300)) {
    await execute(
      supabaseAdmin.from('Absence').insert(lot),
      `Ajout des absences à ${ecole.nom}`
    );
  }

  return { notes: notesAInserer.length + notesAMettreAJour.length, absences: absencesAInserer.length + absencesAMettreAJour.length };
}

async function assurerPaiements(plan, eleves, paiementsExistants) {
  const elevesAvecPaiement = new Set(
    paiementsExistants
      .filter((paiement) => paiement.schoolId === plan.school.id
        && paiement.anneeScolaire === ANNEE_SCOLAIRE)
      .map((paiement) => paiement.eleveId)
  );
  const nomNormalise = slug(plan.school.nom);
  const tarifBase = nomNormalise.includes('institut') || nomNormalise.includes('prive')
    ? 2200
    : nomNormalise.includes('lycee')
      ? 1450
      : 1000;
  const aInserer = [];

  eleves.forEach((eleve, index) => {
    if (elevesAvecPaiement.has(eleve.id)) return;
    const montantTotal = tarifBase + ((index * 37 + plan.index * 11) % 9) * 50;
    const statutIndex = (index + plan.index * 3) % 10;
    const statut = statutIndex < 5 ? 'PAYE' : statutIndex < 8 ? 'PARTIEL' : 'IMPAYE';
    const tauxPaye = statut === 'PAYE'
      ? 1
      : statut === 'PARTIEL'
        ? (35 + ((index * 11 + plan.index) % 41)) / 100
        : 0;
    const montantPaye = Math.round((montantTotal * tauxPaye) / 5) * 5;
    const datePaiement = montantPaye > 0
      ? new Date(Date.UTC(
        Number(ANNEE_SCOLAIRE.slice(0, 4)),
        6 + ((index * 3 + plan.index) % 5),
        2 + ((index * 7 + plan.index) % 27),
        12
      )).toISOString()
      : null;

    aInserer.push({
      montantTotal,
      montantPaye,
      statut,
      modePaiement: montantPaye > 0
        ? MODES_PAIEMENT[(index + plan.index) % MODES_PAIEMENT.length]
        : null,
      datePaiement,
      anneeScolaire: ANNEE_SCOLAIRE,
      schoolId: plan.school.id,
      eleveId: eleve.id
    });
  });

  const ajoutes = await insererParLots(
    'Paiement',
    aInserer,
    250,
    `Création des paiements de ${plan.school.nom}`
  );
  return ajoutes.length;
}

async function assurerAnnonces(ecole) {
  const annoncesDemo = [
    {
      titre: 'Calendrier des évaluations',
      contenu: 'Les évaluations du trimestre sont affichées dans l’espace élève. Pensez à consulter les dates et les matières.',
      cible: 'ELEVES'
    },
    {
      titre: 'Rencontre parents-enseignants',
      contenu: 'Les familles sont invitées à prendre contact avec l’équipe pédagogique pour le suivi du trimestre.',
      cible: 'PARENTS'
    },
    {
      titre: 'Informations de la semaine',
      contenu: 'Les cours et activités suivent l’emploi du temps habituel. Consultez régulièrement les annonces de l’établissement.',
      cible: 'TOUS'
    }
  ];
  const existantes = await fetchAll('Annonce', 'id,titre,contenu,cible', (query) => query.eq('schoolId', ecole.id));
  const parTitre = new Map(existantes.map((annonce) => [annonce.titre, annonce]));
  const aInserer = [];

  for (const annonce of annoncesDemo) {
    const existante = parTitre.get(annonce.titre);
    if (!existante) {
      aInserer.push({ ...annonce, schoolId: ecole.id });
    } else if (existante.contenu !== annonce.contenu || existante.cible !== annonce.cible) {
      await execute(
        supabaseAdmin.from('Annonce').update(annonce).eq('id', existante.id).eq('schoolId', ecole.id),
        `Mise à jour de l'annonce "${annonce.titre}" à ${ecole.nom}`
      );
    }
  }
  if (aInserer.length > 0) {
    await execute(supabaseAdmin.from('Annonce').insert(aInserer), `Ajout des annonces à ${ecole.nom}`);
  }
}

function cleSeance(seance) {
  return [seance.classeId, seance.jour, seance.heureDebut, seance.matiere].join('|');
}

async function assurerSeances(ecole, classes, enseignants) {
  const classeIds = classes.map((classe) => classe.id);
  const seancesExistantes = await fetchAll(
    'Seance',
    'id,jour,heureDebut,heureFin,matiere,salle,anneeScolaire,classeId,enseignantId,schoolId',
    (query) => query.eq('schoolId', ecole.id).in('classeId', classeIds)
  );
  const parCle = new Map(seancesExistantes.map((seance) => [cleSeance(seance), seance]));
  const aInserer = [];
  const aMettreAJour = [];

  classes.forEach((classe, classeIndex) => {
    JOURS.forEach((jour, jourIndex) => {
      CRENEAUX.forEach(([heureDebut, heureFin], creneauIndex) => {
        const enseignantIndex = (classeIndex + creneauIndex + jourIndex) % enseignants.length;
        const enseignant = enseignants[enseignantIndex];
        const seance = {
          jour,
          heureDebut,
          heureFin,
          matiere: enseignant.matiere,
          salle: `Salle ${classeIndex + 1}`,
          anneeScolaire: ANNEE_SCOLAIRE,
          classeId: classe.id,
          enseignantId: enseignant.id,
          schoolId: ecole.id
        };
        const existante = parCle.get(cleSeance(seance));

        if (!existante) {
          aInserer.push(seance);
          return;
        }

        const champs = [
          'heureFin', 'salle', 'anneeScolaire', 'enseignantId', 'schoolId'
        ];
        if (champs.some((champ) => existante[champ] !== seance[champ])) {
          aMettreAJour.push({ id: existante.id, seance });
        }
      });
    });
  });

  for (const { id, seance } of aMettreAJour) {
    await execute(
      supabaseAdmin.from('Seance').update(seance).eq('id', id),
      `Mise à jour d'une séance de ${ecole.nom}`
    );
  }

  if (aInserer.length > 0) {
    await execute(
      supabaseAdmin.from('Seance').insert(aInserer),
      `Création des séances de ${ecole.nom}`
    );
  }

  return JOURS.length * CRENEAUX.length * classes.length;
}

async function main() {
  const colonnesOptionnelles = await inspecterColonnesOptionnelles();
  const colonnesAbsentes = Object.entries(colonnesOptionnelles)
    .filter(([, disponible]) => !disponible)
    .map(([colonne]) => colonne);
  if (colonnesAbsentes.length > 0) {
    console.warn(
      `Colonnes optionnelles absentes du schéma PostgREST et omises du seed : ${colonnesAbsentes.join(', ')}.`
    );
  }

  const [ecoles, classesExistantes, elevesExistants, utilisateursExistants, paiementsExistants] = await Promise.all([
    fetchAll('School', 'id,nom', (query) => query.order('id', { ascending: true })),
    fetchAll('Classe', 'id,nom,niveau,capaciteMax,anneeScolaire,schoolId'),
    fetchAll('Eleve', 'id,matricule,nom,prenom,anneeScolaire,schoolId,classeId,parentId,userId'),
    fetchAll('User', 'id,email,nom,prenom,role,schoolId'),
    fetchAll('Paiement', '*', (query) => query.eq('anneeScolaire', ANNEE_SCOLAIRE))
  ]);
  if (ecoles.length === 0) throw new Error('Aucun établissement trouvé dans public."School".');

  const plans = construirePlansEcoles(ecoles, elevesExistants, utilisateursExistants);
  const classes = await assurerClasses(plans, classesExistantes);
  const passwordHash = bcrypt.hashSync(MOT_DE_PASSE, 10);
  const comptes = construireComptesEcole(plans, utilisateursExistants, elevesExistants);
  const utilisateurs = await upsertComptes(comptes, passwordHash);
  await assurerEleves(plans, utilisateurs);

  for (const plan of plans) {
    const ecole = { ...plan.school, configuration: plan.configuration };
    const classesEcole = classes.filter((classe) => classe.schoolId === plan.school.id);
    const enseignants = plan.configuration.enseignants.map((enseignant) => {
      const email = `prof.${slug(enseignant.nom)}@${plan.configuration.domaine}.edu.tn`;
      const compte = utilisateurs.find((utilisateur) => utilisateur.email.toLowerCase() === email.toLowerCase());
      if (!compte) throw new Error(`Compte enseignant introuvable pour ${email}.`);
      return { ...compte, matiere: enseignant.matiere };
    });

    const { notes, absences } = await assurerNotesEtAbsences(
      ecole,
      plan.eleves,
      plan.index,
      colonnesOptionnelles
    );
    const nombrePaiementsAjoutes = await assurerPaiements(plan, plan.eleves, paiementsExistants);
    const nombreSeances = await assurerSeances(ecole, classesEcole, enseignants);
    await assurerAnnonces(ecole);

    const paiementsEcole = await fetchAll('Paiement', 'montantTotal,montantPaye', (query) => query
      .eq('schoolId', plan.school.id)
      .eq('anneeScolaire', ANNEE_SCOLAIRE));
    const totalAttendu = paiementsEcole.reduce((total, paiement) => total + Number(paiement.montantTotal), 0);
    const totalEncaisse = paiementsEcole.reduce((total, paiement) => total + Number(paiement.montantPaye), 0);
    const directriceEmail = `directeur@${plan.configuration.domaine}.edu.tn`;

    console.log(`\n${plan.school.nom} (schoolId=${plan.school.id})`);
    console.log(`  Connexion directeur : ${directriceEmail}`);
    console.log(`  ${classesEcole.length} classes, ${plan.eleves.length} élèves, ${paiementsEcole.length} paiements`);
    console.log(`  Paiements : ${totalAttendu.toFixed(2)} TND attendus, ${totalEncaisse.toFixed(2)} TND encaissés, ${(totalAttendu - totalEncaisse).toFixed(2)} TND restants`);
    console.log(`  Démo : ${notes} notes, ${absences} absences, ${nombreSeances} séances, ${nombrePaiementsAjoutes} paiements ajoutés`);
  }

  console.log(`\nMot de passe commun à tous les comptes : ${MOT_DE_PASSE}`);
}

main().catch((error) => {
  console.error('Échec du peuplement Supabase :', {
    context: error.context || null,
    code: error.code || null,
    message: error.message,
    details: error.details || null,
    hint: error.hint || null
  });
  process.exitCode = 1;
});
