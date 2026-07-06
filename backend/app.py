"""
app.py
Flask API for the AI Resume Analyzer.

Endpoints:
  POST /api/analyze
    multipart/form-data:
      - resume: file (.pdf, .docx, .txt)
      - job_description: text
    returns JSON with match score, ATS score, matched/missing skills & keywords,
    and prioritized suggestions.
"""
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from resume_parser import extract_text, structural_signals
from matcher import compute_match
from ats_checker import check_ats

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)

@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")


@app.after_request
def add_cors_headers(response):
    # Ensure CORS headers are present even when an exception occurs so the
    # frontend receives a parsable response and can show a helpful message.
    response.headers.setdefault("Access-Control-Allow-Origin", "*")
    response.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    response.headers.setdefault("Access-Control-Allow-Headers", "Content-Type")
    return response

MAX_FILE_SIZE_MB = 5


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/analyze", methods=["POST"])
def analyze():
    if "resume" not in request.files:
        return jsonify({"error": "No resume file uploaded."}), 400

    resume_file = request.files["resume"]
    job_description = request.form.get("job_description", "").strip()

    if resume_file.filename == "":
        return jsonify({"error": "No resume file selected."}), 400

    if not job_description or len(job_description) < 30:
        return jsonify({"error": "Please paste a job description (at least a few sentences)."}), 400

    file_bytes = resume_file.read()
    if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        return jsonify({"error": f"File too large. Max size is {MAX_FILE_SIZE_MB}MB."}), 400

    try:
        resume_text = extract_text(file_bytes, resume_file.filename)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "Could not read this file. It may be corrupted, image-only (scanned), or password-protected."}), 400

    if len(resume_text.strip()) < 50:
        return jsonify({"error": "Very little text could be extracted from this resume. If it's a scanned image or unusual layout, try exporting a text-based PDF."}), 400

    signals = structural_signals(resume_text)
    match_result = compute_match(resume_text, job_description)
    ats_result = check_ats(resume_text, signals)

    # Merge missing skills/keywords into ATS suggestions for a unified action list
    combined_suggestions = list(ats_result["suggestions"])
    if match_result["missing_skills"]:
        top_missing = ", ".join(match_result["missing_skills"][:6])
        combined_suggestions.insert(
            0,
            f"This job description emphasizes: {top_missing}. Add these to your Skills or Projects section if you have genuine experience with them.",
        )

    return jsonify({
        "match_score": match_result["match_score"],
        "skill_coverage": match_result["skill_coverage"],
        "matched_skills": match_result["matched_skills"],
        "missing_skills": match_result["missing_skills"],
        "matched_keywords": match_result["matched_keywords"],
        "missing_keywords": match_result["missing_keywords"],
        "ats_score": ats_result["ats_score"],
        "checklist": ats_result["checklist"],
        "suggestions": combined_suggestions,
        "word_count": signals["word_count"],
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
