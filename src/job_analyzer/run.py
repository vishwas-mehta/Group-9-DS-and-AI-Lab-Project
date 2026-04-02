"""
run.py

Pipeline:
1) Import and use job_parser_agent to parse a job posting file.
2) Extract required inputs (company, email, website, phone, etc.).
3) Call every tool in src/job_analyzer/tools.
4) Save all collected evidence in well-structured text files.

Usage:
	python run.py path/to/job_posting.pdf
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

try:
	from . import job_parser_agent
	from .tools._tool_company_registry import get_company_registry
	from .tools._tool_scam_signals import detect_scam_signals
	from .tools._tool_website_content import extract_website_content
	from .tools._tool_website_verify import verify_website
	from .tools.tool_company_news import search_company_news
	from .tools.tool_company_web_search import search_company_web
	from .tools.tool_company_wikipedia import get_company_wikipedia
	from .tools.tool_domain_reputation import check_domain_reputation
	from .tools.tool_email_verify import verify_email
	from .tools.tool_job_boards import check_job_boards
	from .tools.tool_phone_check import check_phone_number
	from .tools.tool_social_profiles import check_social_profiles
except ImportError:
	import job_parser_agent
	from tools._tool_company_registry import get_company_registry
	from tools._tool_scam_signals import detect_scam_signals
	from tools._tool_website_content import extract_website_content
	from tools._tool_website_verify import verify_website
	from tools.tool_company_news import search_company_news
	from tools.tool_company_web_search import search_company_web
	from tools.tool_company_wikipedia import get_company_wikipedia
	from tools.tool_domain_reputation import check_domain_reputation
	from tools.tool_email_verify import verify_email
	from tools.tool_job_boards import check_job_boards
	from tools.tool_phone_check import check_phone_number
	from tools.tool_social_profiles import check_social_profiles


EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
URL_PATTERN = re.compile(r"https?://[^\s)\]>'\"]+|www\.[^\s)\]>'\"]+")
PHONE_PATTERN = re.compile(r"\+?\d[\d\s().-]{7,}\d")


@dataclass
class JobContext:
	file_path: str
	title: str | None
	location: str | None
	company_name: str | None
	email: str | None
	website: str | None
	phone: str | None
	raw_text: str
	parsed_job: dict[str, Any]


def _clean_company_name(name: str | None) -> str | None:
	if not name:
		return None
	cleaned = re.sub(r"\s+", " ", name).strip(" -,:;\n\t")
	return cleaned or None


def _extract_first(pattern: re.Pattern[str], text: str) -> str | None:
	found = pattern.findall(text)
	return found[0].strip() if found else None


def _normalize_website(value: str | None) -> str | None:
	if not value:
		return None
	value = value.strip()
	if value.startswith("www."):
		return f"https://{value}"
	if value.startswith("http://") or value.startswith("https://"):
		return value
	if "." in value and " " not in value:
		return f"https://{value}"
	return None


def _domain_to_company(domain_value: str) -> str | None:
	parsed = urlparse(domain_value if domain_value.startswith("http") else f"https://{domain_value}")
	host = parsed.netloc.lower() if parsed.netloc else parsed.path.lower()
	if host.startswith("www."):
		host = host[4:]
	if not host:
		return None
	base = host.split(".")[0]
	if not base:
		return None
	return base.replace("-", " ").title()


def _infer_company_name(raw_text: str, parsed_job: dict[str, Any], website: str | None, email: str | None) -> str | None:
	for field in ("company_name", "company", "organization"):
		if parsed_job.get(field):
			return _clean_company_name(str(parsed_job[field]))

	company_profile = parsed_job.get("company_profile") or ""
	for pat in (
		r"(?:Company|Organization)\s*[:\-]\s*([^\n,]{2,80})",
		r"About\s+([^\n,]{2,80})",
		r"at\s+([A-Z][A-Za-z0-9&.,\- ]{2,80})",
	):
		match = re.search(pat, company_profile, flags=re.IGNORECASE)
		if match:
			return _clean_company_name(match.group(1))

	if email and "@" in email:
		from_email = _domain_to_company(email.split("@", 1)[1])
		if from_email:
			return from_email

	if website:
		from_website = _domain_to_company(website)
		if from_website:
			return from_website

	match = re.search(r"(?:Company|Organization)\s*[:\-]\s*([^\n,]{2,80})", raw_text, flags=re.IGNORECASE)
	if match:
		return _clean_company_name(match.group(1))

	return None


def build_context(file_path: str) -> JobContext:
	raw_text = job_parser_agent.load_document(file_path)
	parsed = job_parser_agent.parse_job_posting(file_path)
	parsed_dict = parsed.model_dump()

	email = parsed_dict.get("contact_email") or _extract_first(EMAIL_PATTERN, raw_text)
	website = _normalize_website(parsed_dict.get("company_website") or _extract_first(URL_PATTERN, raw_text))
	phone = parsed_dict.get("contact_phone") or _extract_first(PHONE_PATTERN, raw_text)
	company_name = _infer_company_name(raw_text=raw_text, parsed_job=parsed_dict, website=website, email=email)

	return JobContext(
		file_path=file_path,
		title=parsed_dict.get("title"),
		location=parsed_dict.get("location"),
		company_name=company_name,
		email=email,
		website=website,
		phone=phone,
		raw_text=raw_text,
		parsed_job=parsed_dict,
	)


def _safe_call(tool_name: str, fn, *args, **kwargs) -> dict[str, Any]:
	try:
		result = fn(*args, **kwargs)
		if isinstance(result, dict):
			return result
		return {"ok": True, "data": result}
	except Exception as exc:
		return {"ok": False, "error": f"{tool_name} crashed: {exc}"}


def run_all_tools(context: JobContext) -> dict[str, Any]:
	company_name = context.company_name
	website = context.website
	email = context.email
	phone = context.phone

	domain_input = None
	if email and "@" in email:
		domain_input = email
	elif website:
		domain_input = website

	results: dict[str, Any] = {}

	# Run each tool one-by-one in a fixed order and capture each extraction result.
	results["tool_company_registry"] = _safe_call("tool_company_registry", get_company_registry, company_name)
	results["tool_scam_signals"] = _safe_call("tool_scam_signals", detect_scam_signals, context.raw_text)
	results["tool_website_verify"] = (
		_safe_call("tool_website_verify", verify_website, website)
		if website else {"ok": False, "error": "website not found in posting"}
	)
	results["tool_website_content"] = (
		_safe_call("tool_website_content", extract_website_content, website)
		if website else {"ok": False, "error": "website not found in posting"}
	)
	results["tool_company_news"] = (
		_safe_call("tool_company_news", search_company_news, company_name)
		if company_name else {"ok": False, "error": "company_name could not be inferred"}
	)
	results["tool_company_web_search"] = (
		_safe_call("tool_company_web_search", search_company_web, company_name)
		if company_name else {"ok": False, "error": "company_name could not be inferred"}
	)
	results["tool_company_wikipedia"] = (
		_safe_call("tool_company_wikipedia", get_company_wikipedia, company_name)
		if company_name else {"ok": False, "error": "company_name could not be inferred"}
	)
	results["tool_domain_reputation"] = (
		_safe_call("tool_domain_reputation", check_domain_reputation, domain_input)
		if domain_input else {"ok": False, "error": "domain/email/website not available"}
	)
	results["tool_email_verify"] = (
		_safe_call("tool_email_verify", verify_email, email)
		if email else {"ok": False, "error": "email not found in posting"}
	)
	results["tool_job_boards"] = (
		_safe_call("tool_job_boards", check_job_boards, context.title, company_name, context.location)
		if context.title and company_name else {
			"ok": False,
			"error": "title and company_name are required",
		}
	)
	results["tool_phone_check"] = (
		_safe_call("tool_phone_check", check_phone_number, phone)
		if phone else {"ok": False, "error": "phone not found in posting"}
	)
	results["tool_social_profiles"] = (
		_safe_call("tool_social_profiles", check_social_profiles, company_name)
		if company_name else {"ok": False, "error": "company_name could not be inferred"}
	)

	return results


def _format_dict_block(title: str, payload: dict[str, Any]) -> str:
	return f"{title}\n{'=' * len(title)}\n{json.dumps(payload, indent=2, ensure_ascii=True)}\n"


def write_reports(output_dir: Path, context: JobContext, tool_results: dict[str, Any]) -> tuple[Path, Path]:
	output_dir.mkdir(parents=True, exist_ok=True)
	stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
	stem = Path(context.file_path).stem

	summary_path = output_dir / f"{stem}_summary_{stamp}.txt"
	evidence_path = output_dir / f"{stem}_tool_evidence_{stamp}.txt"

	summary_text = []
	summary_text.append("Job Analyzer Summary")
	summary_text.append("====================")
	summary_text.append(f"Generated At: {datetime.now().isoformat()}")
	summary_text.append(f"Input File: {context.file_path}")
	summary_text.append("")
	summary_text.append("Extracted Core Fields")
	summary_text.append("---------------------")
	summary_text.append(f"Title: {context.title}")
	summary_text.append(f"Location: {context.location}")
	summary_text.append(f"Company Name: {context.company_name}")
	summary_text.append(f"Email: {context.email}")
	summary_text.append(f"Website: {context.website}")
	summary_text.append(f"Phone: {context.phone}")
	summary_text.append("")
	summary_text.append("Parsed Job Object")
	summary_text.append("-----------------")
	summary_text.append(json.dumps(context.parsed_job, indent=2, ensure_ascii=True))
	summary_text.append("")
	summary_text.append("Tool Execution Status")
	summary_text.append("---------------------")
	for tool_name, result in tool_results.items():
		status = "ok" if result.get("ok") else "failed"
		summary_text.append(f"- {tool_name}: {status}")
	summary_text.append("")

	evidence_text = []
	evidence_text.append("Job Analyzer Tool Evidence")
	evidence_text.append("==========================")
	evidence_text.append(f"Generated At: {datetime.now().isoformat()}")
	evidence_text.append(f"Input File: {context.file_path}")
	evidence_text.append("")
	for tool_name, result in tool_results.items():
		evidence_text.append(_format_dict_block(tool_name, result))

	summary_path.write_text("\n".join(summary_text), encoding="utf-8")
	evidence_path.write_text("\n".join(evidence_text), encoding="utf-8")
	return summary_path, evidence_path


def main() -> int:
	if len(sys.argv) < 2:
		print("Usage: python run.py <job-posting-file>")
		return 1

	file_path = sys.argv[1]
	if not Path(file_path).exists():
		print(f"Input file not found: {file_path}")
		return 1

	context = build_context(file_path)
	tool_results = run_all_tools(context)

	out_dir = Path(__file__).resolve().parent / "outputs"
	summary_path, evidence_path = write_reports(out_dir, context, tool_results)

	print("Job analysis completed.")
	print(f"Summary file : {summary_path}")
	print(f"Evidence file: {evidence_path}")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
