import { PortfolioNoteKinds, type PortfolioNoteKind } from '@my-hub/shared/constants';

export const NOTE_KIND_LABELS: Record<PortfolioNoteKind, string> = {
  [PortfolioNoteKinds.Note]: 'Note',
  [PortfolioNoteKinds.Decision]: 'Decision',
  [PortfolioNoteKinds.Lesson]: 'Lesson',
  [PortfolioNoteKinds.Idea]: 'Idea',
};
