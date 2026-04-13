import axios from 'axios';

const rawBase = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: rawBase ? `${rawBase.replace(/\/$/, '')}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
