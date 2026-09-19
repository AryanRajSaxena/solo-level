import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen, SectionHeader } from '@/components/Screen';
import { useColors } from '@/hooks/useColors';
import { QuestCategory, useQuestContext } from '@/context/QuestContext';

const categoryMeta: Record<QuestCategory, { icon: keyof typeof Feather.glyphMap; color: string }> = {
  TRAINING: { icon: 'activity', color: '#ffb25c' },
  MIND: { icon: 'code', color: '#65d9ff' },
  DISCIPLINE: { icon: 'target', color: '#b693ff' },
  RECOVERY: { icon: 'moon', color: '#75e2b6' },
};

export default function QuestsScreen() {
  const colors = useColors();
  const { quests, activeQuests, completeQuest, addQuest, removeQuest } = useQuestContext();
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');

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
        return (
          <View key={quest.id} style={[styles.card, { backgroundColor: colors.card, borderColor: completed ? colors.primary : colors.border }]}>
            <View style={[styles.icon, { backgroundColor: `${meta.color}20` }]}>
              <Feather name={meta.icon} size={19} color={meta.color} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.foreground }]}>{quest.title}</Text>
              <Text style={[styles.detail, { color: colors.mutedForeground }]}>{quest.detail} · {quest.target} {quest.unit}</Text>
              <View style={styles.metaLine}>
                <Text style={[styles.category, { color: meta.color }]}>{quest.category}</Text>
                <Text style={[styles.xp, { color: colors.primary }]}>+{quest.xp} XP / {quest.stat}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                testID={`complete-${quest.id}`}
                onPress={() => completeQuest(quest.id)}
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
});