/**
 * Content filtering logic based on user context
 * Maps user role/level to appropriate content types
 */

import type { UserContext } from '@/types/domain';

/**
 * Content type mapping based on user role
 */
const ROLE_CONTENT_MAP: Record<string, string[]> = {
  engineer: ['policies', 'learning_content', 'internal_roles'],
  manager: ['policies', 'internal_roles'],
  hr: ['policies', 'internal_roles'],
  executive: ['policies', 'internal_roles'],
  default: ['policies', 'learning_content', 'internal_roles'],
};

/**
 * Content type mapping based on user level
 */
const LEVEL_CONTENT_MAP: Record<string, string[]> = {
  junior: ['learning_content', 'policies'],
  mid: ['learning_content', 'policies', 'internal_roles'],
  senior: ['policies', 'internal_roles'],
  lead: ['policies', 'internal_roles'],
  executive: ['policies', 'internal_roles'],
  default: ['policies', 'learning_content', 'internal_roles'],
};

/**
 * Determine content filters based on user context
 */
export const determineContentFilters = (
  userContext?: UserContext,
  explicitFilters?: string[]
): string[] | null => {
  // If explicit filters are provided, use them
  if (explicitFilters && explicitFilters.length > 0) {
    return explicitFilters;
  }

  // If no user context, return all content types
  if (!userContext) {
    return null; // null means no filter (all content types)
  }

  const filters = new Set<string>();

  // Add filters based on role
  if (userContext.role) {
    const roleLower = userContext.role.toLowerCase();
    const roleContent = ROLE_CONTENT_MAP[roleLower] || ROLE_CONTENT_MAP.default;
    roleContent.forEach((type) => filters.add(type));
  }

  // Add filters based on level
  if (userContext.level) {
    const levelContent = LEVEL_CONTENT_MAP[userContext.level] || LEVEL_CONTENT_MAP.default;
    levelContent.forEach((type) => filters.add(type));
  }

  // Apply learning preferences if provided
  if (userContext.learningPreferences && userContext.learningPreferences.length > 0) {
    // If user has specific learning preferences, prioritize learning_content
    if (userContext.learningPreferences.length > 0) {
      filters.add('learning_content');
    }
  }

  // If no filters were determined, return null (all content)
  if (filters.size === 0) {
    return null;
  }

  return Array.from(filters);
};

