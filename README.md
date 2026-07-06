# Scanline — AI Resume Analyzer

A full-stack ML web app that scores how well a resume matches a job description,
runs an ATS (Applicant Tracking System) parse-compatibility check, and returns
concrete, prioritized suggestions for improving both.

Built as a portfolio project targeting AI/ML Engineering, Data Science, and Data
Analytics roles — it's designed to demonstrate applied NLP (TF-IDF + cosine
similarity, skill-entity extraction), not just a wrapper around a template.

---

## What it does

1. **Upload a resume** (PDF, DOCX, or TXT) and **paste a job description**.
2. **JD Match Score** — computed with a scikit-learn TF-IDF vectorizer +
   cosine similarity between resume and JD text, blended 50/50 with a
   skill-bank overlap score (so the number is explainable, not a black box).
3. **ATS Score** — an 11-point rule-based parser check that mimics how real
   ATS software reads a resume: contact info present, required sections
   found, bullet usage, date-range formatting, resume length, action-verb
   usage, passive-language detection, and quantified metrics.
4. **Skill overlap** — matched vs. missing skills/keywords between the resume
   and JD, pulled from a domain-aware skill bank (Python, SQL, ML frameworks,
   cloud, soft skills, etc.) plus JD-specific TF-IDF keyword extraction.
5. **Suggested fixes** — every failed or "warn" check is turned into a
   specific, actionable suggestion (not generic "improve your resume" advice).

## Tech stack

**Backend:** Python, Flask, scikit-learn (TF-IDF + cosine similarity),
pdfplumber (PDF parsing), python-docx (DOCX parsing)

**Frontend:** Vanilla HTML/CSS/JS (no framework/build step needed) — custom
"instrument panel" design system with animated SVG gauges and a scanning-beam
upload interaction.

## Project structure

```
resume-analyzer/
├── backend/
│   ├── app.py                # Flask API (POST /api/analyze)
│   ├── resume_parser.py       # PDF/DOCX/TXT text + structural signal extraction
│   ├── matcher.py             # TF-IDF similarity + skill-bank overlap engine
│   ├── ats_checker.py         # Rule-based ATS scoring + suggestion generator
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── styles.css
    └── app.js
```

## Running it locally

**1. Backend**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python3 app.py
```

The API runs at `http://localhost:5000`. Health check: `GET /api/health`.

**2. Frontend**

Open `frontend/index.html` directly in a browser, or serve it:

```bash
cd frontend
python3 -m http.server 8080
```

Then visit `http://localhost:8080`. The frontend calls the API at
`http://localhost:5000` by default — change `API_BASE` at the top of
`app.js` if you deploy the backend elsewhere.

## API

**POST** `/api/analyze`

`multipart/form-data`:
| field | type | description |
|---|---|---|
| `resume` | file | `.pdf`, `.docx`, or `.txt`, max 5MB |
| `job_description` | text | full JD text, min ~30 characters |

Returns JSON: `match_score`, `ats_score`, `matched_skills`, `missing_skills`,
`matched_keywords`, `missing_keywords`, `checklist`, `suggestions`.

## Notes on the ML approach

The match score deliberately blends two signals instead of relying on raw
TF-IDF cosine similarity alone:

- **Lexical/semantic similarity** (TF-IDF + cosine) captures overall
  vocabulary and phrasing overlap between the two documents.
- **Skill-bank coverage** captures concrete, named skills (from a curated
  list of ~90 technical/professional terms) that appear in both — this is
  what recruiters and ATS keyword filters actually key off of, and it keeps
  the score interpretable rather than a single opaque number.

This is a reasonable v1 approach for a portfolio/resume project. A natural
next iteration — worth mentioning if this comes up in an interview — would be
swapping the TF-IDF vectorizer for sentence embeddings (e.g.
`sentence-transformers`) to catch semantic matches TF-IDF misses (e.g. "led a
team" vs. "managed direct reports"), and expanding the skill bank via a
proper named-entity/skills-extraction model instead of a static list.

## Possible extensions

- Resume section-by-section rewrite suggestions using an LLM call
- Support for multiple resume versions scored against the same JD, ranked
- A "before/after" diff view showing suggested edits
- Persist analysis history (would pair well with a small SQLite layer)
