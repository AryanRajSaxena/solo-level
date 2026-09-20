import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen, SectionHeader } from '@/components/Screen';
import { useColors } from '@/hooks/useColors';
import { Quest, QuestCategory, useQuestContext } from '@/context/QuestContext';

const categoryMeta: Record<QuestCategory, { icon: keyof typeof Feather.glyphMap; color: string }> = {
  TRAINING: { icon: 'activity', color: '#ffb25c' },
  MIND: { icon: 'code', color: '#65d9ff' },
  DISCIPLINE: { icon: 'target', color: '#b693ff' },
  RECOVERY: { icon: 'moon', color: '#75e2b6' },
};

export default function QuestsScreen() {
  const colors = useColors();
  const { quests, activeQuests, completeQuest, setQuestProgress, addQuest, removeQuest, profile, todayKey } = useQuestContext();
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [reward, setReward] = useState<{ quest: Quest; levelUp: boolean; nextLevel: number } | null>(null);
  const [timer, setTimer] = useState<{ questId: string; startedAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!timer) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const claimCompletion = (quest: Quest) => {
    const alreadyComplete = quest.completedOn === todayKey || activeQuests.some((item) => item.id === quest.id && item.completedOn === todayKey);
    if (alreadyComplete) return;
    const levelUp = profile.xp + quest.xp >= profile.xpToNext;
    completeQuest(quest.id);
    setReward({ quest, levelUp, nextLevel: profile.level + (levelUp ? 1 : 0) });
  };

  const toggleTimer = (quest: Quest) => {
    if (timer?.questId === quest.id) {
      const elapsedMinutes = Math.floor((Date.now() - timer.startedAt) / 60000);
      setQuestProgress(quest.id, (quest.progress ?? 0) + elapsedMinutes);
      setTimer(null);
      return;
    }
    setTimer({ questId: quest.id, startedAt: Date.now() });
  };

  const saveQuest = () => {
    if (!title.trim()) return;
    addQuest({
      title: title.trim(),
      detail: detail.trim() || 'Custom daily objective',
      category: 'DISCIPLINE',
      target: 1,
      unit: 'set',
      xp: 25,
      stat: 'DISCIPLINE',
      weekdays: [1, 2, 3, 4, 5, 6, 0],
    });
    setTitle('');
    setDetail('');
    setModalVisible(false);
  };

  return (
    <Screen>
      <SectionHeader eyebrow="PROTOCOL // ALL QUESTS" title="Quest library" action="+ Add" onAction={() => setModalVisible(true)} />
      <Text style={[styles.helper, { color: colors.mutedForeground }]}>Tap a quest when the objective is complete. Custom quests are saved to your account.</Text>
      <View style={styles.chips}>
        <View style={[styles.chip, { backgroundColor: colors.accent, borderColor: colors.primary }]}>
          <Text style={[styles.chipText, { color: colors.primary }]}>{activeQuests.length} ACTIVE TODAY</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{quests.length} TOTAL</Text>
        </View>
      </View>
      {quests.map((quest) => {
        const meta = categoryMeta[quest.category];
        const completed = activeQuests.some((item) => item.id === quest.id && item.completedOn !== null);
        const progress = completed ? quest.target : Math.min(quest.target, quest.progress ?? 0);
        const progressPercent = Math.round((progress / quest.target) * 100);
        const isTiming = timer?.questId === quest.id;
        const elapsedSeconds = isTiming ? Math.floor((now - (timer?.startedAt ?? now)) / 1000) : 0;
        return (
          <View key={quest.id} style={[styles.card, { backgroundColor: colors.card, borderColor: completed ? colors.primary : colors.border }]}>
            <View style={[styles.icon, { backgroundColor: `${meta.color}20` }]}>
              <Feather name={meta.icon} size={19} color={meta.color} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.foreground }]}>{quest.title}</Text>
              <Text style={[styles.detail, { color: colors.mutedForeground }]}>{quest.detail} · {quest.target} {quest.unit}</Text>
              {!completed ? <>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressText, { color: colors.mutedForeground }]}>{progress} / {quest.target} {quest.unit}</Text>
                  <View style={styles.progressControls}>
                    <Pressable onPress={() => setQuestProgress(quest.id, progress - 1)} hitSlop={6}><Feather name="minus-circle" size={17} color={colors.mutedForeground} /></Pressable>
                    <Pressable onPress={() => setQuestProgress(quest.id, progress + 1)} hitSlop={6}><Feather name="plus-circle" size={17} color={colors.primary} /></Pressable>
                  </View>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}><View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: meta.color }]} /></View>
                {quest.unit === 'min' ? <Pressable onPress={() => toggleTimer(quest)} style={[styles.timerButton, { borderColor: isTiming ? colors.primary : colors.border }]}><Feather name={isTiming ? 'square' : 'play'} size={11} color={colors.primary} /><Text style={[styles.timerText, { color: colors.primary }]}>{isTiming ? `STOP ${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}` : 'START TIMER'}</Text></Pressable> : null}
              </> : null}
              <View style={styles.metaLine}>
                <Text style={[styles.category, { color: meta.color }]}>{quest.category}</Text>
                <Text style={[styles.xp, { color: colors.primary }]}>+{quest.xp} XP / {quest.stat}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                testID={`complete-${quest.id}`}
                onPress={() => claimCompletion(quest)}
                style={[styles.check, { borderColor: completed ? colors.primary : colors.border, backgroundColor: completed ? colors.primary : 'transparent' }]}
              >
                {completed ? <Feather name="check" color={colors.primaryForeground} size={14} /> : null}
              </Pressable>
              {quest.isCustom ? (
                <Pressable onPress={() => removeQuest(quest.id)} hitSlop={8}>
                  <Feather name="trash-2" color={colors.mutedForeground} size={15} />
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalEyebrow, { color: colors.primary }]}>CUSTOM QUEST</Text>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add to the protocol</Text>
              </View>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={8}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
            </View>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>QUEST NAME</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Read 20 pages" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]} />
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>DETAIL</Text>
            <TextInput value={detail} onChangeText={setDetail} placeholder="Optional description" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]} />
            <Pressable onPress={saveQuest} disabled={!title.trim()} style={[styles.saveButton, { backgroundColor: colors.primary }, !title.trim() && styles.disabled]}>
              <Text style={[styles.saveText, { color: colors.primaryForeground }]}>ADD QUEST</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(reward)} transparent animationType="fade" onRequestClose={() => setReward(null)}>
        <View style={styles.rewardBackdrop}>
          <View style={[styles.rewardCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <View style={[styles.rewardIcon, { backgroundColor: colors.accent, borderColor: colors.primary }]}>
              <Feather name={reward?.levelUp ? 'award' : 'check'} size={28} color={colors.primary} />
            </View>
            <Text style={[styles.rewardEyebrow, { color: colors.primary }]}>{reward?.levelUp ? 'SYSTEM // LEVEL UP' : 'SYSTEM // QUEST CLEARED'}</Text>
            <Text style={[styles.rewardTitle, { color: colors.foreground }]}>{reward?.levelUp ? `LEVEL ${reward.nextLevel} REACHED` : reward?.quest.title}</Text>
            <Text style={[styles.rewardCopy, { color: colors.mutedForeground }]}>
              {reward?.levelUp ? 'Your rank evaluation draws closer. Your attributes have increased.' : `+${reward?.quest.xp ?? 0} XP · +1 ${reward?.quest.stat ?? ''}`}
            </Text>
            <Pressable onPress={() => setReward(null)} style={[styles.rewardButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.saveText, { color: colors.primaryForeground }]}>ACKNOWLEDGE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  helper: { fontSize: 13, lineHeight: 20, marginTop: -4, marginBottom: 16 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 17, padding: 13, marginBottom: 9 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  copy: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700' },
  detail: { fontSize: 11, marginTop: 4 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  progressText: { fontSize: 11, fontWeight: '600' },
  progressControls: { flexDirection: 'row', gap: 8 },
  progressTrack: { height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  timerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 8 },
  timerText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  category: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  xp: { fontSize: 10, fontWeight: '700' },
  actions: { alignItems: 'center', gap: 12, marginLeft: 10 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000099' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  modalEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  modalTitle: { fontSize: 23, fontWeight: '800', marginTop: 7 },
  inputLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 12, height: 50, paddingHorizontal: 13, marginBottom: 15, fontSize: 14 },
  saveButton: { height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  saveText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  disabled: { opacity: 0.45 },
  rewardBackdrop: { flex: 1, backgroundColor: '#000000b8', justifyContent: 'center', padding: 24 },
  rewardCard: { borderWidth: 1, borderRadius: 24, padding: 24, alignItems: 'center' },
  rewardIcon: { width: 67, height: 67, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rewardEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginTop: 20 },
  rewardTitle: { fontSize: 21, fontWeight: '900', textAlign: 'center', marginTop: 10 },
  rewardCopy: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  rewardButton: { width: '100%', height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
});
