"""
example.py — Shows how to import and use parse_job_posting() directly.

Run:
    python example.py path/to/job_posting.pdf
"""

import json
import sys

from job_parser_agent import JobPosting, parse_job_posting


def main(file_path: str) -> None:
    print(f"Extracting features from: {file_path}\n")

    # ── Call parse_job_posting — returns a typed JobPosting object ─────────────
    job: JobPosting = parse_job_posting(file_path)

    # ── Access individual fields directly ─────────────────────────────────────
    print(f"Title            : {job.title}")
    print(f"Location         : {job.location}")
    print(f"Employment type  : {job.employment_type}")
    print(f"Salary range     : {job.salary_range}")
    print(f"Industry         : {job.industry}")
    print(f"Remote           : {job.telecommuting}")
    print(f"Has questions    : {job.has_questions}")

    # ── Full dump as dict / JSON ──────────────────────────────────────────────
    print("\n── Full extracted data (JSON) ──")
    print(json.dumps(job.model_dump(), indent=2, ensure_ascii=False))

    # ── Only non-None fields ──────────────────────────────────────────────────
    print("\n── Present fields only ──")
    present = {k: v for k, v in job.model_dump().items() if v is not None}
    print(json.dumps(present, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python example.py <path-to-job-posting-file>")
        print("Supported: .docx  .doc  .pdf  .html  .htm  .md  .txt")
        sys.exit(1)

    main(sys.argv[1])
