const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'cle-secrete-saas-tunisie-2026';

// Vérifier que l'utilisateur est connecté et récupérer son école
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Accès non autorisé : Token manquant' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded; // Contient { id, role, schoolId }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token invalide ou expiré' });
  }
};

// Restreindre l'accès selon le rôle (RBAC)
const authorize = (rolesAutorises) => {
  return (req, res, next) => {
    if (!rolesAutorises.includes(req.user.role)) {
      return res.status(403).json({ error: 'Vous n’avez pas les droits nécessaires pour cette action' });
    }
    next();
  };
};

module.exports = { authenticate, authorize, SECRET };