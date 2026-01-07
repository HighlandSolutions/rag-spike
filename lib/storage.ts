/**
 * LocalStorage utilities for user context
 */

import type { UserContext } from '@/types/domain';

const USER_CONTEXT_KEY = 'rag_user_context';

/**
 * Save user context to localStorage
 * No-op if localStorage is not available (SSR)
 */
export function saveUserContext(context: UserContext): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(context));
  } catch (error) {
    console.error('Failed to save user context:', error);
  }
}

/**
 * Load user context from localStorage
 * Returns null if localStorage is not available (SSR)
 */
export function loadUserContext(): UserContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = localStorage.getItem(USER_CONTEXT_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as UserContext;
  } catch (error) {
    console.error('Failed to load user context:', error);
    return null;
  }
}

/**
 * Clear user context from localStorage
 * No-op if localStorage is not available (SSR)
 */
export function clearUserContext(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(USER_CONTEXT_KEY);
  } catch (error) {
    console.error('Failed to clear user context:', error);
  }
}

