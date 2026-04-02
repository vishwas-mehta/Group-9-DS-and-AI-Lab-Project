"""
Job Posting Feature Extractor
==============================
Importable module + optional CLI agent.

─── As a library ─────────────────────────────────────────────────────────────
    from job_parser_agent import parse_job_posting, JobPosting

    job: JobPosting = parse_job_posting("job_posting.pdf")
    print(job.title)
    print(job.model_dump())

─── As CLI agent ─────────────────────────────────────────────────────────────
    python job_parser_agent.py path/to/job_posting.pdf

─── Switch model (env vars, no code changes) ─────────────────────────────────
    AGENT_PROVIDER=openai    AGENT_MODEL=gpt-4.1-nano                  (default)
    AGENT_PROVIDER=anthropic AGENT_MODEL=claude-3-5-sonnet-20241022
    AGENT_PROVIDER=google    AGENT_MODEL=gemini-2.0-flash
    AGENT_PROVIDER=ollama    AGENT_MODEL=llama3.1

─── Install ──────────────────────────────────────────────────────────────────
    pip install langchain langchain-openai langchain-community \\
                docx2txt pypdf unstructured
"""

from __future__ import annotations

import os
import pathlib
import sys
from typing import Literal, Optional

from pydantic import BaseModel, Field

from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import tool
from langchain_community.document_loaders import (
    Docx2txtLoader,              # .docx / .doc
    PyPDFLoader,                 # .pdf
    UnstructuredHTMLLoader,      # .html / .htm
    UnstructuredMarkdownLoader,  # .md
    TextLoader,                  # .txt  (also used as fallback)
)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 ── LLM FACTORY
# ══════════════════════════════════════════════════════════════════════════════

def get_llm(temperature: float = 0) -> BaseChatModel:
    """
    Return a configured LangChain chat model.
    Provider and model name are read from environment variables so you can
    switch without touching any code.

    Env vars:
        AGENT_PROVIDER  openai (default) | anthropic | google | ollama
        AGENT_MODEL     model name       (default: gpt-4.1-nano)
    """
    provider = os.getenv("AGENT_PROVIDER", "openai").lower()
    model    = os.getenv("AGENT_MODEL",    "gpt-4.1-nano")

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model, temperature=temperature)

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic          # pip install langchain-anthropic
        return ChatAnthropic(model=model, temperature=temperature)

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI  # pip install langchain-google-genai
        return ChatGoogleGenerativeAI(model=model, temperature=temperature)

    if provider == "ollama":
        from langchain_ollama import ChatOllama                # pip install langchain-ollama
        return ChatOllama(model=model, temperature=temperature)

    raise ValueError(
        f"Unknown AGENT_PROVIDER={provider!r}. "
        "Supported: openai | anthropic | google | ollama"
    )


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 ── PYDANTIC SCHEMA
# All optional fields default to None (absent field ≠ empty string).
# LangChain's .with_structured_output() fills this schema via function-calling
# and validates the response automatically — no manual JSON parsing needed.
# ══════════════════════════════════════════════════════════════════════════════

class JobPosting(BaseModel):
    """
    Structured extraction of a job posting.
    Mirrors the Kaggle 'Real or Fake Job Postings' dataset (shivamb) used in
    Milestone-2. Optional fields are None when not present in the source text.
    """

    # ── Group A: Free-text fields (5 columns) ────────────────────────────────
    title: str = Field(
        description="Job title exactly as posted, e.g. 'Senior Software Engineer'."
    )
    description: Optional[str] = Field(
        default=None,
        description="Full job description / responsibilities / role overview."
    )
    requirements: Optional[str] = Field(
        default=None,
        description="Required qualifications, skills, certifications and experience."
    )
    company_profile: Optional[str] = Field(
        default=None,
        description="'About the company' section or description of the hiring organisation."
    )
    company_name: Optional[str] = Field(
        default=None,
        description="Official company/employer name as written in the posting."
    )
    company_website: Optional[str] = Field(
        default=None,
        description="Official company website URL if present (prefer full URL)."
    )
    contact_email: Optional[str] = Field(
        default=None,
        description="Recruiter or hiring contact email address if explicitly present."
    )
    contact_phone: Optional[str] = Field(
        default=None,
        description="Recruiter or hiring contact phone number if explicitly present."
    )
    benefits: Optional[str] = Field(
        default=None,
        description="Benefits, perks and compensation extras offered with the role."
    )

    # ── Group B: Structured metadata fields (8 columns) ──────────────────────
    location: Optional[str] = Field(
        default=None,
        description="Job location as a string, e.g. 'San Francisco, CA, US'."
    )
    department: Optional[str] = Field(
        default=None,
        description="Organisational department or team, e.g. 'Engineering', 'Finance'."
    )
    salary_range: Optional[str] = Field(
        default=None,
        description="Salary band as a plain string, e.g. '50000-70000' or '$80k-$100k'."
    )
    employment_type: Optional[Literal[
        "Full-time", "Part-time", "Contract", "Temporary", "Other"
    ]] = Field(
        default=None,
        description="Employment type. Set to null if not stated."
    )
    required_experience: Optional[Literal[
        "Entry level", "Mid-Senior level", "Associate",
        "Director", "Executive", "Internship", "Not Applicable"
    ]] = Field(
        default=None,
        description="Required experience level. Set to null if not stated."
    )
    required_education: Optional[Literal[
        "Bachelor's Degree", "Master's Degree", "Doctorate",
        "High School or equivalent", "Associate Degree",
        "Some College Coursework Completed", "Professional",
        "Certification", "Vocational", "Some High School Coursework",
        "Unspecified"
    ]] = Field(
        default=None,
        description="Minimum education requirement. Set to null if not stated."
    )
    industry: Optional[str] = Field(
        default=None,
        description="Industry classification, e.g. 'Information Technology and Services'."
    )
    function: Optional[str] = Field(
        default=None,
        description="Job function / category, e.g. 'Engineering', 'Sales', 'Marketing'."
    )

    # ── Group C: Binary / categorical flags (3 columns) ──────────────────────
    has_company_logo: Optional[Literal[0, 1]] = Field(
        default=None,
        description="1 if a company logo URL or image is present, 0 if explicitly absent, null if unknown."
    )
    telecommuting: Optional[Literal[0, 1]] = Field(
        default=None,
        description="1 if remote/work-from-home is offered, 0 if office-only, null if not mentioned."
    )
    has_questions: Optional[Literal[0, 1]] = Field(
        default=None,
        description="1 if screening/application questions are included, 0 if not, null if unknown."
    )


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3 ── DOCUMENT LOADER
# Add a new format by inserting one entry into _LOADER_MAP.
# ══════════════════════════════════════════════════════════════════════════════

