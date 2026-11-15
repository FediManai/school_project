require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize, SECRET } = require('./middlewares/auth');
const biController = require('./controllers/biController');

const app = express();
const prisma = new PrismaClient();

const FINANCE = ['ADMIN_ECOLE', 'DIRECTEUR', 'COMPTABLE'];
const UTILISATEURS_ECOLE = ['ADMIN_ECOLE', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT', 'PARENT', 'ELEVE'];
const ANNEE_SCOLAIRE = process.env.ANNEE_SCOLAIRE || '2026-2027';

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
const route = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error('Erreur :', error);
    res.status(500).json({ error: 'Erreur serveur : ' + error.message });
  }
};

// Élèves rattachés au compte (parent -> ses enfants, élève -> sa fiche)
const elevesDuCompte = (user, include) => {
  const where = { schoolId: user.schoolId };
  if (user.role === 'PARENT') where.parentId = user.id;
  else if (user.role === 'ELEVE') where.userId = user.id;
  else return Promise.resolve([]);
  return prisma.eleve.findMany({ where, include });
};

app.get('/', (req, res) => res.send('API SaaS Scolaire en ligne'));
app.get('/api/status', (req, res) => res.json({ message: 'API SaaS Scolaire opérationnelle' }));

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

  const user = await prisma.user.findUnique({
    where: { email: emailNormalise },
    include: { school: true }
  });

  const motDePasseValide = user ? await bcrypt.compare(password, user.password) : false;
  if (!user || !motDePasseValide) {
    console.log('Login refusé pour', emailNormalise);
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }
  if (ecoleSelectionnee !== undefined && ecoleSelectionnee !== user.schoolId) {
    return res.status(401).json({ error: 'Ce compte appartient à un autre établissement. Vérifiez votre sélection.' });
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
      etablissement: user.school?.nom
    }
  });
}));

// Établissements et effectifs affichés sur la page de connexion
app.get('/api/ecoles/selection', route(async (req, res) => {
  const ecoles = await prisma.school.findMany({
    orderBy: { nom: 'asc' },
    select: {
      id: true,
      nom: true,
      users: {
        where: { role: 'DIRECTEUR' },
        select: { nom: true, prenom: true },
        take: 1
      },
      _count: {
        select: {
          eleves: true,
          classes: true,
          users: { where: { role: 'ENSEIGNANT' } }
        }
      }
    }
  });
  res.json(ecoles.map((ecole) => ({
    id: ecole.id,
    nom: ecole.nom,
    directeur: ecole.users[0] ? `${ecole.users[0].prenom} ${ecole.users[0].nom}` : null,
    nombreEleves: ecole._count.eleves,
    nombreClasses: ecole._count.classes,
    nombreEnseignants: ecole._count.users
  })));
}));

