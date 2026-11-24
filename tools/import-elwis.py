#!/usr/bin/env python3
"""
Import the official ELWIS SBF-See AND SBF-Binnen question catalogues from PDF
into data/catalogue.official.json.

Strict: exits non-zero if the expected shapes are not exactly met.

  See:    72 Basis + 213 See-specific + 15 Nav templates + 8 Nav scenarios
  Binnen: 72 Basis + 181 Binnen-specific + 47 Segeln-specific

Basis questions (1..72) must be byte-identical in both PDFs; the Binnen copy is
discarded and the single Basis set is shared across all three licence modes
via `licencesOf()` in the app.

Id allocation (globally unique within catalogue.official.json):

  1..72        Basis                 (shared)
  73..285      See-specific          (ELWIS id unchanged)
  286..300     Navigation templates  (ELWIS id unchanged)
  1073..1253   Binnen-specific       (ELWIS id + 1000)
  2254..2300   Segeln-specific       (ELWIS id + 2000)

Each question also carries `displayId` (e.g. "73" for Binnen-specific Q1073)
so the UI can render the user-facing ELWIS number.

Requires: pymupdf  (pip install --user pymupdf)
"""

from __future__ import annotations

import datetime as _dt
import json
import re
import sys
from pathlib import Path

try:
    import fitz  # type: ignore
except ImportError:
    sys.stderr.write(
        "pymupdf not installed. Run: python3 -m pip install --user pymupdf\n"
    )
    sys.exit(2)


ROOT = Path(__file__).resolve().parent.parent
SEE_PDF = ROOT / "data" / "raw" / "elwis-see-2023.pdf"
BINNEN_PDF = ROOT / "data" / "raw" / "elwis-binnen-2023.pdf"
OUT = ROOT / "data" / "catalogue.official.json"
VERSION = "2023-08-01"

BINNEN_OFFSET = 1000
SEGELN_OFFSET = 2000

# The 15 navigation templates are simple single-line questions. We tag each
# with the answer shape the app should render. Order matches the PDF (286..300).
NAV_ANSWER_SHAPES: dict[int, str] = {
    286: "course",     # rwK
    287: "chartPlot",  # Tragen Sie den Kurs in die Seekarte ein.
    288: "course",     # MgK
    289: "course",     # Peilungen
    290: "chartPlot",
    291: "coord",      # Geographische Position
    292: "chartPlot",
    293: "distance",
    294: "position",   # Koppelort
    295: "position",   # Besteckversetzung
    296: "time",       # In welcher Zeit erreichen Sie das Ziel?
    297: "speed",      # Wie groß ist die Geschwindigkeit?
    298: "description",  # Welche Bedeutung hat das Schifffahrtszeichen?
    299: "description",  # Beschreiben Sie das Schifffahrtszeichen ...
    300: "description",  # Was bedeutet diese Eintragung in der Seekarte?
}

# Repeatable footer/header artefacts that leak into the last MCQ answer of a
# section. Covers both See and Binnen variants. Longer patterns first.
_FOOTER_PATTERNS = [
    re.compile(
        r"\s*Stand:\s*01\.\s*August\s*2023.*$",
        re.DOTALL,
    ),
    re.compile(r"\s*©\s*Wasserstraßen-\s*und\s*Schifffahrtsverwaltung.*$", re.DOTALL),
    re.compile(r"\s*Sie sind hier:.*$", re.DOTALL),
    re.compile(r"\s*Spezifische Fragen (?:See|Binnen|Segeln)\s*Anmerkung:.*$", re.DOTALL),
    re.compile(r"\s*Anmerkung:\s*Antwort a ist immer die richtige\.\s*$", re.DOTALL),
    re.compile(r"\s*(?:Navigationsaufgabe\s+\d+\s*)+$", re.DOTALL),
]


def _strip_footer(text: str) -> str:
    prev = None
    while prev != text:
        prev = text
        for pat in _FOOTER_PATTERNS:
            text = pat.sub("", text)
    return text.strip()


def extract_text(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path)
    return "\n".join(page.get_text() for page in doc)


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def parse_mcq_block(block: str) -> tuple[str, list[str]]:
    """
    Given a raw text block that starts with the question text and ends
    right before the next question number, extract the question and the
    four answers a/b/c/d.

    ELWIS format is:
        <question text possibly multi-line>
        a. <answer a>
        b. <answer b>
        c. <answer c>
        d. <answer d>
    """
    pattern = re.compile(r"\n\s*([a-d])\.\s+", re.MULTILINE)
    parts = pattern.split(block)
    if len(parts) < 9:
        raise ValueError(
            f"Expected 4 answers, got {(len(parts) - 1) // 2} in block:\n{block[:400]}"
        )
    question = _clean(_strip_footer(parts[0]))
    letters = parts[1::2]
    answers_raw = parts[2::2]
    if letters[:4] != ["a", "b", "c", "d"]:
        raise ValueError(f"Answer letters out of order: {letters[:4]}")
    answers = [_clean(_strip_footer(a)) for a in answers_raw[:4]]
    if any(not a for a in answers):
        raise ValueError("Empty answer found")
    return question, answers


