import React from 'react';
import { QuestProvider } from './QuestContext';

export function QuestProviderRoot({ children }: { children: React.ReactNode }) {
  return <QuestProvider>{children}</QuestProvider>;
}