// ---------- Gestion des établissements (administration plateforme) ----------
app.get('/api/ecoles', authenticate, authorize(['SUPER_ADMIN']), route(async (req, res) => {
  const ecoles = await prisma.school.findMany({
    orderBy: { nom: 'asc' },
    include: {
      users: {
        where: { role: 'DIRECTEUR' },
        select: { nom: true, prenom: true, email: true },
        take: 1
      },
      _count: { select: { users: true, classes: true, eleves: true } }
    }
  });
  res.json(ecoles.map((ecole) => ({
    id: ecole.id,
    nom: ecole.nom,
    adresse: ecole.adresse,
    directeur: ecole.users[0] || null,
    _count: ecole._count
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
  const comptesExistants = await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } });
  if (comptesExistants.length > 0) {
    return res.status(409).json({ error: `Email déjà utilisé : ${comptesExistants[0].email}` });
  }
  const matriculeExistant = await prisma.eleve.findUnique({ where: { matricule: matricule.trim() } });
  if (matriculeExistant) return res.status(409).json({ error: 'Ce matricule est déjà utilisé' });

  const ecole = await prisma.$transaction(async (transaction) => {
    const nouvelleEcole = await transaction.school.create({
      data: { nom: nom.trim(), adresse: typeof adresse === 'string' && adresse.trim() ? adresse.trim() : null }
    });
    await transaction.user.create({
      data: {
        email: emails[0],
        password: bcrypt.hashSync(directeurPassword, 10),
        nom: directeurNom.trim(),
        prenom: directeurPrenom.trim(),
        role: 'DIRECTEUR',
        schoolId: nouvelleEcole.id
      }
    });
    const enseignant = await transaction.user.create({
      data: {
        email: emails[1],
        password: bcrypt.hashSync(enseignantPassword, 10),
        nom: enseignantNom.trim(),
        prenom: enseignantPrenom.trim(),
        role: 'ENSEIGNANT',
        schoolId: nouvelleEcole.id
      }
    });
    const parent = await transaction.user.create({
      data: {
        email: emails[2],
        password: bcrypt.hashSync(parentPassword, 10),
        nom: parentNom.trim(),
        prenom: parentPrenom.trim(),
        role: 'PARENT',
        schoolId: nouvelleEcole.id
      }
    });
    const classe = await transaction.classe.create({
      data: {
        nom: classeNom.trim(),
        niveau: classeNiveau.trim(),
        capaciteMax: capacite,
        anneeScolaire: ANNEE_SCOLAIRE,
        schoolId: nouvelleEcole.id
      }
    });
    await transaction.eleve.create({
      data: {
        matricule: matricule.trim(),
        nom: eleveNom.trim(),
        prenom: elevePrenom.trim(),
        anneeScolaire: ANNEE_SCOLAIRE,
        schoolId: nouvelleEcole.id,
        classeId: classe.id,
        parentId: parent.id
      }
    });
    await transaction.seance.create({
      data: {
        jour: 'Lundi',
        heureDebut: '08:00',
        heureFin: '09:00',
        matiere: matiere.trim(),
        anneeScolaire: ANNEE_SCOLAIRE,
        classeId: classe.id,
        enseignantId: enseignant.id,
        schoolId: nouvelleEcole.id
      }
    });
    return nouvelleEcole;
  });

  res.status(201).json(ecole);
}));

// ---------- Élèves (liste, filtrée selon le rôle) ----------
app.get('/api/eleves', authenticate, authorize(UTILISATEURS_ECOLE), route(async (req, res) => {
  const { role, id, schoolId } = req.user;
  if (role === 'ELEVE') return res.json([]);

  const where = { schoolId };
  if (role === 'PARENT') where.parentId = id;
  if (req.query.classeId !== undefined) {
    const classeId = Number(req.query.classeId);
    if (!Number.isInteger(classeId) || classeId <= 0) {
      return res.status(400).json({ error: 'Identifiant de classe invalide' });
    }
    const classe = await prisma.classe.findFirst({ where: { id: classeId, schoolId } });
    if (!classe) return res.status(404).json({ error: 'Classe introuvable' });
    where.classeId = classeId;
  }

  const eleves = await prisma.eleve.findMany({
    where,
    include: {
      classe: true,
      parent: { select: { nom: true, prenom: true, email: true } }
    },
    orderBy: { nom: 'asc' }
  });
  res.json(eleves);
}));

// ---------- Classes (liste déroulante) ----------
app.get('/api/classes', authenticate, authorize(UTILISATEURS_ECOLE), route(async (req, res) => {
  const { role, schoolId } = req.user;
  const where = { schoolId };

  if (role === 'PARENT' || role === 'ELEVE') {
    const eleves = await elevesDuCompte(req.user, undefined);
    where.id = { in: eleves.map((e) => e.classeId) };
  }

  const classes = await prisma.classe.findMany({
    where,
    orderBy: { nom: 'asc' },
    include: { _count: { select: { eleves: true } } }
  });
  res.json(classes);
}));

// ---------- Emploi du temps d'une classe ----------
app.get('/api/emploi-du-temps/:classeId', authenticate, authorize(UTILISATEURS_ECOLE), route(async (req, res) => {
  const { role, schoolId } = req.user;
  const classeId = parseInt(req.params.classeId, 10);

  if (role === 'PARENT' || role === 'ELEVE') {
    const eleves = await elevesDuCompte(req.user, undefined);
    if (!eleves.some((e) => e.classeId === classeId)) {
      return res.status(403).json({ error: 'Cette classe ne vous est pas accessible' });
    }
  }

  const classe = await prisma.classe.findFirst({ where: { id: classeId, schoolId } });
  if (!classe) return res.status(404).json({ error: 'Classe introuvable' });

  const seances = await prisma.seance.findMany({
    where: { classeId, schoolId },
    include: { enseignant: { select: { nom: true, prenom: true } } },
    orderBy: { heureDebut: 'asc' }
  });
  res.json({ classe, seances });
}));

// ---------- Espace famille (parent : enfants ; élève : sa fiche) ----------
app.get('/api/mon-espace', authenticate, authorize(['PARENT', 'ELEVE']), route(async (req, res) => {
  const eleves = await elevesDuCompte(req.user, {
    classe: true,
    notes: true,
    absences: { orderBy: { date: 'desc' } },
    paiements: true
  });

  const resultat = eleves.map((e) => {
    let points = 0;
    let coeffs = 0;
    e.notes.forEach((n) => {
      points += n.valeur * n.coefficient;
      coeffs += n.coefficient;
    });
    return { ...e, moyenne: coeffs > 0 ? Number((points / coeffs).toFixed(2)) : null };
  });
  res.json(resultat);
}));

// ---------- Paiements détaillés (direction / comptabilité) ----------
app.get('/api/paiements', authenticate, authorize(FINANCE), route(async (req, res) => {
  const paiements = await prisma.paiement.findMany({
    where: { schoolId: req.user.schoolId },
    include: {
      eleve: {
        include: {
          classe: true,
          parent: { select: { nom: true, prenom: true, email: true } }
        }
      }
    }
  });

  res.json(
    paiements.map((p) => ({
      id: p.id,
      eleve: `${p.eleve.prenom} ${p.eleve.nom}`,
      matricule: p.eleve.matricule,
      classe: p.eleve.classe?.nom || 'N/A',
      parent: p.eleve.parent ? `${p.eleve.parent.prenom} ${p.eleve.parent.nom}` : 'N/A',
      parentEmail: p.eleve.parent?.email || '',
      montantTotal: p.montantTotal,
      montantPaye: p.montantPaye,
      reste: p.montantTotal - p.montantPaye,
      statut: p.statut,
      modePaiement: p.modePaiement,
      datePaiement: p.datePaiement
    }))
  );
}));

// ---------- Annonces ----------
app.get('/api/annonces', authenticate, authorize(UTILISATEURS_ECOLE), route(async (req, res) => {
  const { role, schoolId } = req.user;
  let cibles = null;
  if (role === 'PARENT') cibles = ['TOUS', 'PARENTS'];
  else if (role === 'ELEVE') cibles = ['TOUS', 'ELEVES'];
  else if (role === 'ENSEIGNANT') cibles = ['TOUS', 'ENSEIGNANTS'];

  const annonces = await prisma.annonce.findMany({
    where: { schoolId, ...(cibles ? { cible: { in: cibles } } : {}) },
    orderBy: { createdAt: 'desc' }
  });
  res.json(annonces);
}));

// Publication (une annonce publiée n'est ni modifiable ni supprimable)
app.post('/api/annonces', authenticate, authorize(['ADMIN_ECOLE', 'DIRECTEUR']), route(async (req, res) => {
  const { titre, contenu, cible } = req.body || {};
  if (!titre || !contenu) return res.status(400).json({ error: 'Titre et contenu requis' });

  const valides = ['TOUS', 'PARENTS', 'ELEVES', 'ENSEIGNANTS'];
  const annonce = await prisma.annonce.create({
    data: {
      titre: titre.trim(),
      contenu: contenu.trim(),
      cible: valides.includes(cible) ? cible : 'TOUS',
      schoolId: req.user.schoolId
    }
  });
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur API SaaS démarré sur http://localhost:${PORT}`));