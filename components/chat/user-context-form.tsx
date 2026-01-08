'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';
import type { UserContext } from '@/types/domain';
import { loadUserContext, saveUserContext } from '@/lib/storage';

interface UserContextFormProps {
  onContextChange?: (context: UserContext) => void;
  initialContext?: UserContext;
}

const LEVEL_OPTIONS = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'executive', label: 'Executive' },
] as const;

const LEARNING_PREFERENCE_OPTIONS = [
  'Visual',
  'Reading',
  'Hands-on',
  'Video',
  'Interactive',
  'Case Studies',
  'Documentation',
] as const;

const COMMUNICATION_STYLE_OPTIONS = [
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'balanced', label: 'Balanced' },
] as const;

const TONE_OPTIONS = [
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Professional' },
] as const;

const TECHNICAL_DEPTH_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
] as const;

const PRIMARY_GOAL_OPTIONS = [
  { value: 'skill_development', label: 'Skill Development' },
  { value: 'career_transition', label: 'Career Transition' },
  { value: 'role_preparation', label: 'Role Preparation' },
  { value: 'general_learning', label: 'General Learning' },
] as const;

const TIME_HORIZON_OPTIONS = [
  { value: 'immediate', label: 'Immediate' },
  { value: 'short_term', label: 'Short Term' },
  { value: 'long_term', label: 'Long Term' },
] as const;

const PREFERRED_FORMAT_OPTIONS = [
  { value: 'structured', label: 'Structured' },
  { value: 'narrative', label: 'Narrative' },
  { value: 'bullet_points', label: 'Bullet Points' },
  { value: 'step_by_step', label: 'Step by Step' },
] as const;

const CITATION_DETAIL_OPTIONS = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'standard', label: 'Standard' },
  { value: 'detailed', label: 'Detailed' },
] as const;

const COMPANY_SIZE_OPTIONS = [
  { value: 'startup', label: 'Startup' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'enterprise', label: 'Enterprise' },
] as const;

