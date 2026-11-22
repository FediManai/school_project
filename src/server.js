require('dotenv/config');
const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabaseAdmin, execute, fetchAll } = require('./supabaseAdmin');
const { authenticate, authorize, SECRET } = require('./middlewares/auth');
const biController = require('./controllers/biController');

const app = express();

const FINANCE = ['ADMIN_ECOLE', 'DIRECTEUR', 'COMPTABLE'];
const UTILISATEURS_ECOLE = ['ADMIN_ECOLE', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT', 'PARENT', 'ELEVE'];
const GESTION_ELEVES = ['ADMIN_ECOLE', 'DIRECTEUR'];
const MOT_DE_PASSE_ELEVE_PAR_DEFAUT = 'Demo2026!';
const ANNEE_SCOLAIRE = process.env.ANNEE_SCOLAIRE || '2026-2027';
const ORDRE_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const idsUniques = (rows, key) => [...new Set(rows.map((row) => row[key]).filter((id) => id !== null && id !== undefined))];
const slugEmail = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '.')
  .replace(/^\.+|\.+$/g, '');

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    }
  })
);
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Enveloppe les routes async pour renvoyer une erreur propre
const route = (fn, detailedErrors = false) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error('Erreur :', error);
    const body = {
      error: detailedErrors
        ? error.message || 'Erreur interne du serveur'
        : 'Erreur serveur : ' + error.message
    };
    if (detailedErrors) {
      ['context', 'code', 'details', 'hint'].forEach((field) => {
        if (error[field] !== undefined && error[field] !== null) body[field] = error[field];
      });
    }
    res.status(500).json(body);
  }
};

// Élèves rattachés au compte (parent -> ses enfants, élève -> sa fiche)
const elevesDuCompte = (user) => {
  if (user.role === 'PARENT') {
    return fetchAll('Eleve', '*', (query) => query
      .eq('schoolId', user.schoolId)
      .eq('parentId', user.id));
  }
  if (user.role === 'ELEVE') {
    return fetchAll('Eleve', '*', (query) => query
      .eq('schoolId', user.schoolId)
      .eq('userId', user.id));
  }
  return Promise.resolve([]);
};

async function rollbackSchoolCreation(schoolId) {
  const operations = [];
  let eleves = [];

  try {
    eleves = await fetchAll('Eleve', 'id', (query) => query.eq('schoolId', schoolId));
  } catch (error) {
    console.error(`Impossible de rechercher les élèves de l’établissement ${schoolId} pendant le nettoyage :`, error);
  }

  if (eleves.length > 0) {
    operations.push(() => execute(
      supabaseAdmin.from('Note').delete().in('eleveId', eleves.map((eleve) => eleve.id)),
      'Nettoyage des notes'
    ));
  }
  ['Absence', 'Paiement', 'Seance', 'Eleve', 'Classe', 'User'].forEach((table) => {
    operations.push(() => execute(
      supabaseAdmin.from(table).delete().eq('schoolId', schoolId),
      `Nettoyage de ${table}`
    ));
  });
  operations.push(() => execute(
    supabaseAdmin.from('School').delete().eq('id', schoolId),
    'Nettoyage de School'
  ));

  const errors = [];
  for (const operation of operations) {
    try {
      await operation();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    console.error(`Nettoyage incomplet de l’établissement ${schoolId} :`, errors);
  }
}
// ---------- Authentification ----------
app.post('/api/auth/login', route(async (req, res) => {
  const { email, password, schoolId } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const emailNormalise = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalise)) {
    return res.status(400).json({ error: 'Adresse email invalide' });
  }

  let ecoleSelectionnee;
  if (schoolId !== undefined && schoolId !== null && schoolId !== '') {
    ecoleSelectionnee = Number(schoolId);
    if (!Number.isSafeInteger(ecoleSelectionnee) || ecoleSelectionnee <= 0) {
      return res.status(400).json({ error: 'Établissement sélectionné invalide' });
    }
  }

  let user;
  try {
    user = await execute(
      supabaseAdmin.from('User').select('*').eq('email', emailNormalise).maybeSingle(),
      'Recherche du compte'
    );
  } catch (error) {
    console.error('[auth/login] Échec Supabase pendant la recherche du compte', {
      context: error.context || 'Recherche du compte',
      code: error.code || null,
      message: error.message,
      details: error.details || null,
      hint: error.hint || null
    });
    throw error;
  }

  if (!user) {
    console.warn(`[auth/login] Échec : utilisateur introuvable (${emailNormalise})`);
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const motDePasseValide = await bcrypt.compare(password, user.password);
  if (!motDePasseValide) {
    console.warn(`[auth/login] Échec : mot de passe invalide (${emailNormalise})`);
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }
  if (ecoleSelectionnee !== undefined && ecoleSelectionnee !== user.schoolId) {
    console.warn('[auth/login] Échec : établissement sélectionné différent du schoolId du compte', {
      email: emailNormalise,
      selectedSchoolId: ecoleSelectionnee,
      userSchoolId: user.schoolId
    });
    return res.status(401).json({ error: 'Ce compte appartient à un autre établissement. Vérifiez votre sélection.' });
  }
  let ecole;
  try {
    ecole = await execute(
      supabaseAdmin.from('School').select('nom').eq('id', user.schoolId).maybeSingle(),
      'Recherche de l’établissement du compte'
    );
  } catch (error) {
    console.error('[auth/login] Échec Supabase pendant la recherche de l’établissement', {
      context: error.context || 'Recherche de l’établissement du compte',
      code: error.code || null,
      message: error.message,
      details: error.details || null,
      hint: error.hint || null
    });
    throw error;
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, schoolId: user.schoolId },
    SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
      etablissement: ecole?.nom
    }
  });
}));

