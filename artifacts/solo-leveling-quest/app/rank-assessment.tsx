import React from 'react';
import { useRouter } from 'expo-router';
import { RankAssessmentScreen } from '@/components/RankAssessmentScreen';
import { useQuestContext } from '@/context/QuestContext';
import { AssessmentResult } from '@/utils/assessmentEvaluation';

export default function RankAssessmentPage() {
  const router = useRouter();
  const { profile, completeAssessment } = useQuestContext();

  const handleComplete = (result: AssessmentResult) => {
    completeAssessment({
      rank: result.rank,
      level: result.level,
      stats: result.stats,
      title: result.title,
    });
    router.back();
  };

  return (
    <RankAssessmentScreen
      hunterName={profile.name}
      onComplete={handleComplete}
      onBack={() => router.back()}
    />
  );
}

