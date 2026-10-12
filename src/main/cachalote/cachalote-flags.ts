// Cachalote updates via cachalote-sync; Squirrel.Mac rejects upstream's Developer ID builds on an ad-hoc app.
// Off under vitest so upstream's updater suites keep exercising the code this flag only bypasses at runtime.
export const CACHALOTE_AUTO_UPDATE_DISABLED: boolean = process.env.VITEST !== 'true'