// Établissements et effectifs affichés sur la page de connexion
app.get('/api/ecoles/selection', route(async (req, res) => {
  try {
    const ecoles = await fetchAll('School', 'id,nom', (query) => query.order('nom', { ascending: true }));
    if (ecoles.length === 0) return res.json([]);

    const ecoleIds = ecoles.map((ecole) => ecole.id);
    const [directeurs, enseignants, eleves, classes] = await Promise.all([
      fetchAll('User', 'schoolId,nom,prenom', (query) => query
        .eq('role', 'DIRECTEUR')
        .in('schoolId', ecoleIds)),
      fetchAll('User', 'schoolId', (query) => query
        .eq('role', 'ENSEIGNANT')
        .in('schoolId', ecoleIds)),
      fetchAll('Eleve', 'schoolId', (query) => query.in('schoolId', ecoleIds)),
      fetchAll('Classe', 'schoolId', (query) => query.in('schoolId', ecoleIds))
    ]);
    const premierDirecteur = new Map();
    directeurs.forEach((directeur) => {
      if (!premierDirecteur.has(directeur.schoolId)) premierDirecteur.set(directeur.schoolId, directeur);
    });
    const compterParEcole = (rows) => rows.reduce((counts, row) => {
      counts.set(row.schoolId, (counts.get(row.schoolId) || 0) + 1);
      return counts;
    }, new Map());
    const nombreEnseignants = compterParEcole(enseignants);
    const nombreEleves = compterParEcole(eleves);
    const nombreClasses = compterParEcole(classes);

    res.json(ecoles.map((ecole) => {
      const directeur = premierDirecteur.get(ecole.id);
      return {
        id: ecole.id,
        nom: ecole.nom,
        directeur: directeur ? `${directeur.prenom} ${directeur.nom}` : null,
        nombreEleves: nombreEleves.get(ecole.id) || 0,
        nombreClasses: nombreClasses.get(ecole.id) || 0,
        nombreEnseignants: nombreEnseignants.get(ecole.id) || 0
      };
    }));
  } catch (error) {
    console.error('Erreur Supabase lors du chargement des établissements :', {
      table: error.context || 'School/User/Eleve/Classe',
      message: error.message,
      details: error.details || null,
      code: error.code || null,
      hint: error.hint || null
    });
    res.status(500).json({
      error: 'Impossible de charger la liste des établissements. Vérifiez la connexion à la base de données.'
    });
  }
}));

