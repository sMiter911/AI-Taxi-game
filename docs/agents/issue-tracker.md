# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

**Convention for this repo: one map issue + one Answer Key issue, not a ticket per decision.** The map (`wayfinder:map` label) has exactly one native sub-issue: the Answer Key. Every open question is a section within the Answer Key issue's body (`## <n>. <question title>`, a `**Status:**` line, the question text, an `**Answer:**` line) — resolve a question by editing that section in place (fill in the Answer, flip Status to ✅ Answered), not by creating a new child issue. Reserve a genuinely separate issue only for a question type that can't live as a body section — e.g. a research question you want a subagent to close and comment on independently — and even then, fold its answer back into the Answer Key's corresponding section afterward and close the standalone issue.

GitHub's **native** sub-issue relationship (still used for map → Answer Key) is set via GraphQL (not yet exposed by plain `gh issue` flags):

- **Get an issue's GraphQL node id**: `gh api graphql -f query='query($n:Int!){repository(owner:"sMiter911",name:"AI-Taxi-game"){issue(number:$n){id}}}' -F n=<number> --jq '.data.repository.issue.id'`
- **Make an issue a child of the map**: `gh api graphql -f query='mutation($p:ID!,$c:ID!){addSubIssue(input:{issueId:$p,subIssueId:$c}){issue{number}}}' -f p=<parent node id> -f c=<child node id>'`
- **Claim a question**: no per-question assignee since there's no per-question issue; note who's working it as a line under that section's Status instead (e.g. `**Status:** In progress (@you)`).
- **Resolve a question**: edit the Answer Key issue body directly (`gh issue view 10 --json body -q .body` to fetch, edit, `gh issue edit 10 --body-file <tmpfile>` to save) — fill in `**Answer:**`, flip `**Status:**` to ✅ Answered. Also append a one-line gist to the map's "Decisions so far" pointing at the Answer Key.
- **Find the frontier**: read the Answer Key issue body; any section still `**Status:** Pending` (and not blocked per its own note) is open.
