"""
ats_checker.py
Rule-based ATS (Applicant Tracking System) compatibility scoring.
Mimics the kinds of parsing checks real ATS software performs, and turns
each failed check into a concrete, actionable suggestion.
"""

ACTION_VERBS = [
    "led", "built", "designed", "developed", "created", "implemented",
    "optimized", "improved", "increased", "reduced", "automated", "launched",
    "managed", "analyzed", "engineered", "architected", "deployed",
    "streamlined", "spearheaded", "delivered", "achieved", "drove",
]

WEAK_PHRASES = [
    "responsible for", "duties included", "worked on", "helped with",
    "in charge of", "tasked with",
]


def check_ats(text: str, signals: dict) -> dict:
    """Runs a battery of pass/fail checks and returns a 0-100 score,
    a checklist, and prioritized suggestions."""
    checks = []
    suggestions = []

    # --- Contact & identity -------------------------------------------------
    if signals["has_email"]:
        checks.append(_pass("Email address found"))
    else:
        checks.append(_fail("No email address detected"))
        suggestions.append("Add a professional email address near the top of your resume so recruiters and ATS software can find your contact info instantly.")

    if signals["has_phone"]:
        checks.append(_pass("Phone number found"))
    else:
        checks.append(_fail("No phone number detected"))
        suggestions.append("Include a phone number in your header — some ATS platforms flag resumes without one as incomplete.")

    if signals["has_linkedin_or_github"]:
        checks.append(_pass("LinkedIn/GitHub link found"))
    else:
        checks.append(_fail("No LinkedIn or GitHub link detected"))
        suggestions.append("Add your LinkedIn and GitHub links — for AI/ML and dev roles, a GitHub link is often checked before the resume itself.")

    # --- Structure -----------------------------------------------------------
    sections = signals["sections"]
    required_sections = ["experience", "education", "skills"]
    missing_sections = [s for s in required_sections if not sections.get(s)]
    if not missing_sections:
        checks.append(_pass("Core sections present (Experience, Education, Skills)"))
    else:
        checks.append(_fail(f"Missing section(s): {', '.join(missing_sections)}"))
        suggestions.append(
            f"Add clearly labeled section headers for: {', '.join(s.title() for s in missing_sections)}. "
            "ATS software parses resumes by section — unlabeled or merged sections often get skipped entirely."
        )

    if sections.get("projects"):
        checks.append(_pass("Projects section found"))
    else:
        checks.append(_warn("No dedicated Projects section"))
        suggestions.append("For entry-level ML/data roles, add a 'Projects' section — it's often weighted as heavily as work experience when formal experience is limited.")

    # --- Formatting ------------------------------------------------------------
    if signals["bullet_count"] >= 4:
        checks.append(_pass(f"Uses bullet points ({signals['bullet_count']} found)"))
    else:
        checks.append(_warn("Few or no bullet points detected"))
        suggestions.append("Use bullet points (•) for experience and project entries instead of paragraphs — ATS parsers and recruiters both scan bullets far faster than prose.")

    if signals["date_range_count"] >= 1:
        checks.append(_pass("Date ranges found for experience/education"))
    else:
        checks.append(_warn("No clear date ranges detected"))
        suggestions.append("Add clear start–end dates (e.g. 'Jun 2023 – Present') to each role or project so ATS software can build an accurate timeline.")

    # --- Length ------------------------------------------------------------------
    wc = signals["word_count"]
    if 350 <= wc <= 900:
        checks.append(_pass(f"Resume length is appropriate ({wc} words)"))
    elif wc < 350:
        checks.append(_warn(f"Resume may be too short ({wc} words)"))
        suggestions.append("Your resume is quite short — expand on your projects and experience with specific tools, metrics, and outcomes to give the ATS more to match on.")
    else:
        checks.append(_warn(f"Resume may be too long ({wc} words)"))
        suggestions.append("Your resume is on the longer side — for early-career roles, aim for a focused 1-page resume (roughly 400-700 words).")

    # --- Language quality --------------------------------------------------------
    lowered = text.lower()
    verb_hits = sum(1 for v in ACTION_VERBS if v in lowered)
    if verb_hits >= 5:
        checks.append(_pass("Strong use of action verbs"))
    else:
        checks.append(_warn("Limited use of strong action verbs"))
        suggestions.append("Start bullet points with strong action verbs (Built, Optimized, Deployed, Automated) instead of passive phrasing — it reads better to both ATS keyword matching and human reviewers.")

    weak_hits = [p for p in WEAK_PHRASES if p in lowered]
    if not weak_hits:
        checks.append(_pass("No weak/passive filler phrases detected"))
    else:
        checks.append(_warn(f"Passive phrasing found: '{weak_hits[0]}'"))
        suggestions.append(f"Replace passive phrases like \"{weak_hits[0]}\" with a direct action verb + measurable result (e.g. 'Automated X, reducing manual effort by 30%').")

    has_numbers = any(ch.isdigit() for ch in text)
    if has_numbers:
        checks.append(_pass("Contains quantifiable metrics"))
    else:
        checks.append(_warn("No numbers/metrics detected"))
        suggestions.append("Quantify your impact wherever possible — accuracy %, dataset size, users served, time saved. Numbers make achievements concrete and scannable.")

    # --- Score ------------------------------------------------------------------
    total = len(checks)
    passed = sum(1 for c in checks if c["status"] == "pass")
    warned = sum(1 for c in checks if c["status"] == "warn")
    score = round(((passed + 0.5 * warned) / total) * 100)

    return {
        "ats_score": score,
        "checklist": checks,
        "suggestions": suggestions,
    }


def _pass(label):
    return {"status": "pass", "label": label}


def _warn(label):
    return {"status": "warn", "label": label}


def _fail(label):
    return {"status": "fail", "label": label}
