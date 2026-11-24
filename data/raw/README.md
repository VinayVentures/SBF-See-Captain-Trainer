# Raw ELWIS source documents

These files are the **official, unmodified** source material for the SBF catalogues used by this app.

## SBF-See

- `elwis-see-2023.pdf` — *Fragen- und Antwortenkatalog für den amtlichen Sportbootführerschein mit dem Geltungsbereich Seeschifffahrtsstraßen*, Stand 01. August 2023. Downloaded from https://www.elwis.de/DE/Sportschifffahrt/Sportbootfuehrerscheine/Fragenkatalog-See/Fragenkatalog-See-August-2023.pdf
- `fragenverteilung.pdf` — *Verteilung der Fragen auf die einzelnen Fragebogen* (See). Downloaded from https://www.elwis.de/DE/Sportschifffahrt/Sportbootfuehrerscheine/Fragenverteilung-See.pdf
- `aenderungen.pdf` — *Änderungen des Fragen- und Antwortenkataloges* (See). Downloaded from https://www.elwis.de/DE/Sportschifffahrt/Sportbootfuehrerscheine/Aenderung-Fragen-Katalog-See.pdf

## SBF-Binnen

- `elwis-binnen-2023.pdf` — *Fragen- und Antwortenkatalog für den amtlichen Sportbootführerschein mit dem Geltungsbereich Binnenschifffahrtsstraßen*, Stand 01. August 2023. Downloaded from https://www.elwis.de/DE/Sportschifffahrt/Sportbootfuehrerscheine/Fragenkatalog-Binnen/Fragenkatalog-Binnen-August-2023.pdf
- `fragenverteilung-binnen.pdf` — *Verteilung der Fragen auf die einzelnen Fragebogen* (Binnen, Motor + Segeln + Ergänzungsbogen). Downloaded from https://www.elwis.de/DE/Sportschifffahrt/Sportbootfuehrerscheine/Fragenverteilung-Binnen.pdf
- `aenderungen-binnen.pdf` — *Änderungen des Fragen- und Antwortenkataloges* (Binnen). Downloaded from https://www.elwis.de/DE/Sportschifffahrt/Sportbootfuehrerscheine/Aenderung-Fragen-Katalog-Binnen.pdf

**© Wasserstraßen- und Schifffahrtsverwaltung des Bundes.** These files are the official published question catalogues. This project uses them as the authoritative source for exam content; the app does not paraphrase or fabricate.

Do not edit these files. To refresh, download the latest published version and update this README with the new "Stand" date.

Parsed output lives in `../catalogue.official.json`, produced by `tools/import-elwis.py`.
The 72 Basis questions appear in both catalogues; the importer verifies they are byte-identical and stores them once, tagged with `category: "basis"` (which maps to all three licence modes via `licencesOf()`).