// ---------- Gestion des établissements (administration plateforme) ----------
app.get('/api/ecoles', authenticate, authorize(['SUPER_ADMIN']), route(async (req, res) => {
  const [ecoles, utilisateurs, classes, eleves] = await Promise.all([
    fetchAll('School', '*', (query) => query.order('nom', { ascending: true })),
    fetchAll('User', 'id,schoolId,nom,prenom,email,role'),
    fetchAll('Classe', 'schoolId'),
    fetchAll('Eleve', 'schoolId')
  ]);
  const directeurs = new Map();
  utilisateurs.filter((user) => user.role === 'DIRECTEUR').forEach((user) => {
    if (!directeurs.has(user.schoolId)) {
      directeurs.set(user.schoolId, { nom: user.nom, prenom: user.prenom, email: user.email });
    }
  });
  const compterParEcole = (rows) => rows.reduce((counts, row) => {
    counts.set(row.schoolId, (counts.get(row.schoolId) || 0) + 1);
    return counts;
  }, new Map());
  const nombreUtilisateurs = compterParEcole(utilisateurs);
  const nombreClasses = compterParEcole(classes);
  const nombreEleves = compterParEcole(eleves);

  res.json(ecoles.map((ecole) => ({
    id: ecole.id,
    nom: ecole.nom,
    adresse: ecole.adresse,
    directeur: directeurs.get(ecole.id) || null,
    _count: {
      users: nombreUtilisateurs.get(ecole.id) || 0,
      classes: nombreClasses.get(ecole.id) || 0,
      eleves: nombreEleves.get(ecole.id) || 0
    }
  })));
}));

app.post('/api/ecoles', authenticate, authorize(['SUPER_ADMIN']), route(async (req, res) => {
  const {
    nom, adresse,
    directeurNom, directeurPrenom, directeurEmail, directeurPassword,
    enseignantNom, enseignantPrenom, enseignantEmail, enseignantPassword, matiere,
    classeNom, classeNiveau, capaciteMax,
    eleveNom, elevePrenom, matricule,
    parentNom, parentPrenom, parentEmail, parentPassword
  } = req.body || {};
  if (
    ![
      nom, directeurNom, directeurPrenom, directeurEmail, directeurPassword,
      enseignantNom, enseignantPrenom, enseignantEmail, enseignantPassword, matiere,
      classeNom, classeNiveau, eleveNom, elevePrenom, matricule,
      parentNom, parentPrenom, parentEmail, parentPassword
    ].every(
      (valeur) => typeof valeur === 'string' && valeur.trim()
    )
  ) {
    return res.status(400).json({ error: 'Complétez l’école, le directeur, le professeur, la classe, l’élève et le parent' });
  }
  const emails = [directeurEmail, enseignantEmail, parentEmail].map((email) => email.trim().toLowerCase());
  if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ error: 'Une des adresses email est invalide' });
  }
  if ([directeurPassword, enseignantPassword, parentPassword].some((password) => password.length < 8)) {
    return res.status(400).json({ error: 'Chaque mot de passe doit contenir au moins 8 caractères' });
  }
  const capacite = Number(capaciteMax);
  if (!Number.isInteger(capacite) || capacite < 1 || capacite > 100) {
    return res.status(400).json({ error: 'La capacité de la classe doit être comprise entre 1 et 100' });
  }
  if (new Set(emails).size !== emails.length) {
    return res.status(400).json({ error: 'Le directeur, le professeur et le parent doivent avoir des emails différents' });
  }
  const comptesExistants = await execute(
    supabaseAdmin.from('User').select('email').in('email', emails),
    'Vérification des comptes existants'
  );
  if (comptesExistants.length > 0) {
    return res.status(409).json({ error: `Email déjà utilisé : ${comptesExistants[0].email}` });
  }
  const matriculeExistant = await execute(
    supabaseAdmin.from('Eleve').select('id').eq('matricule', matricule.trim()).maybeSingle(),
    'Vérification du matricule'
  );
  if (matriculeExistant) return res.status(409).json({ error: 'Ce matricule est déjà utilisé' });

  const nouvelleEcole = await execute(
    supabaseAdmin.from('School')
      .insert({ nom: nom.trim(), adresse: typeof adresse === 'string' && adresse.trim() ? adresse.trim() : null })
      .select()
      .single(),
    'Création de School'
  );

  try {
    const passwords = await Promise.all(
      [directeurPassword, enseignantPassword, parentPassword].map((password) => bcrypt.hash(password, 10))
    );
    const utilisateurs = await execute(
      supabaseAdmin.from('User').insert([
        {
          email: emails[0],
          password: passwords[0],
          nom: directeurNom.trim(),
          prenom: directeurPrenom.trim(),
          role: 'DIRECTEUR',
          schoolId: nouvelleEcole.id
        },
        {
          email: emails[1],
          password: passwords[1],
          nom: enseignantNom.trim(),
          prenom: enseignantPrenom.trim(),
          role: 'ENSEIGNANT',
          schoolId: nouvelleEcole.id
        },
        {
          email: emails[2],
          password: passwords[2],
          nom: parentNom.trim(),
          prenom: parentPrenom.trim(),
          role: 'PARENT',
          schoolId: nouvelleEcole.id
        }
      ]).select(),
      'Création des comptes'
    );
    const enseignant = utilisateurs.find((user) => user.role === 'ENSEIGNANT');
    const parent = utilisateurs.find((user) => user.role === 'PARENT');
    if (!enseignant || !parent) throw new Error('Les comptes liés à la classe n’ont pas été créés');

    const classe = await execute(
      supabaseAdmin.from('Classe').insert({
        nom: classeNom.trim(),
        niveau: classeNiveau.trim(),
        capaciteMax: capacite,
        anneeScolaire: ANNEE_SCOLAIRE,
        schoolId: nouvelleEcole.id
      }).select().single(),
      'Création de Classe'
    );
    await execute(
      supabaseAdmin.from('Eleve').insert({
        matricule: matricule.trim(),
        nom: eleveNom.trim(),
        prenom: elevePrenom.trim(),
        anneeScolaire: ANNEE_SCOLAIRE,
        schoolId: nouvelleEcole.id,
        classeId: classe.id,
        parentId: parent.id
      }).select().single(),
      'Création de Eleve'
    );
    await execute(
      supabaseAdmin.from('Seance').insert({
        jour: 'Lundi',
        heureDebut: '08:00',
        heureFin: '09:00',
        matiere: matiere.trim(),
        anneeScolaire: ANNEE_SCOLAIRE,
        classeId: classe.id,
        enseignantId: enseignant.id,
        schoolId: nouvelleEcole.id
      }),
      'Création de Seance'
    );
    res.status(201).json(nouvelleEcole);
  } catch (error) {
    await rollbackSchoolCreation(nouvelleEcole.id);
    throw error;
  }
}));