_LOADER_MAP: dict[str, type] = {
    ".docx": Docx2txtLoader,
    ".doc":  Docx2txtLoader,
    ".pdf":  PyPDFLoader,
    ".html": UnstructuredHTMLLoader,
    ".htm":  UnstructuredHTMLLoader,
    ".md":   UnstructuredMarkdownLoader,
    ".txt":  TextLoader,
}


def load_document(file_path: str) -> str:
    """
    Return the plain-text content of a file.
    Picks the right LangChain loader by extension; falls back to TextLoader.
    """
    suffix = pathlib.Path(file_path).suffix.lower()
    loader_cls = _LOADER_MAP.get(suffix, TextLoader)
    docs = loader_cls(file_path).load()
    return "\n\n".join(doc.page_content for doc in docs)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4 ── PUBLIC API  ← import this in other files
# ══════════════════════════════════════════════════════════════════════════════

def parse_job_posting(file_path: str) -> JobPosting:
    """
    Extract all job-posting features from a document file.

    Supports: .docx, .doc, .pdf, .html, .htm, .md, .txt

    Returns a validated JobPosting Pydantic object.
    Optional fields are None when not found in the source document.

    Usage from another module:
        from job_parser_agent import parse_job_posting, JobPosting

        job: JobPosting = parse_job_posting("job_posting.pdf")
        print(job.title)
        print(job.model_dump())       # dict
        print(job.model_dump_json())  # JSON string
    """
    text = load_document(file_path)

    # .with_structured_output() is LangChain's recommended approach:
    # it uses the model's function-calling capability to fill the Pydantic
    # schema directly and raises a validation error if the output is invalid.
    extraction_llm = get_llm().with_structured_output(JobPosting)

    return extraction_llm.invoke(
        "You are an expert at parsing job postings. "
        "Extract every field precisely, following each field's description. "
        "Set any field that is absent in the text to null — never invent data.\n\n"
        f"Job Posting Text:\n{text}"
    )


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5 ── TOOL  (wraps the public API for use inside an agent)
# ══════════════════════════════════════════════════════════════════════════════

@tool
def job_posting_parser_tool(file_path: str) -> dict:
    """
    Agent tool: extract all structured features from a job-posting document.

    Supports: .docx, .doc, .pdf, .html, .htm, .md, .txt

    Returns a dict with all fields from the JobPosting schema.
    Fields absent in the source document are null.
    """
    return parse_job_posting(file_path).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6 ── AGENT  (optional — use only for interactive / multi-step use)
# ══════════════════════════════════════════════════════════════════════════════

def create_job_parser_agent():
    """Construct a tool-calling agent backed by the extraction tool.

    Uses the LangChain v1.x create_agent() API (LangGraph-backed).
    Returned agent is invoked with:
        result = agent.invoke({"messages": [{"role": "user", "content": "..."}]})
        answer  = result["messages"][-1].content
    """
    llm = get_llm()
    tools = [job_posting_parser_tool]
    return create_agent(
        llm,
        tools=tools,
        system_prompt=(
            "You are a job-posting analysis assistant. "
            "When given a file path, use the job_posting_parser_tool "
            "and present the results clearly."
        ),
    )


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 7 ── CLI ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    agent = create_job_parser_agent()
    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": f"Extract all features from this job posting file: {sys.argv[1]}",
                }
            ]
        }
    )

    print("\n" + "═" * 60)
    print("Extracted Job Posting Features")
    print("═" * 60)
    # v1.x: final answer is the last message in the messages list
    print(result["messages"][-1].content)