'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { UserContext } from '@/types/domain';

interface ProfileViewProps {
  context: UserContext;
}

const LEVEL_LABELS: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  executive: 'Executive',
};

const COMMUNICATION_STYLE_LABELS: Record<string, string> = {
  concise: 'Concise',
  detailed: 'Detailed',
  balanced: 'Balanced',
};

const TONE_LABELS: Record<string, string> = {
  formal: 'Formal',
  casual: 'Casual',
  professional: 'Professional',
};

const TECHNICAL_DEPTH_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

const PRIMARY_GOAL_LABELS: Record<string, string> = {
  skill_development: 'Skill Development',
  career_transition: 'Career Transition',
  role_preparation: 'Role Preparation',
  general_learning: 'General Learning',
};

const TIME_HORIZON_LABELS: Record<string, string> = {
  immediate: 'Immediate',
  short_term: 'Short Term',
  long_term: 'Long Term',
};

const PREFERRED_FORMAT_LABELS: Record<string, string> = {
  structured: 'Structured',
  narrative: 'Narrative',
  bullet_points: 'Bullet Points',
  step_by_step: 'Step by Step',
};

const CITATION_DETAIL_LABELS: Record<string, string> = {
  minimal: 'Minimal',
  standard: 'Standard',
  detailed: 'Detailed',
};

const COMPANY_SIZE_LABELS: Record<string, string> = {
  startup: 'Startup',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  enterprise: 'Enterprise',
};

const renderField = (label: string, value: string | number | undefined | null) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
};

const renderSelectField = (label: string, value: string | undefined, labels: Record<string, string>) => {
  if (!value) {
    return null;
  }
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{labels[value] || value}</p>
    </div>
  );
};

const renderArrayField = (label: string, values: string[] | undefined) => {
  if (!values || values.length === 0) {
    return null;
  }
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((item) => (
          <Badge key={item} variant="secondary">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
};

const renderBooleanField = (label: string, value: boolean | undefined) => {
  if (value === undefined || value === false) {
    return null;
  }
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">Yes</p>
    </div>
  );
};

export const ProfileView = ({ context }: ProfileViewProps) => {
  const hasBasicProfile =
    context.role ||
    context.currentRole ||
    context.level ||
    context.targetJob ||
    context.yearsOfExperience !== undefined ||
    (context.learningPreferences && context.learningPreferences.length > 0);

  const hasCommunicationPreferences =
    context.communicationStyle || context.tone || context.technicalDepth;

  const hasDomainExpertise =
    (context.expertise && context.expertise.length > 0) ||
    (context.currentSkills && context.currentSkills.length > 0) ||
    (context.knowledgeGaps && context.knowledgeGaps.length > 0);

  const hasGoals =
    context.primaryGoal || context.timeHorizon || (context.focusAreas && context.focusAreas.length > 0);

  const hasResponseFormat =
    context.preferredFormat ||
    context.citationDetail ||
    context.includeExamples ||
    context.includeCodeSnippets;

  const hasContextBackground = context.industry || context.companySize;

  const hasLocalization = context.language || context.region;

  const hasAnyData =
    hasBasicProfile ||
    hasCommunicationPreferences ||
    hasDomainExpertise ||
    hasGoals ||
    hasResponseFormat ||
    hasContextBackground ||
    hasLocalization;

  if (!hasAnyData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Profile</CardTitle>
          <CardDescription>No profile information available. Click Edit to add your profile details.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
        <CardDescription>Your personalized profile information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasBasicProfile && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Basic Profile</h3>
            <div className="space-y-3">
              {renderField('Role', context.role)}
              {renderField('Current Role', context.currentRole)}
              {renderSelectField('Level', context.level, LEVEL_LABELS)}
              {renderField('Target Job', context.targetJob)}
              {renderField('Years of Experience', context.yearsOfExperience)}
              {renderArrayField('Learning Preferences', context.learningPreferences)}
            </div>
          </div>
        )}

        {hasCommunicationPreferences && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Communication Preferences</h3>
            <div className="space-y-3">
              {renderSelectField('Communication Style', context.communicationStyle, COMMUNICATION_STYLE_LABELS)}
              {renderSelectField('Tone', context.tone, TONE_LABELS)}
              {renderSelectField('Technical Depth', context.technicalDepth, TECHNICAL_DEPTH_LABELS)}
            </div>
          </div>
        )}

        {hasDomainExpertise && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Domain Expertise</h3>
            <div className="space-y-3">
              {renderArrayField('Expertise', context.expertise)}
              {renderArrayField('Current Skills', context.currentSkills)}
              {renderArrayField('Knowledge Gaps', context.knowledgeGaps)}
            </div>
          </div>
        )}

        {hasGoals && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Goals & Objectives</h3>
            <div className="space-y-3">
              {renderSelectField('Primary Goal', context.primaryGoal, PRIMARY_GOAL_LABELS)}
              {renderSelectField('Time Horizon', context.timeHorizon, TIME_HORIZON_LABELS)}
              {renderArrayField('Focus Areas', context.focusAreas)}
            </div>
          </div>
        )}

        {hasResponseFormat && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Response Format</h3>
            <div className="space-y-3">
              {renderSelectField('Preferred Format', context.preferredFormat, PREFERRED_FORMAT_LABELS)}
              {renderSelectField('Citation Detail', context.citationDetail, CITATION_DETAIL_LABELS)}
              {renderBooleanField('Include Examples', context.includeExamples)}
              {renderBooleanField('Include Code Snippets', context.includeCodeSnippets)}
            </div>
          </div>
        )}

        {hasContextBackground && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Context & Background</h3>
            <div className="space-y-3">
              {renderField('Industry', context.industry)}
              {renderSelectField('Company Size', context.companySize, COMPANY_SIZE_LABELS)}
            </div>
          </div>
        )}

        {hasLocalization && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Localization</h3>
            <div className="space-y-3">
              {renderField('Language', context.language)}
              {renderField('Region', context.region)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

