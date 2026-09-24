#!/usr/bin/env bash
# Repo hygiene as a ratchet gate, not a memory (TASKS row 139). Mattias 10:1x: "per repo att det är någon reminder
# att då och då städa repo strukturen... lite som vi har nu med att filer inte får vara max 500 rader"; 10:2x:
# "behövs ju någon tydlig kodmässig deterministisk trigger".
#
# Read-only: it names clutter, it never deletes or moves anything. Six checks, each counted against
# scripts/repo-hygiene-baseline.txt:
#   merged-branch        an origin branch merged into the default branch whose tip is older than 7 days
#   unreferenced-plan    a docs/plans file (not README.md, not under archive/) older than 30 days that no tracked file
#                        outside docs/plans names; its age is the date in its name, else its last commit
#   unreferenced-root-md a root-level .md no other tracked file names (README.md, AGENTS.md and CLAUDE.md are read by
#                        name by GitHub and the agent harnesses, so they count as named)
#   missing-doc-path     a backticked path in ARCHITECTURE.md or AGENTS.md that no tracked path is or ends with
#   closed-ledger-row    a closed row in the main checkout's .agents/0/TASKS.md whose newest date is older than 7 days,
#                        or that carries no date at all (the ledger is prose outside git; the fix is the archive file)
#   stale-worktree       a linked worktree whose HEAD is already in the default branch (or whose directory is gone)
#                        and that has not moved for 7 days (the later of its HEAD commit and its reflog)
# The facts are read the way the amux janitor reads them (agentmux core/repo-hygiene-facts.mjs, #369), so a nightly
# report and this gate name the same things. Branches and worktrees are this clone's state, not the commit's: that is
# the point of the gate, and why it can go red on a day nobody committed.
#
# Ratchet, like check-file-length.sh: a count above its baseline fails and names every offender; a count below it
# fails until the baseline row is lowered in the same change, so a cleanup is kept. The baseline never rises.
# Every run first builds a fixture repository with one planted offender and one look-alike per check, and fails
# unless exactly the planted ones are named: a gate that stopped seeing is not green.
#
# Exit 0 at baseline, 1 above or below it, 2 when the self-test or a fact read fails (treat as red).
# Run as: env -u 'BASH_FUNC_grep%%' bash scripts/check-repo-hygiene.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

python3 - "$ROOT" <<'PY'
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

DAY = 86400
CHECKS = ["merged-branch", "unreferenced-plan", "unreferenced-root-md", "missing-doc-path", "closed-ledger-row", "stale-worktree"]
NAMED_BY_CONVENTION = {"README.md", "AGENTS.md", "CLAUDE.md"}
# Skyvw's docs name CircleKit's modules and CircleKit's docs name Skyvw's; a root this repo does not have is the other's to check.
SIBLING_ROOTS = {"product-spec", "product-emit", "designkit", "ringkit", "renderkit", "servicekit", "studio-debug-android", "releasekit", "releasekit-ui",
                 "bddkit", "circlekit-assets", "skydiving-legos", "appspec", "app", "jumpcore", "skyvwui"}
CLOSED_STATE = re.compile(r"\b(?:CLOSED|RELEASED|SUPERSEDED|DROPPED|STRUKEN|DONE|MERGED)\b")
ISO_DATE = re.compile(r"\b(20\d\d-\d\d-\d\d)\b")


class FactError(Exception):
    pass


def git(repo, *args, check=True):
    done = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
    if check and done.returncode != 0:
        raise FactError(f"git {' '.join(args)}: {done.stderr.strip()}")
    return done.stdout


def lines(text):
    return [line for line in text.splitlines() if line]


def default_branch(repo):
    head = git(repo, "symbolic-ref", "--quiet", "refs/remotes/origin/HEAD", check=False).strip()
    if head:
        return head.rsplit("/", 1)[-1]
    for name in ("main", "master"):
        if git(repo, "rev-parse", "--verify", "--quiet", f"refs/remotes/origin/{name}", check=False).strip():
            return name
    raise FactError("no origin/HEAD, origin/main or origin/master to measure against")


def day_of(text):
    return time.mktime(time.strptime(text, "%Y-%m-%d"))


def merged_branches(repo, branch, now):
    refs = git(repo, "for-each-ref", "refs/remotes/origin", f"--merged=refs/remotes/origin/{branch}",
               "--format=%(refname:lstrip=3)\t%(committerdate:unix)\t%(symref)")
    found = []
    for name, at, symref in (line.split("\t") for line in lines(refs)):
        if name != branch and not symref and now - int(at) > 7 * DAY:
            found.append(f"origin/{name} ({(now - int(at)) // DAY} days)")
    return found


