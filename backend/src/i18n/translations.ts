import { AppLocale } from './locale.types';

const EN_MESSAGES: Record<string, string> = {
  'Email is already in use.': 'Email is already in use.',
  'Invalid credentials.': 'Invalid credentials.',
  'User not found.': 'User not found.',
  Unauthorized: 'Unauthorized',
  'Unauthorized.': 'Unauthorized.',
  'Validation failed': 'Validation failed',
  'Team not found.': 'Team not found.',
  'Selected team has no creatures.': 'Selected team has no creatures.',
  'Could not join queue.': 'Could not join queue.',
  'Already in an active match.': 'Already in an active match.',
  'Internal server error': 'Internal server error',
};

const FR_MESSAGES: Record<string, string> = {
  'Email is already in use.': "L'email est déjà utilisé.",
  'Invalid credentials.': 'Identifiants invalides.',
  'User not found.': 'Utilisateur introuvable.',
  Unauthorized: 'Non autorisé',
  'Unauthorized.': 'Non autorisé.',
  'Validation failed': 'Échec de validation',
  'Team not found.': 'Équipe introuvable.',
  'Selected team has no creatures.': "L'équipe sélectionnée ne contient aucune créature.",
  'Could not join queue.': "Impossible de rejoindre la file d'attente.",
  'Already in an active match.': 'Vous êtes déjà dans un match actif.',
  'Internal server error': 'Erreur interne du serveur',
};

const ES_MESSAGES: Record<string, string> = {
  'Email is already in use.': 'El correo ya está en uso.',
  'Invalid credentials.': 'Credenciales inválidas.',
  'User not found.': 'Usuario no encontrado.',
  Unauthorized: 'No autorizado',
  'Unauthorized.': 'No autorizado.',
  'Validation failed': 'Error de validación',
  'Team not found.': 'Equipo no encontrado.',
  'Selected team has no creatures.': 'El equipo seleccionado no tiene criaturas.',
  'Could not join queue.': 'No se pudo unir a la cola.',
  'Already in an active match.': 'Ya estás en una partida activa.',
  'Internal server error': 'Error interno del servidor',
};

export const MESSAGE_TRANSLATIONS: Record<AppLocale, Record<string, string>> = {
  en: EN_MESSAGES,
  fr: FR_MESSAGES,
  es: ES_MESSAGES,
};
