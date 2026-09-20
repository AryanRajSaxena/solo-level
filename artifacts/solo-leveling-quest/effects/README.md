# Solo Leveling Quest — First-Time Onboarding

## Flow overview

```
App launch
  └─ Clerk signed in?
       ├─ No  → Sign-in screen
       └─ Yes → AsyncStorage check
                   ├─ First time → OnboardingScreen
                   │                 ├─ AWAKENING       typewriter [System] messages + purple orb
                   │                 ├─ NAME_ENTRY      hunter name input with gold underline
                   │                 ├─ RANK_ASSIGNED   E-Rank badge springs in
                   │                 ├─ STATS_REVEAL    STR / INT / STA / DIS bars animate
                   │                 └─ QUESTS_ASSIGNED preset quests slide in → Begin
                   └─ Returning → Main tabs
```

## Install dependencies

```bash
npx expo install react-native-reanimated moti expo-haptics @react-native-async-storage/async-storage
```

Add to `babel.config.js`:
```js
plugins: ['react-native-reanimated/plugin'],
```

## File structure

```
hooks/
  useFirstTimeUser.ts   ← AsyncStorage flag + hunter data init
  useTypewriter.ts      ← character-by-character text effect

components/
  OnboardingScreen.tsx  ← full 5-step screen (drop this in)

integration/
  app_layout_example.tsx ← how to wire into Expo Router _layout.tsx
```

## Drop-in usage

```tsx
// In your root _layout.tsx
import { OnboardingScreen } from './components/OnboardingScreen';
import { useFirstTimeUser }  from './hooks/useFirstTimeUser';

// Inside your root component:
const { isFirstTime, isLoading, completeOnboarding } = useFirstTimeUser();

if (isSignedIn && isFirstTime) {
  return (
    <OnboardingScreen
      onComplete={async (hunterName) => {
        await completeOnboarding(hunterName);
        router.replace('/(tabs)');
      }}
    />
  );
}
```

## Resetting onboarding (dev/testing)

```tsx
const { resetOnboarding } = useFirstTimeUser();
// Call this from a dev menu or settings screen:
await resetOnboarding();
```

## Customising

| Thing              | Where to change                              |
|--------------------|----------------------------------------------|
| Preset quests      | `PRESET_QUESTS` array in OnboardingScreen    |
| Starting stats     | `DEFAULT_HUNTER.stats` in useFirstTimeUser   |
| Colours            | `C` object at top of OnboardingScreen        |
| Typewriter speed   | `speed` param of `useTypewriter` calls       |
| System messages    | `MESSAGES` array in `AwakeningStep`          |
| Starting rank      | `DEFAULT_HUNTER.rank` (currently `'E'`)      |
