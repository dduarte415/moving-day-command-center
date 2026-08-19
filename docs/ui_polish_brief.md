# Moving Day — UI Polish Pass

## Core philosophy
Keep it simple and clean. Every element should have a purpose — fewer buttons, fewer decisions, progressive disclosure. This should feel like a lightweight moving assistant, not an enterprise dashboard.

## Keep current nav structure
Checklist / Budget / Internet Providers / Moves — no changes here.

Use a consistent active nav state: subtle blue background, blue icon/text, no inconsistent outlines/hover styles.

## General
- Keep current palette: navy/dark text, light gray background, white cards, blue primary actions, red only for destructive actions. Don't add more colors.
- Reduce excessive empty space; cap main content width around 900–1000px.
- Cards for summaries/forms; simple lists/dividers for actual task/expense rows — don't card-ify everything.
- Normalize address capitalization (456 Oakland Ave, not 456 oakland ave) and standardize date formatting everywhere.

## Checklist (should be the app's main experience)

**Empty state:** currently shows 3 empty category cards *plus* a big "No tasks yet" box — too much. Replace with one short, simple empty state:
> Your checklist is empty
> Add your first task to start planning your move.

Once tasks exist, group into Before Move / Moving Day / After Move.

**Adding a task:** make it near-effortless. Primary input is just "What needs to get done?" with an Add button (e.g. "Cancel gym membership [+ Add]"). Category and due date should be optional/secondary, not a required form every time.

**Task rows**, once tasks exist:
```
Before Move                         8 tasks
☐ Cancel gym membership             Mar 10
☐ Schedule movers                   Mar 12
☐ Notify landlord                   Mar 16
```
- Entire row clickable, large tap target
- Completed tasks fade/strike through
- Edit/delete tucked into a `...` menu, not always visible

**Progress:** simple "12 / 24 tasks complete" or "50% complete," optional subtle progress bar.

## Move header
Current ("Move date 3/19/2026 · Old address → New address") is too raw. Make it human:
```
Your move
March 19, 2026
6030 Sturgeon Lake Rd → 456 Oakland Ave
```
Optionally add a countdown ("18 days to go") as useful context, not just a raw field.

## Active Move selector
Fix truncation in the sidebar so the full move is readable. If there's only one move, skip the dropdown entirely — no need for that complexity with a single option.

## Moves page
Don't lead with "Start a new move" if a move already exists — prioritize showing the current move (route, date, and optionally quick stats like tasks/budget/internet status). Make "+ New move" a secondary action.

## Budget
Keep the current structure (summary, add expense, category/amount/paid) — it's good. Improve the summary to show something like "$850 spent of $3,000 · $2,150 remaining" with a subtle progress bar. Budget rows should read like a list, not a spreadsheet:
```
Moving truck rental          $850
Movers                       Paid ✓
```
Deleting a move or other destructive data needs a confirmation step.

## Empty states, generally
Keep them short, one instance each — don't repeat "No tasks yet" in multiple places on the same page.

## Priority order
1. Simplify the empty checklist state
2. Make adding a task effortless
3. Make the checklist the visually dominant page once tasks exist
4. Add simple task progress
5. Fix Active Move selector truncation
6. Make nav active states consistent
7. Reduce excessive width/empty space
8. Make the Moves page focus on the current move

**Rule:** don't add complexity just because a feature is possible. If something can be hidden until needed, hide it.

---
*Note: Address Change Assistant, AI-generated personalized checklists, and any monetization/referral features are intentionally out of scope for this pass — future ideas, not part of this work.*
