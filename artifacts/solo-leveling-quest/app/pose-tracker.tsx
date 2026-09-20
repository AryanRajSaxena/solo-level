import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PoseTrackerScreen } from '@/components/PoseTrackerScreen';
import { useQuestContext } from '@/context/QuestContext';
import { ExerciseType } from '@/utils/poseDetection';

export default function PoseTrackerPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    exercise?: string;
    target?: string;
    questId?: string;
  }>();

  const exercise: ExerciseType = params.exercise === 'situps' ? 'situps' : 'pushups';
  const targetReps = params.target ? parseInt(params.target, 10) : (exercise === 'pushups' ? 20 : 20);

  const { quests, completeQuest, setQuestProgress } = useQuestContext();

  // Find corresponding quest in active quests
  const matchedQuest = quests.find(
    (q) =>
      q.id === params.questId ||
      (exercise === 'pushups' && (q.id.includes('pushup') || q.title.toLowerCase().includes('push-up') || q.title.toLowerCase().includes('pushup'))) ||
      (exercise === 'situps' && (q.id.includes('situp') || q.title.toLowerCase().includes('sit-up') || q.title.toLowerCase().includes('situp')))
  );

  const handleComplete = (finalReps: number) => {
    if (matchedQuest) {
      setQuestProgress(matchedQuest.id, finalReps);
      completeQuest(matchedQuest.id);
    }
    router.back();
  };

  return (
    <PoseTrackerScreen
      exercise={exercise}
      targetReps={matchedQuest ? matchedQuest.target : targetReps}
      questTitle={matchedQuest ? matchedQuest.title : (exercise === 'pushups' ? `${targetReps} Push-ups` : `${targetReps} Sit-ups`)}
      onComplete={handleComplete}
      onBack={() => router.back()}
    />
  );
}
