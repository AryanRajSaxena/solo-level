import React from 'react';
import { useRouter } from 'expo-router';
import { WalkingQuestScreen } from '@/components/WalkingQuestScreen';
import { useQuestContext } from '@/context/QuestContext';

export default function WalkQuestPage() {
  const router = useRouter();
  const { quests, completeQuest } = useQuestContext();

  const handleComplete = (_xpGained: number) => {
    // Find the walk quest (either by id 'walk_3km' or title containing walk)
    const walkQuest = quests.find(
      (q) => q.id === 'walk_3km' || q.id.endsWith('walk_3km') || q.title.toLowerCase().includes('walk')
    );
    if (walkQuest) {
      completeQuest(walkQuest.id);
    }
    router.back();
  };

  return (
    <WalkingQuestScreen
      onComplete={handleComplete}
      onBack={() => router.back()}
    />
  );
}
