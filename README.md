# Spendwell

A private, local-first expense tracker for iPhone and desktop.

## Run it

Serve this folder over `http://localhost` or HTTPS, then open `index.html` in a browser. For iPhone, use Safari's **Add to Home Screen** action after opening the hosted app. IndexedDB stores expenses on the device, and the service worker keeps the app shell available offline after its first load.

Expense categories are inferred locally from the expense name and note using a small keyword classifier. No expense data or categorization request leaves the device. Use the export button to download a JSON backup.