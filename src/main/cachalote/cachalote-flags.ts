// Cachalote updates via cachalote-sync; Squirrel.Mac rejects upstream's Developer ID builds on an ad-hoc app.
// Typed as boolean, not `true`, so code behind the guard is not flagged unreachable.
export const CACHALOTE_AUTO_UPDATE_DISABLED: boolean = true

// Visible name only: app.name stays 'Orca' because userData and the safeStorage keychain entry derive from it.
export const CACHALOTE_APP_NAME = 'Cachalote'