def _question_starts(text: str, upper_bound: int) -> list[tuple[int, int, int]]:
    """Find monotonically ascending question numbers 1..upper_bound at line starts."""
    raw = [
        (int(m.group(1)), m.start(), m.end())
        for m in re.finditer(r"(?:^|\n)\s*(\d{1,3})\.\s", text)
        if 1 <= int(m.group(1)) <= upper_bound
    ]
    seq: list[tuple[int, int, int]] = []
    expected = 1
    for n, s, e in raw:
        if n == expected:
            seq.append((n, s, e))
            expected += 1
    return seq


def parse_see(text: str) -> dict:
    """Parse the See PDF. Returns dict with questions (1..285), navTemplates, navScenarios."""
    seq = _question_starts(text, 300)
    if len(seq) != 300:
        raise SystemExit(f"[See] Expected 300 items, found {len(seq)}")

    boundaries: list[tuple[int, int, int]] = []
    for idx, (n, _s, e) in enumerate(seq):
        start = e
        end = seq[idx + 1][1] if idx + 1 < len(seq) else len(text)
        boundaries.append((n, start, end))

    questions: list[dict] = []
    nav_templates: list[dict] = []

    for n, s, e in boundaries:
        block = text[s:e]
        if 1 <= n <= 285:
            try:
                stem, answers = parse_mcq_block(block)
            except ValueError as exc:
                raise SystemExit(f"[See] Q{n}: {exc}")
            category = "basis" if n <= 72 else "see"
            questions.append(
                {
                    "id": n,
                    "displayId": str(n),
                    "category": category,
                    "de": {"question": stem, "answers": answers},
                    "officialCorrectIndex": 0,
                    "source": {"publisher": "ELWIS", "version": VERSION},
                }
            )
        else:
            lines: list[str] = []
            for raw_line in block.splitlines():
                stripped = raw_line.strip()
                if not stripped:
                    if lines:
                        break
                    continue
                lines.append(stripped)
            stem = _clean(_strip_footer(" ".join(lines)))
            shape = NAV_ANSWER_SHAPES.get(n, "chartPlot")
            nav_templates.append(
                {
                    "id": n,
                    "de": stem,
                    "answerShape": shape,
                    "source": {"publisher": "ELWIS", "version": VERSION},
                }
            )

    scen_hdr = text.find("Aus den nachfolgenden 15 Fragen")
    if scen_hdr == -1:
        raise SystemExit("[See] Could not find navigation scenarios section header")
    scen_region = text[max(0, scen_hdr - 2000) : scen_hdr]
    coord_pair_re = re.compile(
        r"(\d+)\.\s*N(\d{1,2})°(\d{1,2}[,.]\d+)['′]?,\s*"
        r"E(\d{3})°(\d{1,2}[,.]\d+)['′]?;\s*"
        r"N(\d{1,2})°(\d{1,2}[,.]\d+)['′]?,\s*"
        r"E(\d{3})°(\d{1,2}[,.]\d+)['′]?"
    )
    nav_scenarios: list[dict] = []
    for m in coord_pair_re.finditer(scen_region):
        idx = int(m.group(1))
        nav_scenarios.append(
            {
                "id": idx,
                "swCorner": {
                    "lat": f"N{m.group(2)}°{m.group(3).replace(',', '.')}'",
                    "lon": f"E{m.group(4)}°{m.group(5).replace(',', '.')}'",
                },
                "neCorner": {
                    "lat": f"N{m.group(6)}°{m.group(7).replace(',', '.')}'",
                    "lon": f"E{m.group(8)}°{m.group(9).replace(',', '.')}'",
                },
                "source": {"publisher": "ELWIS", "version": VERSION},
            }
        )
    if len(nav_scenarios) != 8:
        raise SystemExit(f"[See] Expected 8 nav scenarios, found {len(nav_scenarios)}")

    basis = [q for q in questions if q["category"] == "basis"]
    see = [q for q in questions if q["category"] == "see"]
    if len(basis) != 72:
        raise SystemExit(f"[See] Expected 72 Basis, got {len(basis)}")
    if len(see) != 213:
        raise SystemExit(f"[See] Expected 213 See, got {len(see)}")
    if len(nav_templates) != 15:
        raise SystemExit(f"[See] Expected 15 nav templates, got {len(nav_templates)}")

    return {
        "questions": questions,
        "navTemplates": nav_templates,
        "navScenarios": nav_scenarios,
    }


