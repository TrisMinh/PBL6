# Execution contract — SRS template distillation

## Reference

- Retained reference: `C:\Users\minht\OneDrive\Desktop\PBL6\579126340-Tai-liệu-SRS-Mau-1.docx`
- SHA-256: `548477a2408267f9d30323a42774e0e262e6bf2b4665ed892c043cffbdb523b0`
- Cached document properties: 9 pages, 1,138 words, 6,489 characters.
- Structure evidence: `.work-srs/template-inspection.json`, `.work-srs/template-style-evidence.json`.
- Render status: canonical LibreOffice renderer unavailable because `soffice` is not installed; Microsoft Word opened the retained copy but PDF export did not complete within the automation timeout. Structural and cached-page evidence therefore controls the build until final render QA.

## Page system

- One portrait section, US Letter 8.50 × 11.00 inches.
- Margins: 1.00 inch on every side; usable text width 6.50 inches / 9,360 DXA.
- Header and footer distances: 0.50 inch. No distinct first/odd/even-page treatment.
- Source has two explicit page breaks and eight cached rendered-page breaks.
- New document may add explicit front-matter and chapter page breaks while preserving page size, margins, and basic header/footer distances.

## Typography and hierarchy

- Base family: Times New Roman. Normal style uses 1.15 line spacing and 10 pt after paragraphs; body content in the generated SRS will resolve the unspecified source size to 11 pt.
- Heading 1: source-derived blue `#2E74B5`, 14 pt, bold, 24 pt before, 0 pt after, keep with next.
- Heading 2: source-derived light blue `#5B9BD5`, 13 pt, bold, 10 pt before, 0 pt after, keep with next.
- Heading 3: bold, black, 11 pt, 10 pt before, 0 pt after, keep with next.
- The source uses direct formatting for a centered cover and several custom title roles. The new cover may reproduce those roles with named styles; body content must use real Heading 1/2/3 styles.
- List Paragraph source indent is 0.50 inch. Generated bullets and numbers must use Word numbering definitions rather than typed markers.

## Lists and tables

- Retained reference contains 11 tables: approval/signature, change history, glossary, references, function list, UI mockup placeholders, field specification, and process steps.
- New document retains the same front-matter component types and reuses the same functional-specification pattern where appropriate.
- All generated tables use fixed DXA geometry. `tblW`, `tblInd`, `tblGrid`, and each `tcW` must agree; table indent is 120 DXA and cell margins are 80/80/120/120 DXA.
- Header rows repeat, use restrained blue fill, and are marked as table headers. Rows expand automatically; no fixed row heights.

## Components

- Cover: project name, document type, project code, version, date/location.
- Approval table: preparer, reviewer, approver placeholders.
- Change log: effective date, action, editor, change description, version.
- Automatic Word table of contents derived from Heading 1–3.
- Main content progression: introduction → overview/context → business processes/rules/use cases → functional/state/data/UI/quality requirements → architecture/interfaces/recovery → acceptance/traceability → diagram appendices.
- Figures use centered source PNGs with captions; the diagram library is preserved as an appendix-quality visual specification.
- Header: short document title. Footer: classification/version and PAGE/NUMPAGES fields.

## Slot map

- The reference body is a pedagogical placeholder and may be replaced completely.
- Preserve and adapt the cover, approval, revision-history, glossary, reference, TOC, functional-specification, UI, and non-functional section patterns.
- Replace all sample-project prose, sample screenshots, empty placeholders, and example “Quên mật khẩu” content.
- Populate from `docs/srs/**/*.md`, with `SOFTWARE REQUIREMENTS SPECIFICATION (SRS).md` used only as a supplementary consistency source.
- Use images from `.qa/final-all/**/*.png`; do not use the lower-resolution `.qa/manual` variants.

## Package preservation

- Preserve the retained file byte-for-byte; build only from a working copy and save to a different final path.
- Preserve source styles/theme/numbering/header-footer infrastructure when useful. It is permitted to replace `word/document.xml` body content and add relationships/media for the new SRS.
- Source media and unused relationships may remain in the working package; the final build must not modify the retained reference.

## Fidelity and delivery gates

- Verify retained SHA-256 before and after authoring.
- Audit final section geometry, headings, fields, accessibility, tables, and image relationships.
- Final document must contain complete modular SRS content, stable IDs, all key matrices/tables, and the full set of approved diagrams.
- Render final DOCX to page PNGs and inspect every page. If canonical renderer remains unavailable, use Microsoft Word PDF export plus PNG rasterization; if that also fails, disclose the fallback explicitly.
- No clipped text, broken Vietnamese glyphs, split captions, overlapping figures, malformed tables, or unexplained blank pages.