def tracked(repo):
    """Tracked files as they stand in the checkout, so a cleanup shows before it is committed."""
    return lines(git(repo, "ls-files"))


def named_elsewhere(repo, names, outside):
    """The names some tracked file outside `outside` (a pathspec) contains."""
    if not names:
        return set()
    args = ["grep", "-o", "-F", "-h"]
    for name in sorted(names):
        args += ["-e", name]
    out = git(repo, *args, "--", ".", *outside, check=False)
    return {match for match in lines(out) if match in names}


def unreferenced_plans(repo, now):
    plans = [p for p in tracked(repo) if p.startswith("docs/plans/") and p.endswith(".md")
             and not p.startswith("docs/plans/archive/") and os.path.basename(p) != "README.md"]
    named = named_elsewhere(repo, {os.path.basename(p) for p in plans}, [":!docs/plans"])
    found = []
    for path in plans:
        if os.path.basename(path) in named:
            continue
        dated = re.match(r"(20\d\d-\d\d-\d\d)", os.path.basename(path))
        at = day_of(dated.group(1)) if dated else int(git(repo, "log", "-1", "--format=%ct", "HEAD", "--", path).strip() or 0)
        if not at:
            raise FactError(f"{path}: neither a date in its name nor a commit to date it")
        if now - at > 30 * DAY:
            found.append(f"{path} ({int(now - at) // DAY} days)")
    return found


def unreferenced_root_docs(repo):
    roots = [p for p in tracked(repo) if "/" not in p and p.endswith(".md") and p not in NAMED_BY_CONVENTION]
    found = []
    for doc in roots:
        if doc not in named_elsewhere(repo, {doc}, [f":!{doc}"]):
            found.append(doc)
    return found


