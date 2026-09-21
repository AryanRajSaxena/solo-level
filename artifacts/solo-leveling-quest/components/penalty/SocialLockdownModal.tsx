import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  RESTRICTED_APPS,
  RestrictedApp,
  getRemainingLockdownTime,
  attemptLaunchRestrictedApp,
  playViolationAlertSound,
} from '@/utils/socialAppLockdown';

interface SocialLockdownModalProps {
  visible: boolean;
  onClose: () => void;
  lockdownUntil: number | null;
  onClearPenalty: () => void;
  onStartAtonement?: () => void;
}

export function SocialLockdownModal({
  visible,
  onClose,
  lockdownUntil,
  onClearPenalty,
  onStartAtonement,
}: SocialLockdownModalProps) {
  const colors = useColors();
  const [remaining, setRemaining] = useState(() => getRemainingLockdownTime(lockdownUntil));
  const [violationTarget, setViolationTarget] = useState<RestrictedApp | null>(null);

  // Live countdown timer ticking every 1s
  useEffect(() => {
    if (!visible) return;
    setRemaining(getRemainingLockdownTime(lockdownUntil));

    const interval = setInterval(() => {
      const next = getRemainingLockdownTime(lockdownUntil);
      setRemaining(next);
      if (next.isExpired) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, lockdownUntil]);

  const handleAppPress = async (app: RestrictedApp) => {
    const isLocked = !remaining.isExpired;
    await attemptLaunchRestrictedApp(app, isLocked, () => {
      setViolationTarget(app);
    });
  };

  const handleConfirmDispel = () => {
    Alert.alert(
      'System Override Confirmation',
      'Are you sure you want to dispel the System Penalty early? This will unseal all social and commercial portals.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DISPEL PENALTY',
          style: 'destructive',
          onPress: () => {
            onClearPenalty();
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.container, { backgroundColor: '#090b10', borderColor: '#ff2a55' }]}>
          {/* SYSTEM RED GATE HEADER */}
          <View style={styles.header}>
            <View style={styles.headerBadge}>
              <View style={styles.pulsingDot} />
              <Text style={styles.headerBadgeText}>SYSTEM DIRECTIVE // PENALTY PROTOCOL</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Feather name="x" size={20} color="#ff8599" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* SURVIVAL COUNTDOWN BANNER */}
            <View style={styles.countdownCard}>
              <View style={styles.countdownHeader}>
                <Feather name="alert-octagon" size={22} color="#ff2a55" />
                <Text style={styles.countdownLabel}>SURVIVAL TIMER // TIME REMAINING</Text>
              </View>
              <Text style={styles.timerDisplay}>
                {remaining.isExpired ? '00:00:00' : remaining.formatted}
              </Text>
              <Text style={styles.countdownSub}>
                {remaining.isExpired
                  ? '[PENALTY EXPIRED] System lockdown lifted. Re-engagement authorized.'
                  : 'Distraction portals sealed by the Architect until daily quota atonement is achieved.'}
              </Text>
            </View>

            {/* SEALED DISTRACTION PORTALS SECTION */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Feather name="lock" size={15} color="#ff2a55" />
                <Text style={styles.sectionTitle}>SEALED DISTRACTION PORTALS</Text>
                <View style={styles.countTag}>
                  <Text style={styles.countTagText}>{RESTRICTED_APPS.length} SEALED</Text>
                </View>
              </View>
              <Text style={styles.sectionSubtitle}>
                Social feeds, short-form reels, and shopping portals are intercepted while the penalty remains active.
              </Text>

              <View style={styles.appsGrid}>
                {RESTRICTED_APPS.map((app) => {
                  const isLocked = !remaining.isExpired;
                  return (
                    <Pressable
                      key={app.id}
                      onPress={() => void handleAppPress(app)}
                      style={({ pressed }) => [
                        styles.appCard,
                        {
                          borderColor: isLocked ? '#ff2a55' : 'rgba(0, 229, 255, 0.4)',
                          backgroundColor: pressed
                            ? 'rgba(255, 42, 85, 0.2)'
                            : isLocked
                            ? 'rgba(255, 42, 85, 0.06)'
                            : 'rgba(0, 229, 255, 0.05)',
                        },
                      ]}
                    >
                      <View style={styles.appCardHeader}>
                        <View style={[styles.appIconWrap, { backgroundColor: `${app.accentColor}22` }]}>
                          <Feather name={app.featherIcon as unknown as any} size={18} color={app.accentColor} />
                        </View>
                        <View style={[styles.statusPill, { borderColor: isLocked ? '#ff2a55' : '#00e5ff' }]}>
                          <Feather name={isLocked ? 'lock' : 'unlock'} size={10} color={isLocked ? '#ff2a55' : '#00e5ff'} />
                          <Text style={[styles.statusPillText, { color: isLocked ? '#ff2a55' : '#00e5ff' }]}>
                            {isLocked ? 'SEALED' : 'OPEN'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.appName}>{app.name}</Text>
                      <Text style={styles.appDesc} numberOfLines={1}>{app.description}</Text>
                      <Text style={styles.appPkg} numberOfLines={1}>{app.packageName}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ATONEMENT & PENALTY REDEMPTION */}
            <View style={styles.atonementCard}>
              <View style={styles.atonementHeader}>
                <Feather name="zap" size={16} color="#00e5ff" />
                <Text style={styles.atonementTitle}>TRIAL OF ATONEMENT // EARLY RELEASE</Text>
              </View>
              <Text style={styles.atonementBody}>
                The System allows Hunters to break the lockdown early by demonstrating physical resolve. Complete an emergency trial or invoke administrator dispel.
              </Text>

              {onStartAtonement ? (
                <Pressable
                  onPress={() => {
                    onClose();
                    onStartAtonement();
                  }}
                  style={styles.atonementBtn}
                >
                  <Feather name="activity" size={16} color="#0b0e14" />
                  <Text style={styles.atonementBtnText}>COMMENCE EMERGENCY ATONEMENT</Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={handleConfirmDispel}
                style={styles.dispelBtn}
              >
                <Feather name="shield-off" size={14} color="#ff8599" />
                <Text style={styles.dispelBtnText}>EMERGENCY SYSTEM DISPEL (ADMIN OVERRIDE)</Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.footerBtn}>
              <Text style={styles.footerBtnText}>RETURN TO HUNTER HUD</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ACCESS VIOLATION ALERT MODAL */}
      {violationTarget ? (
        <Modal
          visible={Boolean(violationTarget)}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setViolationTarget(null)}
        >
          <View style={styles.violationBackdrop}>
            <View style={styles.violationCard}>
              <View style={styles.violationIconBadge}>
                <Feather name="alert-triangle" size={32} color="#ff2a55" />
              </View>
              <Text style={styles.violationTitle}>[SYSTEM VIOLATION DETECTED]</Text>
              <Text style={styles.violationSub}>ACCESS DENIED: {violationTarget.name.toUpperCase()}</Text>
              <Text style={styles.violationBody}>
                Portal connection to {violationTarget.name} ({violationTarget.packageName}) has been blocked by the Architect.
                {'\n\n'}
                Penalty countdown: {remaining.formatted} remaining.
              </Text>
              <Pressable
                onPress={() => setViolationTarget(null)}
                style={styles.violationDismissBtn}
              >
                <Text style={styles.violationDismissText}>ACKNOWLEDGE DIRECTIVE</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 42, 85, 0.2)',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff2a55',
  },
  headerBadgeText: {
    color: '#ff2a55',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 42, 85, 0.1)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    gap: 18,
  },
  countdownCard: {
    backgroundColor: 'rgba(255, 42, 85, 0.1)',
    borderWidth: 1.5,
    borderColor: '#ff2a55',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  countdownLabel: {
    color: '#ff8599',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  timerDisplay: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 3,
    marginVertical: 6,
    textShadowColor: '#ff2a55',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  countdownSub: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 1,
    flex: 1,
  },
  countTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 42, 85, 0.2)',
    borderWidth: 1,
    borderColor: '#ff2a55',
  },
  countTagText: {
    color: '#ff2a55',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  sectionSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    lineHeight: 16,
  },
  appsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  appCard: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1.2,
    padding: 12,
  },
  appCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  statusPillText: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '800',
  },
  appName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  appDesc: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    marginBottom: 4,
  },
  appPkg: {
    color: 'rgba(255, 42, 85, 0.7)',
    fontSize: 9,
    fontFamily: 'monospace',
  },
  atonementCard: {
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  atonementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  atonementTitle: {
    color: '#00e5ff',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 0.8,
  },
  atonementBody: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    lineHeight: 18,
  },
  atonementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00e5ff',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  atonementBtnText: {
    color: '#0b0e14',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 0.8,
  },
  dispelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 42, 85, 0.4)',
    backgroundColor: 'rgba(255, 42, 85, 0.08)',
  },
  dispelBtnText: {
    color: '#ff8599',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#090b10',
  },
  footerBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  violationBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  violationCard: {
    backgroundColor: '#120509',
    borderWidth: 2,
    borderColor: '#ff2a55',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  violationIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 42, 85, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  violationTitle: {
    color: '#ff2a55',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: 'center',
  },
  violationSub: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  violationBody: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  violationDismissBtn: {
    backgroundColor: '#ff2a55',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  violationDismissText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});
