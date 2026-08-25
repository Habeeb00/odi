# Test boards

Ready-to-use boards for manual testing. Login now requires the **join code**
(to raise/vote as a member) and admin actions require a separate **admin
code** (to manage members/categories/assets/settings) — the two are
intentionally different codes.

## Test Squad

- URL: `/test-squad-2`
- Join code (member login): `WPU9HA`
- Admin code: `G35R5N`
- Members: Alex, Bea, Chris, Dee

## Demo Crew

- URL: `/demo-crew`
- Join code (member login): `V44XD5`
- Admin code: `7HG7DJ`
- Members: Nina, Omar, Priya

## Your original board

- URL: `/tinkerhub-mx4m`
- Admin code: `TSDCDD`
- (Join code was never set on this board — generate one from Admin →
  Settings if you want to test member login there.)

## How to log in

1. Open a board URL. If you're not recognized yet, a "Who are you?" prompt
   appears asking for the join code plus which member you are.
2. Enter the join code once — it's remembered after that (session cookie).

## How to get into Admin

1. Go to `/<slug>/admin`.
2. Enter the admin code once — also remembered after that.
3. Whoever creates a board is auto-unlocked as its admin immediately.

## Notes

- A handful of other stale test boards exist in the DB from earlier testing
  (`humans-j0vm`, `theepori-xore`, `tinkerhub-wxys`, `gang-refn`,
  `tinkerhub-8led`, `tinekrhub-tr6a`, `odddi-rn45`, `tinkerhub`,
  `tinkerhub-2`, `test`) — safe to delete if you don't need them.
- To create a fresh board any time: go to `/` and use "Create a board".