// ---------- Élèves (liste, filtrée selon le rôle) ----------
app.get('/api/eleves', authenticate, authorize(UTILISATEURS_ECOLE), route(async (req, res) => {
  const { role, id, schoolId } = req.user;
  if (role === 'ELEVE') return res.json([]);

  const configure = (query) => {
    let filtered = query.eq('schoolId', schoolId);
    if (role === 'PARENT') filtered = filtered.eq('parentId', id);
    return filtered;
  };
  let filtreClasseId;
  if (req.query.classeId !== undefined) {
    filtreClasseId = Number(req.query.classeId);
    if (!Number.isSafeInteger(filtreClasseId) || filtreClasseId <= 0) {
      return res.status(400).json({ error: 'Identifiant de classe invalide' });
    }
    const classe = await execute(
      supabaseAdmin.from('Classe').select('id').eq('id', filtreClasseId).eq('schoolId', schoolId).maybeSingle(),
      'Vérification de la classe'
    );
    if (!classe) return res.status(404).json({ error: 'Classe introuvable' });
  }

  const eleves = await fetchAll('Eleve', '*', (query) => {
    let filtered = configure(query);
    if (filtreClasseId) filtered = filtered.eq('classeId', filtreClasseId);
    return filtered.order('nom', { ascending: true });
  });
  const classeIds = idsUniques(eleves, 'classeId');
  const parentIds = idsUniques(eleves, 'parentId');
  const [classes, parents] = await Promise.all([
    classeIds.length
      ? fetchAll('Classe', '*', (query) => query.in('id', classeIds))
      : [],
    parentIds.length
      ? fetchAll('User', 'id,nom,prenom,email', (query) => query.in('id', parentIds))
      : []
  ]);
  const classesParId = new Map(classes.map((classe) => [classe.id, classe]));
  const parentsParId = new Map(parents.map((parent) => [parent.id, parent]));
  res.json(eleves.map((eleve) => ({
    ...eleve,
    classe: classesParId.get(eleve.classeId) || null,
    parent: parentsParId.get(eleve.parentId) || null
  })));
}));

