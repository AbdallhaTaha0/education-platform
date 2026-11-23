import { EMPTY_SOURCE, type IDEMode, type SourceFiles } from '../../ide/types';
import { newProgram, type ProgramSettingsValue } from '../ProgramSettings';

export interface Check {
  type: string;
  selector?: string;
  name?: string;
  expected?: unknown;
  args?: unknown[];
  steps?: Array<{ action: string; selector: string; value?: string }>;
}

export interface ChoiceOption {
  id: string;
  textAr: string;
  textEn: string;
}

export interface Question {
  id: string;
  type: 'CODING' | 'CHOICE' | 'PROGRAM';
  program?: ProgramSettingsValue;
  titleAr: string;
  titleEn: string;
  starter?: SourceFiles;
  shareStarter?: boolean;
  checks?: Check[];
  choices?: ChoiceOption[];
  correctChoiceId?: string;
}

export interface Content {
  ide?: IDEMode;
  titleAr: string;
  titleEn: string;
  instructionsAr: string;
  instructionsEn: string;
  questions: Question[];
}

export interface Entry {
  id: string;
  lessonId: string;
  kind: string;
  required: boolean;
  draftRequired: boolean | null;
  status: string;
  content: Content;
  version: number;
}

export interface TransitionFeedback {
  id: string;
  message: string;
  kind: 'success' | 'error';
}

export const newQuestion = (
  type: 'CODING' | 'PROGRAM' = 'PROGRAM',
  mode: IDEMode = 'javascript',
): Question => ({
  id: crypto.randomUUID(),
  type,
  titleAr: '',
  titleEn: '',
  starter: {
    ...EMPTY_SOURCE,
    javascript: '',
    ...(mode === 'python' ? { python: '' } : {}),
  },
  shareStarter: false,
  ...(type === 'PROGRAM'
    ? { program: newProgram(mode) }
    : {
        checks:
          mode === 'web'
            ? [{ type: 'exists', selector: '#result' }]
            : [{ type: 'console', expected: '' }],
      }),
});

export function revisionSnapshot(entry: Entry): string {
  return JSON.stringify({
    content: entry.content,
    required: entry.draftRequired ?? entry.required,
    kind: entry.kind,
  });
}
