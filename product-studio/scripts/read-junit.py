"""Bounded JUnit XML decoder. No DTD, entities, network access or test execution."""
import json
import sys
import xml.etree.ElementTree as ET

try:
    raw = sys.stdin.buffer.read(4_000_001)
    upper = raw.upper()
    if len(raw) > 4_000_000 or b"<!DOCTYPE" in upper or b"<!ENTITY" in upper:
        raise ValueError("JUnit input is oversized or contains unsupported entity declarations.")
    root = ET.fromstring(raw)
    if root.tag not in ("testsuite", "testsuites"):
        raise ValueError("Expected JUnit testsuite or testsuites.")
    suites = []
    for suite in root.iter("testsuite"):
        cases = []
        for case in suite.findall("testcase"):
            cases.append({
                "name": case.get("name"),
                "className": case.get("classname"),
                "file": case.get("file"),
                "line": case.get("line"),
                "seconds": case.get("time"),
                "status": "failed" if case.find("failure") is not None or case.find("error") is not None
                    else "skipped" if case.find("skipped") is not None else "passed",
            })
        suites.append({
            "name": suite.get("name"),
            "timestamp": suite.get("timestamp"),
            "seconds": suite.get("time"),
            "tests": suite.get("tests"),
            "failures": suite.get("failures"),
            "errors": suite.get("errors"),
            "cases": cases,
        })
    if sum(len(s["cases"]) for s in suites) > 10_000:
        raise ValueError("JUnit input contains more than 10000 cases.")
    print(json.dumps({"suites": suites}))
except (ValueError, ET.ParseError) as error:
    print(str(error), file=sys.stderr)
    sys.exit(1)
