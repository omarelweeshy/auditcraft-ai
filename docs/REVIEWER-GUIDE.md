# Reviewer guide

1. Follow README startup and sign in. The private workspace must reject unauthenticated API calls.
2. Open New audit. The URL is fixed to `https://fixture.auditcraft.test/`. Select homepage or four pages, confirm responsible use and run.
3. Follow Timeline. Inspect stage messages, attempts, captured page count and configured limits.
4. Open Review. Match a finding to its screenshot and visible evidence reference. Edit its explanation/notes, approve it, reject another, and view prior revisions. No generated finding starts approved.
5. Expand scoring details. Check a deduction against the Evidence explorer. Filter by page, category, severity, tool, confidence or finding usage.
6. Add a manual finding. It must reference saved evidence. Rerun creates another version; it does not overwrite existing review.
7. In Report, select approved findings, edit the summary, choose a screenshot and reorder sections. Finalize a report and wait for PDF READY. Inspect the HTML and download the PDF.
8. Edit/export the outreach draft. Confirm no email is sent. Inspect revision history.
9. Try the New audit failure options: a controlled first attempt retries automatically; explanation failure leaves raw evidence for manual review. Review the seeded failed example in Automation and use New version.
10. Compare the report snapshot before and after changing a source finding. It remains unchanged. See `output/` for independently generated verification artifacts.

The app is a functional local evidence/review/report workflow. It is not ready to audit real prospects: no live web transport or LLM provider has been enabled. `docs/VERIFICATION.md` states precisely what ran.
