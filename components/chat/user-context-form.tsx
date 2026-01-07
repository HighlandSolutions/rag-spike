'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export const UserContextForm = ({
  onContextChange,
  initialContext,
}: UserContextFormProps) => {
  const [role, setRole] = useState(initialContext?.role || '');
  const [level, setLevel] = useState<UserContext['level']>(initialContext?.level);
  const [targetJob, setTargetJob] = useState(initialContext?.targetJob || '');
  const [learningPreferences, setLearningPreferences] = useState<string[]>(
    initialContext?.learningPreferences || []
  );
  const [preferenceInput, setPreferenceInput] = useState('');

  useEffect(() => {
    const saved = loadUserContext();
    if (saved) {
      setRole(saved.role || '');
      setLevel(saved.level);
      setTargetJob(saved.targetJob || '');
      setLearningPreferences(saved.learningPreferences || []);
    }
  }, []);

  const handleSave = () => {
    const context: UserContext = {
      role: role || undefined,
      level: level || undefined,
      targetJob: targetJob || undefined,
      learningPreferences: learningPreferences.length > 0 ? learningPreferences : undefined,
    };
    saveUserContext(context);
    onContextChange?.(context);
  };

  const handleAddPreference = () => {
    const trimmed = preferenceInput.trim();
    if (trimmed && !learningPreferences.includes(trimmed)) {
      setLearningPreferences([...learningPreferences, trimmed]);
      setPreferenceInput('');
    }
  };

  const handleRemovePreference = (preference: string) => {
    setLearningPreferences(learningPreferences.filter((p) => p !== preference));
  };

  const handleAddPreferenceFromList = (preference: string) => {
    if (!learningPreferences.includes(preference)) {
      setLearningPreferences([...learningPreferences, preference]);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddPreference();
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
      <CardContent className="space-y-4">
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
          <Label htmlFor="level">Level</Label>
          <Select
            value={level || ''}
            onValueChange={(value) => setLevel(value as UserContext['level'])}
          >
            <SelectTrigger id="level">
              <SelectValue placeholder="Select your level" />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Label htmlFor="learningPreferences">Learning Preferences</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {LEARNING_PREFERENCE_OPTIONS.map((pref) => (
              <Badge
                key={pref}
                variant={learningPreferences.includes(pref) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleAddPreferenceFromList(pref)}
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
              onKeyDown={handleKeyDown}
              placeholder="Add custom preference (press Enter)"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddPreference}
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
                    onClick={() => handleRemovePreference(pref)}
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

        <Button onClick={handleSave} className="w-full">
          Save Profile
        </Button>
      </CardContent>
    </Card>
  );
};

