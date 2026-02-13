// Minimal polyfills for browser libraries expecting Node globals.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as any;
if (typeof win.global === 'undefined') {
  win.global = win;
}
if (typeof win.process === 'undefined') {
  win.process = { env: {} };
}
