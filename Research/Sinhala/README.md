# Akshara — Sinhala research

## Folders
- `data/01_raw` — original scans. Read-only; never edit.
- `data/02_intermediate` — registered pages, ink masks.
- `data/03_processed` — normalised paragraph images (what raters and the model see).
- `data/04_annotations` — ratings and weak-region annotations.
- `data/05_final` — final dataset splits for training and evaluation.
- `templates/` — collection form template / box geometry.
- `notebooks/` — 01 preprocessing → 06 evaluation.
- `src/` — reusable code moved out of notebooks.
- `configs/` — pipeline settings (e.g. `display_v1`).
- `results/` — figures, tables, metrics.

## Display rules (display_v1)
- Normalise: page registration, box/template removal, white background, soft-black ink, fixed crop frame, no participant code.
- Do not change the writing: no hard binarisation, deskewing lines, slant/size fixes, stroke thickening/thinning, or removal of crossings-out.
- Freeze the version before the rating pilot; pilot and main study use the same version.

## Raw data notes (data/01_raw)
- 220 scans copied from `Data Collection/Sinhala-Scans`, renamed `SI-001.png` … `SI-220.png` in scan order. Originals unchanged.
- SI-015 / SI-016: scanned out of order; named by the code written on the page (SI-015 = IMG_20261107_0016, SI-016 = IMG_20261107_0015).
- SI-079 (IMG_20261119_0079): code box blank; ID assigned by scan order. Check against the consent sheet.
- SI-115 (IMG_20261120_0115): code box reads "118" (SI-118 is a different writer); ID assigned by scan order. Check against the consent sheet.