app.post('/api/eleves', authenticate, authorize(GESTION_ELEVES), route(async (req, res) => {
  const nom = typeof req.body?.nom === 'string' ? req.body.nom.trim() : '';
  const prenom = typeof req.body?.prenom === 'string' ? req.body.prenom.trim() : '';
  const classeId = Number(req.body?.classeId);
  const { schoolId } = req.user;

  if (!nom || !prenom) {
    return res.status(400).json({ error: 'Le prénom et le nom de l’élève sont requis' });
  }
  if (!Number.isSafeInteger(classeId) || classeId <= 0) {
    return res.status(400).json({ error: 'Identifiant de classe invalide' });
  }

  const classe = await execute(
    supabaseAdmin.from('Classe')
      .select('id,capaciteMax')
      .eq('id', classeId)
      .eq('schoolId', schoolId)
      .maybeSingle(),
    'Vérification de la classe pour création d’élève'
  );
  if (!classe) return res.status(404).json({ error: 'Classe introuvable dans votre établissement' });

  const effectif = await fetchAll('Eleve', 'id', (query) => query
    .eq('schoolId', schoolId)
    .eq('classeId', classeId));
  if (effectif.length >= classe.capaciteMax) {
    return res.status(409).json({ error: 'La classe a atteint sa capacité maximale' });
  }

  const prenomSlug = slugEmail(prenom);
  const nomSlug = slugEmail(nom);
  if (!prenomSlug || !nomSlug) {
    return res.status(400).json({ error: 'Le prénom et le nom doivent contenir des caractères utilisables dans un email' });
  }
  const baseIdentite = `${prenomSlug}.${nomSlug}`;

  const passwordHash = await bcrypt.hash(MOT_DE_PASSE_ELEVE_PAR_DEFAUT, 10);
  let compte;
  for (let suffixe = 1; suffixe <= 100; suffixe += 1) {
    const email = `etu.${baseIdentite}${suffixe === 1 ? '' : `.${suffixe}`}@edu.tn`;
    const compteExistant = await execute(
      supabaseAdmin.from('User').select('id').eq('email', email).maybeSingle(),
      'Vérification de la disponibilité de l’email élève'
    );
    if (compteExistant) continue;

    try {
      compte = await execute(
        supabaseAdmin.from('User')
          .insert({
            email,
            password: passwordHash,
            nom,
            prenom,
            role: 'ELEVE',
            schoolId
          })
          .select('id,email')
          .single(),
        'Création du compte élève'
      );
      break;
    } catch (error) {
      const description = `${error.message || ''} ${error.details || ''}`;
      const doublonEmail = error.code === '23505'
        && (/Key\s+\(email\)\s*=/i.test(description) || /email_key/i.test(description));
      if (doublonEmail) continue;
      throw error;
    }
  }

  if (!compte) {
    return res.status(409).json({ error: 'Impossible de générer un email unique pour cet élève' });
  }

  let eleve;
  try {
    eleve = await execute(
      supabaseAdmin.from('Eleve')
        .insert({
          matricule: `EL-${crypto.randomUUID()}`,
          nom,
          prenom,
          anneeScolaire: ANNEE_SCOLAIRE,
          schoolId,
          classeId,
          userId: compte.id
        })
        .select('*')
        .single(),
      'Création de la fiche élève'
    );
  } catch (error) {
    try {
      await execute(
        supabaseAdmin.from('User').delete().eq('id', compte.id).eq('schoolId', schoolId),
        'Annulation du compte après échec de création de la fiche élève'
      );
    } catch (rollbackError) {
      console.error('[eleves/create] Échec du nettoyage du compte créé partiellement', rollbackError);
    }
    throw error;
  }

  res.status(201).json({
    eleve: { ...eleve, classe },
    compte: {
      email: compte.email,
      motDePasseInitial: MOT_DE_PASSE_ELEVE_PAR_DEFAUT
    }
  });
}, true));