def missing_doc_paths(repo):
    main_checkout = Path(git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir").strip()).parent
    paths = tracked(repo)
    whole = set(paths)
    dirs = {"/".join(p.split("/")[:i]) for p in paths for i in range(1, p.count("/") + 1)}
    found = []
    for doc in ("ARCHITECTURE.md", "AGENTS.md"):
        if doc not in whole:
            continue
        text = (Path(repo) / doc).read_text(encoding="utf-8")
        for number, line in enumerate(text.splitlines(), 1):
            for token in re.findall(r"`([^`\s]+)`", line):
                if not re.search(r"/|\.(?:sh|md|ts|kt|kts|json|mjs|py|txt)$", token):
                    continue
                if re.search(r"[<>*{}$|]|\.\.\.|^(?:https?:|@|/|~|-|origin/)", token):
                    continue  # a placeholder, glob, URL, package, absolute path, flag or git ref
                path = re.sub(r"(?::\d+(?:-\d+)?|#.*)$", "", token).strip("/").removeprefix("./")
                if not path or path in whole or path in dirs:
                    continue
                if path.startswith(".agents/") and (main_checkout / path).exists():
                    continue  # the agents' ledger area is untracked by design and lives in the main checkout
                if "/" in path and path.split("/")[0] in SIBLING_ROOTS and path.split("/")[0] not in dirs:
                    continue
                if any(p.endswith("/" + path) for p in paths) or any(d.endswith("/" + path) for d in dirs):
                    continue
                found.append(f"{doc}:{number} `{token}`")
    return found


def closed_ledger_rows(repo, now):
    common = Path(git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir").strip())
    ledger = common.parent / ".agents/0/TASKS.md"
    if not ledger.is_file():
        return []
    found = []
    for line in ledger.read_text(encoding="utf-8").splitlines():
        if not re.match(r"^\| \d+ \|", line):
            continue
        cells = line.split("|")
        if len(cells) != 7:
            raise FactError(f"{ledger}: row {cells[1].strip()} has {len(cells) - 2} cells, the ledger has 5")
        if not CLOSED_STATE.search(cells[5]):
            continue
        dates = ISO_DATE.findall(line)
        if not dates:
            found.append(f"row {cells[1].strip()} (closed, no date)")
        elif now - day_of(max(dates)) > 7 * DAY:
            found.append(f"row {cells[1].strip()} (newest date {max(dates)})")
    return found


def stale_worktrees(repo, branch, now):
    common = Path(git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir").strip())
    admin = {}
    for folder in (common / "worktrees").glob("*") if (common / "worktrees").is_dir() else []:
        gitdir = folder / "gitdir"
        if gitdir.is_file():
            admin[str(Path(gitdir.read_text().strip()).parent)] = folder
    found = []
    for block in git(repo, "worktree", "list", "--porcelain").split("\n\n")[1:]:
        path = re.search(r"^worktree (.+)$", block, re.M)
        if not path:
            continue
        path = path.group(1)
        if re.search(r"^prunable", block, re.M):
            found.append(f"{path} (directory gone)")
            continue
        head = re.search(r"^HEAD (\w+)$", block, re.M)
        if not head:
            raise FactError(f"{path}: no HEAD in git worktree list")
        merged = subprocess.run(["git", "-C", str(repo), "merge-base", "--is-ancestor", head.group(1),
                                 f"refs/remotes/origin/{branch}"]).returncode == 0
        if not merged:
            continue
        moved = int(git(repo, "log", "-1", "--format=%ct", head.group(1)).strip() or 0)
        reflog = admin.get(path, Path("/nonexistent")) / "logs/HEAD"
        if reflog.is_file():
            stamps = re.findall(r"> (\d+) [+-]\d{4}\t", reflog.read_text(errors="replace"))
            moved = max([moved, *map(int, stamps)])
        if now - moved > 7 * DAY:
            found.append(f"{path} ({(now - moved) // DAY} days)")
    return found


def measure(repo, now):
    branch = default_branch(repo)
    return {
        "merged-branch": merged_branches(repo, branch, now),
        "unreferenced-plan": unreferenced_plans(repo, now),
        "unreferenced-root-md": unreferenced_root_docs(repo),
        "missing-doc-path": missing_doc_paths(repo),
        "closed-ledger-row": closed_ledger_rows(repo, now),
        "stale-worktree": stale_worktrees(repo, branch, now),
    }


def self_test():
    """One planted offender and one look-alike per check, in a throwaway repository; exactly the planted ones must be named."""
    now = int(time.time()) + 20 * DAY
    stamp = lambda days_before: time.strftime("%Y-%m-%d", time.localtime(now - days_before * DAY))
    with tempfile.TemporaryDirectory(prefix="repo-hygiene-") as tmp:
        tmp = Path(tmp)
        env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t",
               "GIT_COMMITTER_EMAIL": "t@t", "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_CONFIG_NOSYSTEM": "1"}
        run = lambda cwd, *args, days_before=0: subprocess.run(
            ["git", *args], cwd=cwd, check=True, capture_output=True,
            env={**env, "GIT_COMMITTER_DATE": f"@{now - days_before * DAY}", "GIT_AUTHOR_DATE": f"@{now - days_before * DAY}"})
        origin, repo = tmp / "origin.git", tmp / "repo"
        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(origin)], check=True, env=env)
        subprocess.run(["git", "clone", "-q", str(origin), str(repo)], check=True, env=env, capture_output=True)
        files = {
            "README.md": "See NOTES.md, ARCHITECTURE.md and docs/plans/2026-01-02-cited.md.\n",
            "NOTES.md": "named by README\n",
            "ORPHAN.md": "named by nothing\n",
            "ARCHITECTURE.md": "Gate in `scripts/gone.sh`; entry `README.md`; package `plans/archive`; placeholder `<name>.md`;"
                               " ref `origin/main`; sibling `product-spec/GUIDE.md`; ledger `.agents/0/NOTE.md`.\n",
            "docs/plans/2026-01-01-old-plan.md": "old, dated, named by nothing\n",
            "docs/plans/2026-01-02-cited.md": "old, dated, named by README\n",
            f"docs/plans/{stamp(3)}-fresh-plan.md": "dated three days ago\n",
            "docs/plans/archive/2026-01-03-archived.md": "archived\n",
        }
        for name, text in files.items():
            (repo / name).parent.mkdir(parents=True, exist_ok=True)
            (repo / name).write_text(text)
        run(repo, "add", "-A")
        run(repo, "commit", "-q", "-m", "base", days_before=40)
        (repo / "docs/plans/undated-old.md").write_text("undated, committed 40 days before now\n")
        run(repo, "add", "-A")
        run(repo, "commit", "-q", "-m", "undated plan", days_before=40)
        (repo / "docs/plans/undated-fresh.md").write_text("undated, committed two days before now\n")
        run(repo, "add", "-A")
        run(repo, "commit", "-q", "-m", "fresh undated plan", days_before=2)
        run(repo, "push", "-q", "origin", "HEAD:main")
        run(repo, "remote", "set-head", "origin", "main")
        for name, days in (("old-merged", 20), ("fresh-merged", 1)):
            run(repo, "checkout", "-q", "-b", name, "main")
            (repo / f"{name}.txt").write_text(name)
            run(repo, "add", "-A")
            run(repo, "commit", "-q", "-m", name, days_before=days)
            run(repo, "push", "-q", "origin", name)
            run(repo, "checkout", "-q", "main")
            run(repo, "merge", "-q", "--ff-only", name)
        run(repo, "push", "-q", "origin", "HEAD:main")
        run(repo, "fetch", "-q", "origin")
        base = subprocess.run(["git", "rev-list", "--max-parents=0", "main"], cwd=repo, check=True, capture_output=True,
                              text=True, env=env).stdout.strip()
        # A detached worktree at a commit 40 days old: a detached HEAD keeps no reflog, so the commit dates it.
        run(repo, "worktree", "add", "-q", "--detach", str(tmp / "stale-wt"), base)
        (tmp / "fresh-wt").mkdir()
        run(repo, "worktree", "add", "-q", "--detach", str(tmp / "fresh-wt" / "wt"), "main")
        (repo / ".agents/0").mkdir(parents=True)
        (repo / ".agents/0/NOTE.md").write_text("untracked, on disk\n")
        (repo / ".agents/0/TASKS.md").write_text("\n".join([
            f"| 1 | open | a | b | opened {stamp(30)} |",
            f"| 2 | old closed | a | b | CLOSED {stamp(20)} |",
            f"| 3 | fresh closed | a | b | CLOSED {stamp(1)} |",
            "| 4 | undated closed | a | b | DONE |",
        ]) + "\n")
        got = measure(repo, now)
    wt = str(tmp / "stale-wt")
    expected = {
        "merged-branch": ["origin/old-merged (20 days)"],
        "unreferenced-plan": ["docs/plans/2026-01-01-old-plan.md", "docs/plans/undated-old.md (40 days)"],
        "unreferenced-root-md": ["ORPHAN.md"],
        "missing-doc-path": ["ARCHITECTURE.md:1 `scripts/gone.sh`"],
        "closed-ledger-row": [f"row 2 (newest date {stamp(20)})", "row 4 (closed, no date)"],
        "stale-worktree": [f"{wt} (40 days)"],
    }
    wrong = []
    for check in CHECKS:
        want = expected[check]
        have = got[check]
        if check == "unreferenced-plan":
            ok = len(have) == 2 and have[0].startswith(want[0]) and have[1] == want[1]
        else:
            ok = have == want
        if not ok:
            wrong.append(f"{check}: named {have}, expected {want}")
    return wrong


