"""
matcher.py
Core ML matching logic: computes a semantic/lexical similarity score between a
resume and a job description using TF-IDF + cosine similarity, and extracts
which important JD keywords/skills are present or missing from the resume.
"""
import re
from collections import Counter
import math

# Prefer scikit-learn when available for robustness/accuracy; provide a
# lightweight fallback implementation so the app can run on machines without
# build toolchains (e.g., Windows without Visual Studio build tools).
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    _SKLEARN_AVAILABLE = True
except Exception:
    _SKLEARN_AVAILABLE = False


class _SimpleTfidf:
    def __init__(self, ngram_range=(1, 1), stop_words=None, max_features=None):
        self.ngram_range = ngram_range
        self.stop_words = set() if stop_words is None else set()
        self.max_features = max_features
        self.vocab_ = []

    def _ngrams(self, text):
        toks = [t for t in re.findall(r"\w+", text.lower()) if t not in self.stop_words]
        min_n, max_n = self.ngram_range
        ngrams = []
        for n in range(min_n, max_n + 1):
            for i in range(len(toks) - n + 1):
                ngrams.append(" ".join(toks[i:i+n]))
        return ngrams

    def fit_transform(self, docs):
        # build vocab by document frequency
        df = Counter()
        docs_ngrams = []
        for d in docs:
            ngrams = set(self._ngrams(d))
            docs_ngrams.append(ngrams)
            df.update(ngrams)

        most_common = [t for t, _ in df.most_common(self.max_features or 200)]
        self.vocab_ = most_common

        # compute TF-IDF vectors
        N = len(docs)
        idf = {t: math.log((1 + N) / (1 + sum(1 for doc in docs_ngrams if t in doc))) + 1 for t in self.vocab_}
        vectors = []
        for d in docs:
            counts = Counter(self._ngrams(d))
            vec = [counts.get(t, 0) * idf.get(t, 0) for t in self.vocab_]
            # normalize
            norm = math.sqrt(sum(x * x for x in vec))
            if norm > 0:
                vec = [x / norm for x in vec]
            vectors.append(vec)
        # return a simple dense matrix-like object (list of lists).
        class Matrix(list):
            pass

        return Matrix(vectors)

    def get_feature_names_out(self):
        return self.vocab_


def _simple_cosine(a, b):
    # both are dense lists
    if not a or not b:
        return [[0.0]]
    dot = sum(x * y for x, y in zip(a, b))
    norma = math.sqrt(sum(x * x for x in a))
    normb = math.sqrt(sum(y * y for y in b))
    if norma == 0 or normb == 0:
        return [[0.0]]
    return [[dot / (norma * normb)]]

def _make_vectorizer(**kwargs):
    if _SKLEARN_AVAILABLE:
        return TfidfVectorizer(**kwargs)
    else:
        return _SimpleTfidf(**kwargs)

def _make_cosine(a, b):
    if _SKLEARN_AVAILABLE:
        return cosine_similarity(a, b)
    else:
        return _simple_cosine(a[0], b[0])

# A curated bank of common tech / data / ML / general professional skills.
# This lets us do skill-aware matching on top of raw TF-IDF, since JDs often
# phrase the same skill differently than a resume does (e.g. "SQL" vs "MySQL").
SKILL_BANK = [
    "python", "java", "c++", "c#", "javascript", "typescript", "r", "sql", "nosql",
    "mysql", "postgresql", "mongodb", "sqlite", "html", "css", "react", "next.js",
    "node.js", "flask", "django", "fastapi", "rest api", "graphql",
    "machine learning", "deep learning", "nlp", "natural language processing",
    "computer vision", "data science", "data analysis", "data engineering",
    "data visualization", "pandas", "numpy", "scikit-learn", "tensorflow",
    "pytorch", "keras", "matplotlib", "seaborn", "power bi", "tableau", "excel",
    "statistics", "probability", "regression", "classification", "clustering",
    "neural network", "cnn", "rnn", "transformer", "llm", "generative ai",
    "git", "github", "docker", "kubernetes", "aws", "azure", "gcp", "cloud",
    "linux", "ci/cd", "agile", "scrum", "api", "microservices",
    "communication", "leadership", "teamwork", "problem solving", "project management",
    "etl", "airflow", "spark", "hadoop", "big data", "a/b testing",
]