def parse_binnen(text: str) -> dict:
    """Parse the Binnen PDF.

    Binnen catalog layout:
      1..72    Basis (identical to See)
      73..253  Spezifische Fragen Binnen
      254..300 Spezifische Fragen Segeln

    Returns dict with:
      basis:  list of {id,displayId,category:basis,...}  (for cross-check only)
      binnen: list of {id (raw+1000), displayId:raw, category:binnen,...}
      segeln: list of {id (raw+2000), displayId:raw, category:segeln,...}
    """
    seq = _question_starts(text, 300)
    if len(seq) != 300:
        raise SystemExit(f"[Binnen] Expected 300 items, found {len(seq)}")

    boundaries: list[tuple[int, int, int]] = []
    for idx, (n, _s, e) in enumerate(seq):
        start = e
        end = seq[idx + 1][1] if idx + 1 < len(seq) else len(text)
        boundaries.append((n, start, end))

    basis: list[dict] = []
    binnen: list[dict] = []
    segeln: list[dict] = []

    for n, s, e in boundaries:
        block = text[s:e]
        try:
            stem, answers = parse_mcq_block(block)
        except ValueError as exc:
            raise SystemExit(f"[Binnen] Q{n}: {exc}")

        if 1 <= n <= 72:
            basis.append(
                {
                    "id": n,
                    "displayId": str(n),
                    "category": "basis",
                    "de": {"question": stem, "answers": answers},
                    "officialCorrectIndex": 0,
                    "source": {"publisher": "ELWIS", "version": VERSION},
                }
            )
        elif 73 <= n <= 253:
            binnen.append(
                {
                    "id": BINNEN_OFFSET + n,
                    "displayId": str(n),
                    "category": "binnen",
                    "de": {"question": stem, "answers": answers},
                    "officialCorrectIndex": 0,
                    "source": {"publisher": "ELWIS", "version": VERSION},
                }
            )
        elif 254 <= n <= 300:
            segeln.append(
                {
                    "id": SEGELN_OFFSET + n,
                    "displayId": str(n),
                    "category": "segeln",
                    "de": {"question": stem, "answers": answers},
                    "officialCorrectIndex": 0,
                    "source": {"publisher": "ELWIS", "version": VERSION},
                }
            )

    if len(basis) != 72:
        raise SystemExit(f"[Binnen] Expected 72 Basis, got {len(basis)}")
    if len(binnen) != 181:
        raise SystemExit(f"[Binnen] Expected 181 Binnen-specific, got {len(binnen)}")
    if len(segeln) != 47:
        raise SystemExit(f"[Binnen] Expected 47 Segeln-specific, got {len(segeln)}")

    return {"basis": basis, "binnen": binnen, "segeln": segeln}


def verify_basis_identity(see_qs: list[dict], binnen_basis: list[dict]) -> None:
    """Fail fast if the 72 Basis questions diverge between See and Binnen."""
    see_basis = {q["id"]: q for q in see_qs if q["category"] == "basis"}
    if set(see_basis) != {q["id"] for q in binnen_basis}:
        raise SystemExit(
            "[Basis] id set differs between See and Binnen: "
            f"See={sorted(see_basis)[:5]}..., Binnen={sorted(q['id'] for q in binnen_basis)[:5]}..."
        )
    diffs: list[int] = []
    for q in binnen_basis:
        s = see_basis[q["id"]]
        if s["de"] != q["de"]:
            diffs.append(q["id"])
    if diffs:
        preview = diffs[:5]
        raise SystemExit(
            f"[Basis] {len(diffs)} questions differ between See and Binnen PDFs "
            f"(first few: {preview}). Expected byte-identical text and answers."
        )


def main() -> int:
    missing = [p for p in [SEE_PDF, BINNEN_PDF] if not p.exists()]
    if missing:
        sys.stderr.write("Missing source PDFs:\n" + "\n".join(str(p) for p in missing) + "\n")
        return 2

    see = parse_see(extract_text(SEE_PDF))
    binnen = parse_binnen(extract_text(BINNEN_PDF))

    verify_basis_identity(see["questions"], binnen["basis"])

    # Merge: keep See's Basis + See-specific + Nav; add Binnen-specific + Segeln-specific.
    questions = list(see["questions"]) + list(binnen["binnen"]) + list(binnen["segeln"])
    nav_templates = see["navTemplates"]
    nav_scenarios = see["navScenarios"]

    # Final integrity: unique ids, category counts
    ids = [q["id"] for q in questions]
    if len(set(ids)) != len(ids):
        raise SystemExit("Duplicate question ids after merge")
    by_cat: dict[str, int] = {}
    for q in questions:
        by_cat[q["category"]] = by_cat.get(q["category"], 0) + 1
    expected = {"basis": 72, "see": 213, "binnen": 181, "segeln": 47}
    if by_cat != expected:
        raise SystemExit(f"Category counts wrong: got {by_cat}, expected {expected}")

    catalogue = {
        "source": {"publisher": "ELWIS", "version": VERSION},
        "generatedAt": _dt.datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "questions": questions,
        "navTemplates": nav_templates,
        "navScenarios": nav_scenarios,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Imported OK -> {OUT.relative_to(ROOT)}\n"
        f"  Basis:  {by_cat['basis']}\n"
        f"  See:    {by_cat['see']}\n"
        f"  Binnen: {by_cat['binnen']}\n"
        f"  Segeln: {by_cat['segeln']}\n"
        f"  Nav:    {len(nav_templates)} templates, {len(nav_scenarios)} scenarios"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
