import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const apiRoot = (configuredApiUrl || (import.meta.env.PROD ? '' : 'http://localhost:5000'))
  .replace(/\/+$/, '');
const baseURL = apiRoot
  ? (/\/api$/i.test(apiRoot) ? apiRoot : `${apiRoot}/api`)
  : '/api';

const API = axios.create({
  baseURL
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