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

This repo uses GitHub's **native** sub-issues and issue-dependency (blocking) relationships, via GraphQL (not yet exposed by plain `gh issue` flags):

- **Get an issue's GraphQL node id**: `gh api graphql -f query='query($n:Int!){repository(owner:"sMiter911",name:"AI-Taxi-game"){issue(number:$n){id}}}' -F n=<number> --jq '.data.repository.issue.id'`
- **Make an issue a child of the map**: `gh api graphql -f query='mutation($p:ID!,$c:ID!){addSubIssue(input:{issueId:$p,subIssueId:$c}){issue{number}}}' -f p=<parent node id> -f c=<child node id>'`
- **Mark one ticket blocked by another**: `gh api graphql -f query='mutation($i:ID!,$b:ID!){addBlockedBy(input:{issueId:$i,blockingIssueId:$b}){issue{number}}}' -f i=<blocked issue node id> -f b=<blocking issue node id>'`
- **Find the frontier** (open, unblocked, unclaimed children of the map): list the map's sub-issues (GitHub UI shows this natively on the map issue page, including blocked/open state), then filter to `state:open`, no assignee, and not shown as blocked in the UI. There is no single CLI query for this yet — check the map issue's sub-issues panel in the browser, or fetch each child with `gh issue view <number>` and inspect assignee + the issue page's "Blocked by" panel.
- **Claim a ticket**: `gh issue edit <number> --add-assignee @me`
- **Resolve a ticket**: `gh issue comment <number> --body "..."` (the resolution) then `gh issue close <number>`