STOPWORDS = {
    "the", "and", "for", "with", "you", "your", "our", "will", "are", "have",
    "this", "that", "from", "who", "into", "job", "role", "team", "work",
    "years", "year", "experience", "strong", "ability", "skills", "knowledge",
    "including", "such", "using", "etc", "responsibilities", "requirements",
    "qualifications", "preferred", "required", "plus", "we", "a", "an", "to",
    "of", "in", "on", "as", "is", "be", "at", "or", "by",
}


def _find_skills(text: str) -> set:
    lowered = text.lower()
    found = set()
    for skill in SKILL_BANK:
        # word-boundary-ish match, tolerant of skills containing symbols like c++/c#
        pattern = re.escape(skill)
        if re.search(rf"(?<![a-zA-Z0-9]){pattern}(?![a-zA-Z0-9])", lowered):
            found.add(skill)
    return found


def _extract_jd_keywords(jd_text: str, top_n: int = 20) -> list:
    """Pull the most JD-distinctive single/double word terms via TF-IDF and skill matching."""
    jd_lower = jd_text.lower()
    sentences = re.split(r"[.\n]", jd_text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 3]
    if len(sentences) < 2:
        sentences = [jd_text, jd_text]

    vectorizer = _make_vectorizer(
        ngram_range=(1, 2),
        stop_words="english",
        max_features=200,
    )
    try:
        matrix = vectorizer.fit_transform(sentences)
    except ValueError:
        matrix = []

    has_elements = False
    if matrix is not None:
        if hasattr(matrix, "shape"):
            has_elements = matrix.shape[0] > 0 and matrix.shape[1] > 0
        else:
            has_elements = len(matrix) > 0

    if has_elements:
        if hasattr(matrix, 'sum'):
            scores = matrix.sum(axis=0).A1
            terms = vectorizer.get_feature_names_out()
        else:
            cols = len(matrix[0]) if matrix else 0
            scores = [sum(row[i] for row in matrix) for i in range(cols)]
            terms = vectorizer.get_feature_names_out()
        ranked = sorted(zip(terms, scores), key=lambda x: x[1], reverse=True)
    else:
        ranked = []

    keywords = []
    for term, _ in ranked:
        term_clean = term.strip()
        if term_clean in STOPWORDS or len(term_clean) < 3:
            continue
        if any(term_clean == kw for kw in keywords):
            continue
        keywords.append(term_clean)
        if len(keywords) >= top_n:
            break

    # add explicit skill-term detection from the job description
    for skill in SKILL_BANK:
        if skill in jd_lower and skill not in keywords:
            keywords.append(skill)
            if len(keywords) >= top_n:
                break

    return keywords


def compute_match(resume_text: str, jd_text: str) -> dict:
    """Returns overall similarity score plus matched/missing skills and keywords."""
    # 1. TF-IDF + cosine similarity for overall semantic/lexical closeness
    vectorizer = _make_vectorizer(stop_words="english", ngram_range=(1, 2))
    tfidf_matrix = vectorizer.fit_transform([resume_text, jd_text])
    sim = _make_cosine(tfidf_matrix[0:1], tfidf_matrix[1:2])
    similarity = sim[0][0]
    match_score = round(float(similarity) * 100, 1)

    # 2. Skill-bank overlap (more interpretable than raw TF-IDF for the user)
    resume_skills = _find_skills(resume_text)
    jd_skills = _find_skills(jd_text)
    matched_skills = sorted(resume_skills & jd_skills)
    missing_skills = sorted(jd_skills - resume_skills)

    # 3. JD's most distinctive keywords/phrases, and whether resume covers them
    jd_keywords = _extract_jd_keywords(jd_text, top_n=30)
    resume_lower = resume_text.lower()
    matched_keywords = [kw for kw in jd_keywords if kw in resume_lower]
    missing_keywords = [kw for kw in jd_keywords if kw not in resume_lower]

    # 4. Blend: weight skill-bank coverage into the headline score so it
    # reflects concrete, explainable overlap rather than pure lexical noise.
    if jd_skills:
        skill_coverage = len(matched_skills) / len(jd_skills) * 100
    else:
        skill_coverage = match_score
    blended_score = round((match_score * 0.5) + (skill_coverage * 0.5), 1)
    blended_score = max(0.0, min(100.0, blended_score))

    return {
        "match_score": blended_score,
        "raw_tfidf_score": match_score,
        "skill_coverage": round(skill_coverage, 1),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "matched_keywords": matched_keywords[:12],
        "missing_keywords": missing_keywords[:12],
    }
