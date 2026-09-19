"""Check collaboration documents without installing dependencies or contacting services.

This is repository scaffolding validation, not an application test suite.
"""

from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
DOCUMENTS = (
    "README.md",
    "PROJECT_PLAN.md",
    "AGENTS.md",
    ".github/pull_request_template.md",
    "docs/product/EvidenceBridge_PRODUCT_BLUEPRINT.md",
    "docs/product/EvidenceBridge_BASELINE.md",
    "app/hr/README.md",
    "app/candidate/README.md",
    "app/backend/README.md",
    "docs/backend/API.md",
    "docs/backend/ADR.md",
    "docs/backend/DATA.md",
    "docs/backend/HANDOFF.md",
    "docs/backend/ACCEPTANCE.md",
    "docs/backend/TEST_RESULTS.md",
    "docs/backend/SECURITY_REVIEW.md",
    "docs/backend/REVISION_PLAN.md",
    "docs/FRONTEND_API_HANDOFF.md",
)
LINK = re.compile(r"!?\[[^\]\n]*\]\(([^)\s]+)\)")


def main():
    errors = []
    for name in DOCUMENTS:
        document = ROOT / name
        if not document.is_file():
            errors.append(f"Missing document: {name}")
            continue
        content = document.read_text(encoding="utf-8")
        if not content.strip():
            errors.append(f"Empty document: {name}")
        for target in LINK.findall(content):
            url = urlsplit(target)
            if url.scheme or url.netloc or not url.path:
                continue
            resolved = (document.parent / unquote(url.path)).resolve()
            if not resolved.is_relative_to(ROOT):
                errors.append(f"Link outside repository: {name} -> {target}")
            elif not resolved.exists():
                errors.append(f"Broken local link: {name} -> {target}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"PASS: {len(DOCUMENTS)} collaboration documents and their local link targets.")
    print("Application tests, Markdown anchors, external URLs and deployments are not checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