app.delete('/api/eleves/:id', authenticate, authorize(GESTION_ELEVES), route(async (req, res) => {
  const eleveId = Number(req.params.id);
  const { schoolId } = req.user;
  if (!Number.isSafeInteger(eleveId) || eleveId <= 0) {
    return res.status(400).json({ error: 'Identifiant d’élève invalide' });
  }

  const eleve = await execute(
    supabaseAdmin.from('Eleve')
      .select('id,matricule,userId')
      .eq('id', eleveId)
      .eq('schoolId', schoolId)
      .maybeSingle(),
    'Vérification de l’appartenance de l’élève à l’établissement'
  );
  if (!eleve) return res.status(404).json({ error: 'Élève introuvable dans votre établissement' });

  let compte;
  if (eleve.userId) {
    compte = await execute(
      supabaseAdmin.from('User')
        .select('id,role,schoolId')
        .eq('id', eleve.userId)
        .maybeSingle(),
      'Vérification du compte lié à l’élève'
    );

    if (compte && (compte.schoolId !== schoolId || compte.role !== 'ELEVE')) {
      return res.status(409).json({
        error: 'Le compte lié n’est pas un compte élève de votre établissement ; aucune donnée n’a été supprimée'
      });
    }

    if (compte) {
      const [elevesDontIlEstParent, seancesEnseignees] = await Promise.all([
        fetchAll('Eleve', 'id', (query) => query
          .eq('parentId', compte.id)
          .neq('id', eleve.id)),
        fetchAll('Seance', 'id', (query) => query.eq('enseignantId', compte.id))
      ]);
      if (elevesDontIlEstParent.length > 0 || seancesEnseignees.length > 0) {
        return res.status(409).json({
          error: 'Le compte lié est encore référencé par d’autres élèves ou séances ; aucune donnée n’a été supprimée'
        });
      }
    }
  }

  await execute(
    supabaseAdmin.from('Note').delete().eq('eleveId', eleveId),
    'Suppression des notes de l’élève'
  );
  await execute(
    supabaseAdmin.from('Absence').delete().eq('eleveId', eleveId),
    'Suppression des absences de l’élève'
  );
  await execute(
    supabaseAdmin.from('Paiement').delete().eq('eleveId', eleveId),
    'Suppression des paiements de l’élève'
  );
  await execute(
    supabaseAdmin.from('Eleve').delete().eq('id', eleveId).eq('schoolId', schoolId),
    'Suppression de la fiche élève'
  );
  if (compte) {
    await execute(
      supabaseAdmin.from('User').delete().eq('id', compte.id).eq('schoolId', schoolId),
      'Suppression du compte élève'
    );
  }

  res.json({ id: eleveId, supprime: true });
}, true));

// ---------- Classes (liste déroulante) ----------
app.get('/api/classes', authenticate, authorize(UTILISATEURS_ECOLE), route(async (req, res) => {
  const { role, schoolId } = req.user;
  let classesIds;

  if (role === 'PARENT' || role === 'ELEVE') {
    const eleves = await elevesDuCompte(req.user);
    classesIds = idsUniques(eleves, 'classeId');
    if (classesIds.length === 0) return res.json([]);
  }

  const classes = await fetchAll('Classe', '*', (query) => {
    let filtered = query.eq('schoolId', schoolId).order('nom', { ascending: true });
    if (classesIds) filtered = filtered.in('id', classesIds);
    return filtered;
  });
  const ids = idsUniques(classes, 'id');
  const eleves = ids.length
    ? await fetchAll('Eleve', 'classeId', (query) => query.eq('schoolId', schoolId).in('classeId', ids))
    : [];
  const effectifs = eleves.reduce((counts, eleve) => {
    counts.set(eleve.classeId, (counts.get(eleve.classeId) || 0) + 1);
    return counts;
  }, new Map());
  res.json(classes.map((classe) => ({
    ...classe,
    _count: { eleves: effectifs.get(classe.id) || 0 }
  })));
}));

