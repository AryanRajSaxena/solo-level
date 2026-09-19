/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#f4f8ff',
    tint: '#65d9ff',

    // Core surfaces
    background: '#070b13',
    foreground: '#f4f8ff',

    // Cards / elevated surfaces
    card: '#111827',
    cardForeground: '#f4f8ff',

    // Primary action color (buttons, links, active states)
    primary: '#65d9ff',
    primaryForeground: '#07111c',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#1a2940',
    secondaryForeground: '#dcecff',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#152238',
    mutedForeground: '#91a5c1',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#162e45',
    accentForeground: '#b9eeff',

    // Destructive actions (delete, error states)
    destructive: '#ff5470',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#223551',
    input: '#182940',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
