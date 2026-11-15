import axios from 'axios';

// En local : http://localhost:5000/api
// En ligne : définir VITE_API_URL dans l'hébergeur du frontend
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
});

// Ajoute automatiquement le token JWT à chaque requête
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;