export const UserContextForm = ({
  onContextChange,
  initialContext,
}: UserContextFormProps) => {
  // Basic profile
  const [role, setRole] = useState(initialContext?.role || '');
  const [currentRole, setCurrentRole] = useState(initialContext?.currentRole || '');
  const [level, setLevel] = useState<UserContext['level']>(initialContext?.level);
  const [targetJob, setTargetJob] = useState(initialContext?.targetJob || '');
  const [yearsOfExperience, setYearsOfExperience] = useState<number | undefined>(
    initialContext?.yearsOfExperience
  );
  const [learningPreferences, setLearningPreferences] = useState<string[]>(
    initialContext?.learningPreferences || []
  );
  const [preferenceInput, setPreferenceInput] = useState('');

  // Communication preferences
  const [communicationStyle, setCommunicationStyle] = useState<UserContext['communicationStyle']>(
    initialContext?.communicationStyle
  );
  const [tone, setTone] = useState<UserContext['tone']>(initialContext?.tone);
  const [technicalDepth, setTechnicalDepth] = useState<UserContext['technicalDepth']>(
    initialContext?.technicalDepth
  );

  // Domain expertise
  const [expertise, setExpertise] = useState<string[]>(initialContext?.expertise || []);
  const [expertiseInput, setExpertiseInput] = useState('');
  const [currentSkills, setCurrentSkills] = useState<string[]>(initialContext?.currentSkills || []);
  const [skillsInput, setSkillsInput] = useState('');
  const [knowledgeGaps, setKnowledgeGaps] = useState<string[]>(initialContext?.knowledgeGaps || []);
  const [gapsInput, setGapsInput] = useState('');

  // Goals
  const [primaryGoal, setPrimaryGoal] = useState<UserContext['primaryGoal']>(
    initialContext?.primaryGoal
  );
  const [timeHorizon, setTimeHorizon] = useState<UserContext['timeHorizon']>(
    initialContext?.timeHorizon
  );
  const [focusAreas, setFocusAreas] = useState<string[]>(initialContext?.focusAreas || []);
  const [focusInput, setFocusInput] = useState('');

  // Response format
  const [preferredFormat, setPreferredFormat] = useState<UserContext['preferredFormat']>(
    initialContext?.preferredFormat
  );
  const [includeExamples, setIncludeExamples] = useState<boolean>(
    initialContext?.includeExamples || false
  );
  const [includeCodeSnippets, setIncludeCodeSnippets] = useState<boolean>(
    initialContext?.includeCodeSnippets || false
  );
  const [citationDetail, setCitationDetail] = useState<UserContext['citationDetail']>(
    initialContext?.citationDetail
  );

  // Context and background
  const [industry, setIndustry] = useState(initialContext?.industry || '');
  const [companySize, setCompanySize] = useState<UserContext['companySize']>(
    initialContext?.companySize
  );

  // Localization
  const [language, setLanguage] = useState(initialContext?.language || '');
  const [region, setRegion] = useState(initialContext?.region || '');

  useEffect(() => {
    const saved = loadUserContext();
    if (saved) {
      setRole(saved.role || '');
      setCurrentRole(saved.currentRole || '');
      setLevel(saved.level);
      setTargetJob(saved.targetJob || '');
      setYearsOfExperience(saved.yearsOfExperience);
      setLearningPreferences(saved.learningPreferences || []);
      setCommunicationStyle(saved.communicationStyle);
      setTone(saved.tone);
      setTechnicalDepth(saved.technicalDepth);
      setExpertise(saved.expertise || []);
      setCurrentSkills(saved.currentSkills || []);
      setKnowledgeGaps(saved.knowledgeGaps || []);
      setPrimaryGoal(saved.primaryGoal);
      setTimeHorizon(saved.timeHorizon);
      setFocusAreas(saved.focusAreas || []);
      setPreferredFormat(saved.preferredFormat);
      setIncludeExamples(saved.includeExamples || false);
      setIncludeCodeSnippets(saved.includeCodeSnippets || false);
      setCitationDetail(saved.citationDetail);
      setIndustry(saved.industry || '');
      setCompanySize(saved.companySize);
      setLanguage(saved.language || '');
      setRegion(saved.region || '');
    }
  }, []);

  const handleSave = () => {
    const context: UserContext = {
      role: role || undefined,
      currentRole: currentRole || undefined,
      level: level || undefined,
      targetJob: targetJob || undefined,
      yearsOfExperience: yearsOfExperience !== undefined && yearsOfExperience > 0 ? yearsOfExperience : undefined,
      learningPreferences: learningPreferences.length > 0 ? learningPreferences : undefined,
      communicationStyle: communicationStyle || undefined,
      tone: tone || undefined,
      technicalDepth: technicalDepth || undefined,
      expertise: expertise.length > 0 ? expertise : undefined,
      currentSkills: currentSkills.length > 0 ? currentSkills : undefined,
      knowledgeGaps: knowledgeGaps.length > 0 ? knowledgeGaps : undefined,
      primaryGoal: primaryGoal || undefined,
      timeHorizon: timeHorizon || undefined,
      focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
      preferredFormat: preferredFormat || undefined,
      includeExamples: includeExamples || undefined,
      includeCodeSnippets: includeCodeSnippets || undefined,
      citationDetail: citationDetail || undefined,
      industry: industry || undefined,
      companySize: companySize || undefined,
      language: language || undefined,
      region: region || undefined,
    };
    saveUserContext(context);
    onContextChange?.(context);
  };

  const handleAddTag = (
    input: string,
    setInput: (value: string) => void,
    tags: string[],
    setTags: (tags: string[]) => void
  ) => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setInput('');
    }
  };

  const handleRemoveTag = (tag: string, tags: string[], setTags: (tags: string[]) => void) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    input: string,
    setInput: (value: string) => void,
    tags: string[],
    setTags: (tags: string[]) => void
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddTag(input, setInput, tags, setTags);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
        <CardDescription>
          Set your profile to personalize responses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Profile Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Basic Profile</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Software Engineer, Product Manager"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentRole">Current Role</Label>
              <Input
                id="currentRole"
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value)}
                placeholder="e.g., Senior Software Engineer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <div className="flex flex-wrap gap-2">
                {LEVEL_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={level === option.value ? 'default' : 'outline'}
                    onClick={() => setLevel(level === option.value ? undefined : (option.value as UserContext['level']))}
                    className="flex-1 min-w-[100px]"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetJob">Target Job</Label>
              <Input
                id="targetJob"
                value={targetJob}
                onChange={(e) => setTargetJob(e.target.value)}
                placeholder="e.g., Senior Software Engineer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="yearsOfExperience">Years of Experience</Label>
              <Input
                id="yearsOfExperience"
                type="number"
                min="0"
                value={yearsOfExperience || ''}
                onChange={(e) => setYearsOfExperience(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                placeholder="e.g., 5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="learningPreferences">Learning Preferences</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {LEARNING_PREFERENCE_OPTIONS.map((pref) => (
                  <Badge
                    key={pref}
                    variant={learningPreferences.includes(pref) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      if (!learningPreferences.includes(pref)) {
                        setLearningPreferences([...learningPreferences, pref]);
                      }
                    }}
                  >
                    {pref}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  id="learningPreferences"
                  value={preferenceInput}
                  onChange={(e) => setPreferenceInput(e.target.value)}
                  onKeyDown={(e) =>
                    handleKeyDown(e, preferenceInput, setPreferenceInput, learningPreferences, setLearningPreferences)
                  }
                  placeholder="Add custom preference (press Enter)"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    handleAddTag(preferenceInput, setPreferenceInput, learningPreferences, setLearningPreferences)
                  }
                  disabled={!preferenceInput.trim()}
                >
                  Add
                </Button>
              </div>
              {learningPreferences.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {learningPreferences.map((pref) => (
                    <Badge key={pref} variant="secondary" className="gap-1">
                      {pref}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(pref, learningPreferences, setLearningPreferences)}
                        className="ml-1 rounded-full hover:bg-muted"
                        aria-label={`Remove ${pref}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Communication Preferences Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Communication Preferences</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="communicationStyle">Communication Style</Label>
              <div className="flex flex-wrap gap-2">
                {COMMUNICATION_STYLE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={communicationStyle === option.value ? 'default' : 'outline'}
                    onClick={() => setCommunicationStyle(communicationStyle === option.value ? undefined : (option.value as UserContext['communicationStyle']))}
                    className="flex-1 min-w-[100px]"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone">Tone</Label>
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={tone === option.value ? 'default' : 'outline'}
                    onClick={() => setTone(tone === option.value ? undefined : (option.value as UserContext['tone']))}
                    className="flex-1 min-w-[100px]"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="technicalDepth">Technical Depth</Label>
              <div className="flex flex-wrap gap-2">
                {TECHNICAL_DEPTH_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={technicalDepth === option.value ? 'default' : 'outline'}
                    onClick={() => setTechnicalDepth(technicalDepth === option.value ? undefined : (option.value as UserContext['technicalDepth']))}
                    className="flex-1 min-w-[100px]"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Domain Expertise Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Domain Expertise</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expertise">Expertise</Label>
              <div className="flex gap-2">
                <Input
                  id="expertise"
                  value={expertiseInput}
                  onChange={(e) => setExpertiseInput(e.target.value)}
                  onKeyDown={(e) =>
                    handleKeyDown(e, expertiseInput, setExpertiseInput, expertise, setExpertise)
                  }
                  placeholder="Add expertise (press Enter)"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddTag(expertiseInput, setExpertiseInput, expertise, setExpertise)}
                  disabled={!expertiseInput.trim()}
                >
                  Add
                </Button>
              </div>
              {expertise.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {expertise.map((item) => (
                    <Badge key={item} variant="secondary" className="gap-1">
                      {item}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(item, expertise, setExpertise)}
                        className="ml-1 rounded-full hover:bg-muted"
                        aria-label={`Remove ${item}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentSkills">Current Skills</Label>
              <div className="flex gap-2">
                <Input
                  id="currentSkills"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  onKeyDown={(e) =>
                    handleKeyDown(e, skillsInput, setSkillsInput, currentSkills, setCurrentSkills)
                  }
                  placeholder="Add skill (press Enter)"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddTag(skillsInput, setSkillsInput, currentSkills, setCurrentSkills)}
                  disabled={!skillsInput.trim()}
                >
                  Add
                </Button>
              </div>
              {currentSkills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentSkills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="gap-1">
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(skill, currentSkills, setCurrentSkills)}
                        className="ml-1 rounded-full hover:bg-muted"
                        aria-label={`Remove ${skill}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="knowledgeGaps">Knowledge Gaps</Label>
              <div className="flex gap-2">
                <Input
                  id="knowledgeGaps"
                  value={gapsInput}
                  onChange={(e) => setGapsInput(e.target.value)}
                  onKeyDown={(e) =>
                    handleKeyDown(e, gapsInput, setGapsInput, knowledgeGaps, setKnowledgeGaps)
                  }
                  placeholder="Add knowledge gap (press Enter)"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddTag(gapsInput, setGapsInput, knowledgeGaps, setKnowledgeGaps)}
                  disabled={!gapsInput.trim()}
                >
                  Add
                </Button>
              </div>
              {knowledgeGaps.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {knowledgeGaps.map((gap) => (
                    <Badge key={gap} variant="secondary" className="gap-1">
                      {gap}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(gap, knowledgeGaps, setKnowledgeGaps)}
                        className="ml-1 rounded-full hover:bg-muted"
                        aria-label={`Remove ${gap}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Goals Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Goals & Objectives</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primaryGoal">Primary Goal</Label>
              <div className="flex flex-wrap gap-2">
                {PRIMARY_GOAL_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={primaryGoal === option.value ? 'default' : 'outline'}
                    onClick={() => setPrimaryGoal(primaryGoal === option.value ? undefined : (option.value as UserContext['primaryGoal']))}
                    className="flex-1 min-w-[120px]"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeHorizon">Time Horizon</Label>
              <div className="flex flex-wrap gap-2">
                {TIME_HORIZON_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={timeHorizon === option.value ? 'default' : 'outline'}
                    onClick={() => setTimeHorizon(timeHorizon === option.value ? undefined : (option.value as UserContext['timeHorizon']))}
                    className="flex-1 min-w-[100px]"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="focusAreas">Focus Areas</Label>
              <div className="flex gap-2">
                <Input
                  id="focusAreas"
                  value={focusInput}
                  onChange={(e) => setFocusInput(e.target.value)}
                  onKeyDown={(e) =>
                    handleKeyDown(e, focusInput, setFocusInput, focusAreas, setFocusAreas)
                  }
                  placeholder="Add focus area (press Enter)"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddTag(focusInput, setFocusInput, focusAreas, setFocusAreas)}
                  disabled={!focusInput.trim()}
                >
                  Add
                </Button>
              </div>
              {focusAreas.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {focusAreas.map((area) => (
                    <Badge key={area} variant="secondary" className="gap-1">
                      {area}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(area, focusAreas, setFocusAreas)}
                        className="ml-1 rounded-full hover:bg-muted"
                        aria-label={`Remove ${area}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Response Format Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Response Format</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preferredFormat">Preferred Format</Label>
              <div className="flex flex-wrap gap-2">
                {PREFERRED_FORMAT_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={preferredFormat === option.value ? 'default' : 'outline'}
                    onClick={() => setPreferredFormat(preferredFormat === option.value ? undefined : (option.value as UserContext['preferredFormat']))}
                    className="flex-1 min-w-[120px]"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="citationDetail">Citation Detail</Label>
              <div className="flex flex-wrap gap-2">
                {CITATION_DETAIL_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={citationDetail === option.value ? 'default' : 'outline'}
                    onClick={() => setCitationDetail(citationDetail === option.value ? undefined : (option.value as UserContext['citationDetail']))}
                    className="flex-1 min-w-[100px]"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeExamples"
                checked={includeExamples}
                onChange={(e) => setIncludeExamples(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="includeExamples" className="cursor-pointer">
                Include examples in responses
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeCodeSnippets"
                checked={includeCodeSnippets}
                onChange={(e) => setIncludeCodeSnippets(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="includeCodeSnippets" className="cursor-pointer">
                Include code snippets when relevant
              </Label>
            </div>
          </div>
        </div>

        {/* Context & Background Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Context & Background</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g., Technology, Healthcare, Finance"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companySize">Company Size</Label>
              <div className="flex flex-wrap gap-2">
                {COMPANY_SIZE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={companySize === option.value ? 'default' : 'outline'}
                    onClick={() => setCompanySize(companySize === option.value ? undefined : (option.value as UserContext['companySize']))}
                    className="flex-1 min-w-[100px]"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Localization Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Localization</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Input
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="e.g., en, es, fr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g., US, EU, APAC"
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full">
          Save Profile
        </Button>
      </CardContent>
    </Card>
  );
};