// ---------- Emploi du temps d'une classe ----------
app.get('/api/emploi-du-temps/:classeId', authenticate, authorize(UTILISATEURS_ECOLE), route(async (req, res) => {
  const { role, schoolId } = req.user;
  const classeId = Number(req.params.classeId);
  if (!Number.isSafeInteger(classeId) || classeId <= 0) {
    return res.status(400).json({ error: 'Identifiant de classe invalide' });
  }

  if (role === 'PARENT' || role === 'ELEVE') {
    const eleves = await elevesDuCompte(req.user);
    if (!eleves.some((e) => e.classeId === classeId)) {
      return res.status(403).json({ error: 'Cette classe ne vous est pas accessible' });
    }
  }

  const classe = await execute(
    supabaseAdmin.from('Classe').select('*').eq('id', classeId).eq('schoolId', schoolId).maybeSingle(),
    'Recherche de Classe'
  );
  if (!classe) return res.status(404).json({ error: 'Classe introuvable' });

  const seances = await fetchAll('Seance', '*', (query) => query
    .eq('classeId', classeId)
    .eq('schoolId', schoolId)
    .order('heureDebut', { ascending: true }));
  const enseignantsIds = idsUniques(seances, 'enseignantId');
  const enseignants = enseignantsIds.length
    ? await fetchAll('User', 'id,nom,prenom', (query) => query
      .eq('schoolId', schoolId)
      .in('id', enseignantsIds))
    : [];
  const enseignantsParId = new Map(enseignants.map((enseignant) => [enseignant.id, enseignant]));
  const seancesAvecEnseignant = seances.map((seance) => ({
    ...seance,
    enseignant: enseignantsParId.get(seance.enseignantId) || null
  })).sort((a, b) => {
    const ordreA = ORDRE_JOURS.indexOf(a.jour);
    const ordreB = ORDRE_JOURS.indexOf(b.jour);
    return (ordreA === -1 ? Number.MAX_SAFE_INTEGER : ordreA)
      - (ordreB === -1 ? Number.MAX_SAFE_INTEGER : ordreB)
      || a.heureDebut.localeCompare(b.heureDebut);
  });
  res.json({ classe, seances: seancesAvecEnseignant });
}));

// ---------- Espace famille (parent : enfants ; élève : sa fiche) ----------
app.get('/api/mon-espace', authenticate, authorize(['PARENT', 'ELEVE']), route(async (req, res) => {
  const eleves = await elevesDuCompte(req.user);
  const eleveIds = idsUniques(eleves, 'id');
  if (eleveIds.length === 0) return res.json([]);
  const classeIds = idsUniques(eleves, 'classeId');
  const [classes, notes, absences, paiements] = await Promise.all([
    fetchAll('Classe', '*', (query) => query
      .eq('schoolId', req.user.schoolId)
      .in('id', classeIds)),
    fetchAll('Note', '*', (query) => query
      .in('eleveId', eleveIds)
      .order('id', { ascending: false })),
    fetchAll('Absence', '*', (query) => query
      .eq('schoolId', req.user.schoolId)
      .in('eleveId', eleveIds)
      .order('date', { ascending: false })),
    fetchAll('Paiement', '*', (query) => query
      .eq('schoolId', req.user.schoolId)
      .in('eleveId', eleveIds))
  ]);
  const classesParId = new Map(classes.map((classe) => [classe.id, classe]));
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
  const paiementsParEleve = new Map();
  paiements.forEach((paiement) => {
    if (!paiementsParEleve.has(paiement.eleveId)) paiementsParEleve.set(paiement.eleveId, []);
    paiementsParEleve.get(paiement.eleveId).push(paiement);
  });

  const resultat = eleves.map((eleve) => {
    let points = 0;
    let coeffs = 0;
    const notesEleve = notesParEleve.get(eleve.id) || [];
    notesEleve.forEach((note) => {
      const valeur = Number(note.valeur);
      const coefficient = Number(note.coefficient);
      if (!Number.isFinite(valeur) || !Number.isFinite(coefficient) || coefficient <= 0) return;
      points += valeur * coefficient;
      coeffs += coefficient;
    });
    return {
      ...eleve,
      classe: classesParId.get(eleve.classeId) || null,
      notes: notesEleve,
      absences: absencesParEleve.get(eleve.id) || [],
      paiements: paiementsParEleve.get(eleve.id) || [],
      moyenne: coeffs > 0 ? Number((points / coeffs).toFixed(2)) : null
    };
  });
  res.json(resultat);
}));

