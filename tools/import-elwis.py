#!/usr/bin/env python3
"""
Import the official ELWIS SBF-See question catalogue from PDF into
data/catalogue.official.json.

Strict: exits non-zero if the expected shape (72 Basis + 213 See +
15 Nav templates + 8 Nav scenarios) is not exactly met.

Requires: pymupdf  (pip install --user pymupdf)
"""

from __future__ import annotations

import datetime as _dt
import json
import os
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
PDF = ROOT / "data" / "raw" / "elwis-see-2023.pdf"
OUT = ROOT / "data" / "catalogue.official.json"
VERSION = "2023-08-01"

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
# section (Q72 → Basis footer, Q285 → See footer). Also drop the "Sie sind
# hier:" breadcrumb block. Order matters: longer patterns first.
_FOOTER_PATTERNS = [
    re.compile(
        r"\s*Stand:\s*01\.\s*August\s*2023.*$",
        re.DOTALL,
    ),
    re.compile(r"\s*©\s*Wasserstraßen-\s*und\s*Schifffahrtsverwaltung.*$", re.DOTALL),
    re.compile(r"\s*Sie sind hier:.*$", re.DOTALL),
    re.compile(r"\s*Spezifische Fragen See\s*Anmerkung:.*$", re.DOTALL),
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
    # Collapse whitespace, keep umlauts, strip trailing punctuation-adjacent spaces
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
    # Split on lines starting with "a. ", "b. ", "c. ", "d. "
    pattern = re.compile(r"\n\s*([a-d])\.\s+", re.MULTILINE)
    parts = pattern.split(block)
    # parts[0] is the question stem; then alternating letter, answer, letter, answer, ...
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


def parse_catalogue(text: str) -> dict:
    # Find every top-level question number "N." at start of a line, 1..300
    q_starts = [
        (int(m.group(1)), m.start(), m.end())
        for m in re.finditer(r"(?:^|\n)\s*(\d{1,3})\.\s", text)
        if 1 <= int(m.group(1)) <= 300
    ]
    # Deduplicate to first occurrence of each number, and only keep the
    # monotonic ascending sequence starting from 1.
    seen_seq: list[tuple[int, int, int]] = []
    expected = 1
    for n, s, e in q_starts:
        if n == expected:
            seen_seq.append((n, s, e))
            expected += 1
    if len(seen_seq) != 300:
        raise SystemExit(
            f"Expected 300 questions in sequence, found {len(seen_seq)}"
        )

    # Build [start_of_block, end_of_block) for each numbered item.
    boundaries: list[tuple[int, int, int]] = []
    for idx, (n, _s, e) in enumerate(seen_seq):
        start = e
        end = seen_seq[idx + 1][1] if idx + 1 < len(seen_seq) else len(text)
        boundaries.append((n, start, end))

    questions: list[dict] = []
    nav_templates: list[dict] = []

    for n, s, e in boundaries:
        block = text[s:e]
        if 1 <= n <= 285:
            # MCQ
            try:
                stem, answers = parse_mcq_block(block)
            except ValueError as exc:
                raise SystemExit(f"Q{n}: {exc}")
            category = "basis" if n <= 72 else "see"
            questions.append(
                {
                    "id": n,
                    "category": category,
                    "de": {"question": stem, "answers": answers},
                    "officialCorrectIndex": 0,
                    "source": {"publisher": "ELWIS", "version": VERSION},
                }
            )
        else:
            # Navigation template (286..300) — question may wrap across
            # multiple lines; take everything up to the first blank line.
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

    # Extract nav scenarios: 8 coordinate pairs preceding "Aus den nachfolgenden 15 Fragen"
    scen_hdr = text.find("Aus den nachfolgenden 15 Fragen")
    if scen_hdr == -1:
        raise SystemExit("Could not find navigation scenarios section header")
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
        raise SystemExit(
            f"Expected 8 nav scenarios, found {len(nav_scenarios)}"
        )

    # Counts assertion
    basis = [q for q in questions if q["category"] == "basis"]
    see = [q for q in questions if q["category"] == "see"]
    if len(basis) != 72:
        raise SystemExit(f"Expected 72 Basis, got {len(basis)}")
    if len(see) != 213:
        raise SystemExit(f"Expected 213 See, got {len(see)}")
    if len(nav_templates) != 15:
        raise SystemExit(f"Expected 15 nav templates, got {len(nav_templates)}")

    return {
        "source": {"publisher": "ELWIS", "version": VERSION},
        "generatedAt": _dt.datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "questions": questions,
        "navTemplates": nav_templates,
        "navScenarios": nav_scenarios,
    }


def main() -> int:
    if not PDF.exists():
        sys.stderr.write(f"Missing source PDF: {PDF}\n")
        return 2
    text = extract_text(PDF)
    catalogue = parse_catalogue(text)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    q_count = len(catalogue["questions"])
    nt_count = len(catalogue["navTemplates"])
    ns_count = len(catalogue["navScenarios"])
    print(
        f"{q_count} MCQ + {nt_count} nav templates + {ns_count} scenarios "
        f"imported OK -> {OUT.relative_to(ROOT)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
