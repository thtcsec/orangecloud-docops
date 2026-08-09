/**
 * Lightweight local smoke checklist helper.
 * Prefer the Vitest integration smoke test for automated coverage.
 */
console.log(`
OrangeCloud DocOps local smoke checklist
----------------------------------------
1. npm install
2. Copy .dev.vars.example -> .dev.vars
3. npm run db:migrate:local
4. npm run db:seed:local   (optional)
5. npm run dev
6. Open http://localhost:5173/dashboard
7. Upload tests/fixtures/synthetic-invoice.xml via /documents/upload (type invoice_xml)
8. Confirm document appears and moves toward NEEDS_REVIEW
9. Decide on /review and confirm /audit entries
10. Optional: create a case on /cases, paste case ID on upload

Automated coverage: npm test
`);
