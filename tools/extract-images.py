#!/usr/bin/env python3
"""
Extract embedded images from the ELWIS SBF-See AND SBF-Binnen PDFs and
associate each image with its catalogue question by vertical position on the
page.

Output:
- See images written to data/images/ as qNNN[-slot].png
- Binnen images written to data/images/ as bNNN[-slot].png (NNN is the ELWIS
  displayId, so b073..b253 for Binnen-specific, b254..b300 for Segeln)
- data/catalogue.official.json is updated: each question that has at least one
  image gets an `images: ['qNNN.png', ...]` or `['bNNN.png', ...]` field.

Image-to-catalogue-id mapping:
  See PDF   n (1..300)        -> catalogue id n       (nav templates 286..300)
  Binnen    n (1..72, Basis)  -> SKIPPED (Basis is sourced from See pass)
  Binnen    n (73..253)        -> catalogue id 1000 + n (binnen-specific)
  Binnen    n (254..300)       -> catalogue id 2000 + n (segeln-specific)

Run after import-elwis.py (which produces the catalogue). Idempotent.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import fitz  # type: ignore
except ImportError:
    sys.stderr.write("pymupdf not installed. Run: python3 -m pip install --user pymupdf\n")
    sys.exit(2)


ROOT = Path(__file__).resolve().parent.parent
SEE_PDF = ROOT / "data" / "raw" / "elwis-see-2023.pdf"
BINNEN_PDF = ROOT / "data" / "raw" / "elwis-binnen-2023.pdf"
CATALOGUE = ROOT / "data" / "catalogue.official.json"
IMAGES_DIR = ROOT / "data" / "images"

# Questions we SKIP associating (images are decorative / headers / etc).
MIN_DIM = 15            # ignore glyphs smaller than this on both axes
# Image-reference heuristic: text patterns that strongly indicate the
# question depends on a visual. Narrow stripes are KEPT only for Qs that
# clearly need a visual (sound-signal glyphs, Morse/light patterns).
IMAGE_REF_PATTERNS = re.compile(
    r"folgend|folgende|dieses|diese Lichter|diese Tonne|diese Flagge|"
    r"dieses Signal|dieses Schifffahrtszeichen|nachstehend|abgebildet|"
    r"Signalkörper|Welches Fahrzeug führt|Schallsignal|Sie hören|"
    r"folgend\w+ Ton|einen langen Ton|Kennung|Isobar",
    re.IGNORECASE,
)
# Banner shape: very wide + very short. The ELWIS logo and section
# dividers all land here.
BANNER_ASPECT = 2.3
BANNER_MAX_HEIGHT = 60


def find_question_positions(page) -> list[tuple[int, float]]:
    """
    Return (question_number, y_top) for each question whose number appears
    as its own text span on this page. Uses PyMuPDF 'dict' extraction.
    """
    positions: list[tuple[int, float]] = []
    tp = page.get_text("dict")
    for block in tp["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                txt = span["text"].strip()
                m = re.match(r"^(\d{1,3})\.\s", txt)
                if not m:
                    continue
                n = int(m.group(1))
                if 1 <= n <= 300:
                    positions.append((n, span["bbox"][1]))
    positions.sort(key=lambda p: p[1])
    return positions


def associate_images(doc) -> dict[int, list[tuple[int, int, bytes, int, int]]]:
    """
    For each page, pair images to the nearest question above them.
    Returns: question_id -> list of (xref, image_index_on_page, image_bytes, width, height).
    """
    out: dict[int, list[tuple[int, int, bytes, int, int]]] = {}
    # Also carry forward: a question that spans a page boundary still gets
    # an image on the next page if there's no earlier question on that page.
    last_question_on_prev_page: int | None = None

    for page_idx, page in enumerate(doc):
        q_positions = find_question_positions(page)
        images = page.get_images(full=True)
        if not images:
            # update rolling pointer: find last question that started here
            if q_positions:
                last_question_on_prev_page = q_positions[-1][0]
            continue

        img_entries = []
        for i, img in enumerate(images):
            xref = img[0]
            width, height = img[2], img[3]
            try:
                bbox = page.get_image_bbox(img)
            except Exception:
                continue
            y_top = bbox.y0
            # Filter decorative micro-glyphs (unless specifically a sound signal mark)
            # Decorative = tiny AND flat aspect. Keep horizontal stripes for sound-signal Qs.
            if width < MIN_DIM and height < MIN_DIM:
                continue
            img_entries.append((i, xref, y_top, width, height))

        if not img_entries:
            if q_positions:
                last_question_on_prev_page = q_positions[-1][0]
            continue

        # Pair each image with the nearest question whose y_top is above it.
        for i, xref, y, w, h in img_entries:
            candidate_q: int | None = None
            for n, qy in q_positions:
                if qy < y:
                    candidate_q = n
                else:
                    break
            if candidate_q is None:
                candidate_q = last_question_on_prev_page
            if candidate_q is None:
                continue
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.alpha or pix.n > 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                data = pix.tobytes("png")
            except Exception as exc:
                sys.stderr.write(f"skip xref {xref}: {exc}\n")
                continue
            out.setdefault(candidate_q, []).append((xref, i, data, w, h))

        if q_positions:
            last_question_on_prev_page = q_positions[-1][0]

    return out


def _process_pdf(
    pdf_path: Path,
    catalogue: dict,
    text_by_id: dict[int, str],
    *,
    filename_prefix: str,
    pdf_id_to_catalogue_id,  # callable: int -> int | None  (None = skip this pdf-id)
    pdf_id_to_display_id,    # callable: int -> int         (for filename numbering)
) -> dict:
    """Pair images in one PDF to catalogue questions and write them out."""
    doc = fitz.open(pdf_path)
    assoc = associate_images(doc)

    counts = {"questions_with_images": 0, "images_written": 0, "banners_dropped": 0}

    questions = catalogue["questions"]
    nav_templates = catalogue.get("navTemplates", [])

    for pdf_qid, entries in assoc.items():
        cat_qid = pdf_id_to_catalogue_id(pdf_qid)
        if cat_qid is None:
            continue
        text = text_by_id.get(cat_qid, "")
        needs_visual = bool(IMAGE_REF_PATTERNS.search(text))

        display_n = pdf_id_to_display_id(pdf_qid)
        seen_xrefs: set[int] = set()
        files: list[str] = []
        for xref, idx, data, width, height in entries:
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)
            aspect = width / max(1, height)
            if aspect > BANNER_ASPECT and height <= BANNER_MAX_HEIGHT and not needs_visual:
                counts["banners_dropped"] += 1
                continue
            slot = len(files)
            name = (
                f"{filename_prefix}{display_n:03d}.png"
                if slot == 0
                else f"{filename_prefix}{display_n:03d}-{slot}.png"
            )
            (IMAGES_DIR / name).write_bytes(data)
            files.append(name)
            counts["images_written"] += 1
        if not files:
            continue
        target = next((q for q in questions if q["id"] == cat_qid), None)
        if target is None:
            target = next((t for t in nav_templates if t["id"] == cat_qid), None)
        if target is None:
            for f in files:
                (IMAGES_DIR / f).unlink(missing_ok=True)
            counts["images_written"] -= len(files)
            continue
        target["images"] = files
        counts["questions_with_images"] += 1

    doc.close()
    return counts


def main() -> int:
    missing = [p for p in [SEE_PDF, BINNEN_PDF] if not p.exists()]
    if missing:
        for p in missing:
            sys.stderr.write(f"Missing: {p}\n")
        return 2
    if not CATALOGUE.exists():
        sys.stderr.write(f"Run import-elwis.py first — missing {CATALOGUE}\n")
        return 2

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    # Wipe any previous output from both prefixes.
    for pattern in ("q*.png", "b*.png"):
        for existing in IMAGES_DIR.glob(pattern):
            existing.unlink()

    catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    questions = catalogue["questions"]
    nav_templates = catalogue.get("navTemplates", [])

    text_by_id: dict[int, str] = {}
    for q in questions:
        text_by_id[q["id"]] = q["de"]["question"]
    for t in nav_templates:
        text_by_id[t["id"]] = t["de"]

    # Clear previous imageRefs
    for q in questions:
        q.pop("images", None)
    for t in nav_templates:
        t.pop("images", None)

    # Pass 1: See PDF — numbers map 1:1 to catalogue ids (1..300).
    see_counts = _process_pdf(
        SEE_PDF,
        catalogue,
        text_by_id,
        filename_prefix="q",
        pdf_id_to_catalogue_id=lambda n: n if 1 <= n <= 300 else None,
        pdf_id_to_display_id=lambda n: n,
    )

    # Pass 2: Binnen PDF — Basis (1..72) is sourced from See pass, so skip it
    # here to avoid overwriting. Binnen-specific 73..253 maps to catalogue id
    # 1000+n; Segeln 254..300 maps to 2000+n. Filenames use the ELWIS display
    # number (73..300) so they remain intuitive on disk.
    def binnen_map(n: int) -> int | None:
        if 73 <= n <= 253:
            return 1000 + n
        if 254 <= n <= 300:
            return 2000 + n
        return None

    binnen_counts = _process_pdf(
        BINNEN_PDF,
        catalogue,
        text_by_id,
        filename_prefix="b",
        pdf_id_to_catalogue_id=binnen_map,
        pdf_id_to_display_id=lambda n: n,
    )

    CATALOGUE.write_text(
        json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    total_imgs = see_counts["images_written"] + binnen_counts["images_written"]
    total_qs = see_counts["questions_with_images"] + binnen_counts["questions_with_images"]
    total_banners = see_counts["banners_dropped"] + binnen_counts["banners_dropped"]
    print(
        f"{total_imgs} images written for {total_qs} questions "
        f"({total_banners} banner-shaped images dropped)\n"
        f"  See:    {see_counts['images_written']} images / {see_counts['questions_with_images']} questions\n"
        f"  Binnen: {binnen_counts['images_written']} images / {binnen_counts['questions_with_images']} questions"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
