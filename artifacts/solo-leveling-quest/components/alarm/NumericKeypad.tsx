import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface NumericKeypadProps {
  onPressDigit: (digit: string) => void;
  onPressDelete: () => void;
  onPressClear: () => void;
  disabled?: boolean;
}

export const NumericKeypad = ({
  onPressDigit,
  onPressDelete,
  onPressClear,
  disabled = false,
}: NumericKeypadProps) => {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['CLEAR', '0', 'DEL'],
  ];

  return (
    <View style={styles.grid}>
      {keys.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((k) => {
            const isDel = k === 'DEL';
            const isClear = k === 'CLEAR';

            return (
              <TouchableOpacity
                key={k}
                activeOpacity={0.7}
                disabled={disabled}
                style={[
                  styles.keyBtn,
                  isDel && styles.delBtn,
                  isClear && styles.clearBtn,
                  disabled && styles.disabledBtn,
                ]}
                onPress={() => {
                  if (isDel) onPressDelete();
                  else if (isClear) onPressClear();
                  else onPressDigit(k);
                }}
              >
                {isDel ? (
                  <Feather name="delete" size={20} color="#ff8e3c" />
                ) : isClear ? (
                  <Text style={styles.clearText}>CLR</Text>
                ) : (
                  <Text style={styles.digitText}>{k}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  keyBtn: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 178, 92, 0.3)',
    backgroundColor: 'rgba(16, 20, 32, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  delBtn: {
    borderColor: 'rgba(255, 142, 60, 0.4)',
    backgroundColor: 'rgba(255, 142, 60, 0.08)',
  },
  clearBtn: {
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  digitText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffb25c',
    letterSpacing: 1,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1.5,
  },
});

