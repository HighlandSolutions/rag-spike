/**
 * Content filtering logic based on user context
 * 
 * NOTE: Tagging system removed - this function now always returns null (no filtering)
 * Kept for API compatibility but no longer performs any filtering
 */

import type { UserContext } from '@/types/domain';

/**
 * Determine content filters based on user context
 * 
 * @returns Always returns null (no filtering) - tagging system removed
 */
export const determineContentFilters = (
  userContext?: UserContext,
  explicitFilters?: string[]
): string[] | null => {
  // Tagging system removed - always return null to search all content
  return null;
};

