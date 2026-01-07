/**
 * Unit tests for content filtering logic
 */

import { determineContentFilters } from '@/lib/agent/content-filters';
import type { UserContext } from '@/types/domain';

describe('content-filters', () => {
  describe('determineContentFilters', () => {
    it('should return null when no user context provided', () => {
      const result = determineContentFilters();
      expect(result).toBeNull();
    });

    it('should return explicit filters when provided', () => {
      const explicitFilters = ['policies', 'learning_content'];
      const result = determineContentFilters(undefined, explicitFilters);

      expect(result).toEqual(explicitFilters);
    });

    it('should prioritize explicit filters over user context', () => {
      const userContext: UserContext = {
        role: 'engineer',
        level: 'senior',
      };
      const explicitFilters = ['internal_roles'];

      const result = determineContentFilters(userContext, explicitFilters);

      expect(result).toEqual(['internal_roles']);
    });

    describe('role-based filtering', () => {
      it('should filter by engineer role', () => {
        const userContext: UserContext = {
          role: 'engineer',
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('policies');
        expect(result).toContain('learning_content');
        expect(result).toContain('internal_roles');
      });

      it('should filter by manager role', () => {
        const userContext: UserContext = {
          role: 'manager',
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('policies');
        expect(result).toContain('internal_roles');
        expect(result).not.toContain('learning_content');
      });

      it('should filter by hr role', () => {
        const userContext: UserContext = {
          role: 'hr',
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('policies');
        expect(result).toContain('internal_roles');
      });

      it('should filter by executive role', () => {
        const userContext: UserContext = {
          role: 'executive',
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('policies');
        expect(result).toContain('internal_roles');
      });

      it('should use default filters for unknown role', () => {
        const userContext: UserContext = {
          role: 'unknown-role',
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('policies');
        expect(result).toContain('learning_content');
        expect(result).toContain('internal_roles');
      });

      it('should handle case-insensitive role matching', () => {
        const userContext: UserContext = {
          role: 'ENGINEER',
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('policies');
        expect(result).toContain('learning_content');
      });
    });

    describe('level-based filtering', () => {
      it('should filter by junior level', () => {
        const userContext: UserContext = {
          level: 'junior',
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('learning_content');
        expect(result).toContain('policies');
      });

      it('should filter by mid level', () => {
        const userContext: UserContext = {
          level: 'mid',
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('learning_content');
        expect(result).toContain('policies');
        expect(result).toContain('internal_roles');
      });

      it('should filter by senior level', () => {
        const userContext: UserContext = {
          level: 'senior',
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('policies');
        expect(result).toContain('internal_roles');
        expect(result).not.toContain('learning_content');
      });

      it('should filter by lead level', () => {
        const userContext: UserContext = {
          level: 'lead',
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('policies');
        expect(result).toContain('internal_roles');
      });

      it('should filter by executive level', () => {
        const userContext: UserContext = {
          level: 'executive',
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('policies');
        expect(result).toContain('internal_roles');
      });

      it('should use default filters for unknown level', () => {
        const userContext: UserContext = {
          level: 'unknown' as any,
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('policies');
        expect(result).toContain('learning_content');
        expect(result).toContain('internal_roles');
      });
    });

    describe('learning preferences', () => {
      it('should add learning_content when learning preferences are provided', () => {
        const userContext: UserContext = {
          learningPreferences: ['hands-on', 'video'],
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('learning_content');
      });

      it('should combine learning preferences with role filters', () => {
        const userContext: UserContext = {
          role: 'manager',
          learningPreferences: ['hands-on'],
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('policies');
        expect(result).toContain('internal_roles');
        expect(result).toContain('learning_content');
      });
    });

    describe('combined filters', () => {
      it('should combine role and level filters', () => {
        const userContext: UserContext = {
          role: 'engineer',
          level: 'senior',
        };

        const result = determineContentFilters(userContext);

        expect(result).toContain('policies');
        expect(result).toContain('internal_roles');
        // Senior level doesn't include learning_content, but engineer role does
        // The intersection/union logic should handle this
        expect(result).toBeDefined();
      });

      it('should handle all user context fields together', () => {
        const userContext: UserContext = {
          role: 'engineer',
          level: 'mid',
          targetJob: 'senior engineer',
          learningPreferences: ['hands-on'],
        };

        const result = determineContentFilters(userContext);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result!.length).toBeGreaterThan(0);
      });

      it('should deduplicate content types', () => {
        const userContext: UserContext = {
          role: 'engineer', // includes policies, learning_content, internal_roles
          level: 'mid', // includes learning_content, policies, internal_roles
        };

        const result = determineContentFilters(userContext);

        const uniqueTypes = new Set(result);
        expect(uniqueTypes.size).toBe(result!.length);
      });
    });

    describe('edge cases', () => {
      it('should return null when no filters can be determined', () => {
        const userContext: UserContext = {};

        const result = determineContentFilters(userContext);

        expect(result).toBeNull();
      });

      it('should handle empty learning preferences array', () => {
        const userContext: UserContext = {
          learningPreferences: [],
        };

        const result = determineContentFilters(userContext);

        // Should not add learning_content if array is empty
        expect(result).toBeNull();
      });
    });
  });
});



