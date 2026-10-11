# Reports and outreach

Finalization requires at least one selected APPROVED finding. A transaction locks the audit, verifies every finding and evidence reference, and copies the prospect, approved findings, full evidence ledger, captures, branding, scoring weights, summary and section order. The report row and stored HTML are immutable. A separate artifact record tracks PDF processing.

The cover uses a selected recorded screenshot, embedded as a data URI for PDF generation. PDF Chromium is offline. Every dynamic string is HTML-escaped. The report includes page numbers, version, dates, lab conditions and disclaimer. Evidence IDs are shortened visually but complete in the snapshot. Fixture links identify the synthetic origin and are not publicly resolvable client sites.

The score and deduction ledger include raw observations regardless of whether their proposed finding was rejected. Only approved interpretations enter the findings section. Strengths are deterministic passed observations. Templates are labeled; manual reviewer notes and assumptions remain separate.

Generated outreach references at most two approved findings from the chosen immutable report. Editing inserts a new revision and exporting records a timestamp. Manual prose requires human validation. No email transport exists.

Visual verification: use Poppler to render every page of `output/pdf/auditcraft-sample-proposal.pdf`; inspect the rendered pages for clipping, orphaned headings, tables, pagination and screenshot scaling. File creation alone does not prove layout quality. The PDF is not a tagged accessible-PDF deliverable.