def baseline(path):
    counts = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            name, count = line.split()
            counts[name] = int(count)
    missing = [check for check in CHECKS if check not in counts]
    if missing:
        raise FactError(f"{path.name} has no row for {', '.join(missing)}")
    return counts


def main():
    root = Path(sys.argv[1])
    started = time.time()
    try:
        wrong = self_test()
    except (subprocess.CalledProcessError, FactError) as failure:
        wrong = [f"the fixture could not be built or read: {failure}"]
    if wrong:
        print("check-repo-hygiene: FAIL: the self-test fixture was not read as planted, so a green here would mean nothing:")
        for line in wrong:
            print(f"  {line}")
        return 2
    try:
        found = measure(root, int(time.time()))
        allowed = baseline(root / "scripts/repo-hygiene-baseline.txt")
    except FactError as failure:
        print(f"check-repo-hygiene: FAIL: a fact could not be read: {failure}")
        return 2
    status = 0
    for check in CHECKS:
        count, limit = len(found[check]), allowed[check]
        if count > limit:
            status = 1
            print(f"FAIL  {check}: {count}, baseline {limit}. Clean up (archive, delete the merged branch, remove the worktree); never raise the baseline:")
            for offender in found[check]:
                print(f"        {offender}")
        elif count < limit:
            status = 1
            print(f"FAIL  {check}: {count}, below baseline {limit}. Lower its row in scripts/repo-hygiene-baseline.txt to {count} in this change.")
        else:
            print(f"ok    {check}: {count} (baseline {limit})")
    print(f"      self-test named exactly its planted offenders; {time.time() - started:.1f} s")
    return status


sys.exit(main())
PY