// ---------- Paiements détaillés (direction / comptabilité) ----------
app.get('/api/paiements', authenticate, authorize(FINANCE), route(async (req, res) => {
  const paiements = await fetchAll('Paiement', '*', (query) => query.eq('schoolId', req.user.schoolId));
  const eleveIds = idsUniques(paiements, 'eleveId');
  const eleves = eleveIds.length
    ? await fetchAll('Eleve', '*', (query) => query
      .eq('schoolId', req.user.schoolId)
      .in('id', eleveIds))
    : [];
  const classeIds = idsUniques(eleves, 'classeId');
  const classes = classeIds.length
    ? await fetchAll('Classe', 'id,nom', (query) => query
      .eq('schoolId', req.user.schoolId)
      .in('id', classeIds))
    : [];
  const parentIds = idsUniques(eleves, 'parentId');
  const parents = parentIds.length
    ? await fetchAll('User', 'id,nom,prenom,email', (query) => query
      .eq('schoolId', req.user.schoolId)
      .in('id', parentIds))
    : [];
  const classesParId = new Map(classes.map((classe) => [classe.id, classe]));
  const elevesParId = new Map(eleves.map((eleve) => [eleve.id, eleve]));
  const parentsParId = new Map(parents.map((parent) => [parent.id, parent]));

  res.json(
    paiements.map((paiement) => {
      const eleve = elevesParId.get(paiement.eleveId);
      const parent = eleve?.parentId ? parentsParId.get(eleve.parentId) : null;
      return {
        id: paiement.id,
        eleve: eleve ? `${eleve.prenom} ${eleve.nom}` : 'N/A',
        matricule: eleve?.matricule || '',
        classe: classesParId.get(eleve?.classeId)?.nom || 'N/A',
        parent: parent ? `${parent.prenom} ${parent.nom}` : 'N/A',
        parentEmail: parent?.email || '',
        montantTotal: Number(paiement.montantTotal),
        montantPaye: Number(paiement.montantPaye),
        reste: Number(paiement.montantTotal) - Number(paiement.montantPaye),
        statut: paiement.statut,
        modePaiement: paiement.modePaiement,
        datePaiement: paiement.datePaiement
      };
    })
  );
}));

// ---------- Annonces ----------
app.get('/api/annonces', authenticate, authorize(UTILISATEURS_ECOLE), route(async (req, res) => {
  const { role, schoolId } = req.user;
  let cibles = null;
  if (role === 'PARENT') cibles = ['TOUS', 'PARENTS'];
  else if (role === 'ELEVE') cibles = ['TOUS', 'ELEVES'];
  else if (role === 'ENSEIGNANT') cibles = ['TOUS', 'ENSEIGNANTS'];

  const annonces = await fetchAll('Annonce', '*', (query) => {
    let filtered = query.eq('schoolId', schoolId).order('createdAt', { ascending: false });
    if (cibles) filtered = filtered.in('cible', cibles);
    return filtered;
  });
  res.json(annonces);
}));

// Publication (une annonce publiée n'est ni modifiable ni supprimable)
app.post('/api/annonces', authenticate, authorize(['ADMIN_ECOLE', 'DIRECTEUR']), route(async (req, res) => {
  const { titre, contenu, cible } = req.body || {};
  if (typeof titre !== 'string' || !titre.trim() || typeof contenu !== 'string' || !contenu.trim()) {
    return res.status(400).json({ error: 'Titre et contenu requis' });
  }

  const valides = ['TOUS', 'PARENTS', 'ELEVES', 'ENSEIGNANTS'];
  const annonce = await execute(
    supabaseAdmin.from('Annonce').insert({
      titre: titre.trim(),
      contenu: contenu.trim(),
      cible: valides.includes(cible) ? cible : 'TOUS',
      schoolId: req.user.schoolId
    }).select().single(),
    'Création de Annonce'
  );
  res.status(201).json(annonce);
}));

// ---------- Business Intelligence ----------
app.get(
  '/api/bi/dashboard',
  authenticate,
  authorize(FINANCE),
  biController.getDashboardBI
);

app.use((err, req, res, next) => {
  console.error('Erreur non gérée :', err.message);
  res.status(500).json({ error: err.message });
});

if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDistPath));
  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('API Classly en ligne');
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur API SaaS démarré sur http://localhost:${PORT}`));