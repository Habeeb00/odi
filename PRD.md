# Oddy Board — Product Requirements Document

## 1. Product Overview

Oddy Board is a playful, meme-powered leaderboard for friend groups, teams, and workplaces.

An OD / Oddy is a funny, low-stakes form of betrayal or unnecessary chathi.

Example:

Three friends go to a movie without inviting the fourth.

The fourth person can raise:

OD against Rahul
"Went for a movie without inviting us."

The group can then judge the incident, and Rahul's OD score changes accordingly.

The product combines:

* A live leaderboard
* OD requests
* Asynchronous community voting
* Funny verdicts
* Malayalam movie references
* Developer-provided images and dialogues
* Face cutouts
* A shared-screen experience

The product should remain extremely simple technically and visually.

⸻

## 2. Product Vision

Oddy Board should become a shared piece of entertainment for a group.

It should create a simple loop:

Something happens → Someone raises an OD → Others discover it → People judge it → Verdict → Score changes → Leaderboard

The product should make people think:

"This deserves an OD."

The product is not intended to become a serious social network, productivity tool, or analytics platform.

It is a tiny social game built around inside jokes.

⸻

## 3. Core Experience

Oddy Board has two primary experiences:

### A. Phone

Used for:

* Raising ODs
* Viewing incidents
* Voting
* Viewing scores
* Managing the board

### B. Shared Display

Used for:

* Showing the leaderboard
* Announcing new ODs
* Showing evidence
* Showing relevant movie/meme assets
* Showing verdicts
* Showing score changes

The shared display should be the entertainment layer.

The phone should be the interaction layer.

⸻

## 4. The Fundamental Change: Asynchronous Voting

### Problem

People will not always be online at the same time.

Therefore, an OD cannot depend on everyone being present simultaneously.

There should be no requirement for a live group vote.

Instead, every OD becomes an asynchronous case.

### Flow

```
OD RAISED
    ↓
PENDING
    ↓
PEOPLE SEE IT WHENEVER THEY ARE AVAILABLE
    ↓
PEOPLE VOTE
    ↓
VOTES ACCUMULATE
    ↓
CASE CLOSES
    ↓
FINAL SCORE
    ↓
LEADERBOARD
```

People can vote minutes or hours after the OD is raised.

⸻

## 5. OD Lifecycle

Every OD has a simple state.

1. **Raised** — Someone submits an OD.
2. **Pending** — The OD is waiting for community judgment.
3. **Under Investigation** — People have started voting.
4. **Closed** — The voting window has ended or the case has reached its closing condition.
5. **Scored** — The final OD score is added to the accused person's leaderboard.

⸻

## 6. Raising an OD

A member can raise an OD against another member.

The form should be minimal.

**Required**

* Person
* Reason

**Optional**

* Evidence image
* Category
* Requested severity

Example:

```
RAISE AN OD

Against: Rahul

What happened?

Went to watch a movie with Amal and didn't invite us.

Evidence: 📸

Submit OD
```

The user should not have to configure complicated scoring parameters.

⸻

## 7. OD Categories

The initial system can support:

* OD / Oddy
* Loyalty
* Novelty
* Other custom categories

However, OD remains the primary category and core identity of the product.

Categories should also determine which visual assets and dialogues are shown.

⸻

## 8. Asset-Driven Experience

The product should be built around a developer-provided asset library.

The asset library can contain:

* Malayalam movie scenes
* Movie stills
* Characters
* Reaction images
* Dialogues
* Backgrounds
* Verdict graphics
* Character animations
* Category-specific assets

The application should use these assets wherever possible.

**Priority**

```
Developer-provided asset
        ↓
Developer-provided dialogue
        ↓
Basic UI text
```

Do not invent additional content just to fill space.

⸻

## 9. No AI-Generated Content

AI should not be used to generate the humour.

Do not automatically generate:

* Memes
* Malayalam dialogues
* Images
* Movie scenes
* Random jokes
* Random emojis
* Random reactions
* Decorative illustrations

The humour should come from the human-curated asset library.

AI can assist in implementing the interface, but the actual creative content should come from the supplied assets.

⸻

## 10. Category → Asset Mapping

Every category can have its own asset collection.

Example:

```
OD
 ├── Betrayal Asset 01
 ├── Betrayal Asset 02
 └── Betrayal Asset 03
LOYALTY
 ├── Loyalty Asset 01
 └── Loyalty Asset 02
NOVELTY
 ├── Novelty Asset 01
 └── Novelty Asset 02
```

Assets can optionally have severity levels.

```
MILD
MEDIUM
SEVERE
```

This allows the interface to show different movie scenes or dialogues depending on the outcome.

⸻

## 11. Asynchronous Voting

When an OD is raised, it becomes a pending case.

Other members can vote whenever they are available.

**Voting options**

* **OD** — This deserves an OD.
* **SMALL OD** — Something happened, but it's minor.
* **REJECT** — This isn't an OD.

Each member gets one vote per case.

A person's vote is stored independently.

⸻

## 12. Voting Does Not Require Everyone

There is no requirement that everyone votes.

The system accumulates available votes.

For example:

```
Rahul's Movie OD

5 OD
2 Small OD
1 Reject
```

The system can calculate the final score based on the votes received.

People who were offline simply have not voted yet.

⸻

## 13. Closing an OD

The product needs a simple closing mechanism.

The preferred V1 approach is:

**Time-based closure**

An OD remains open for a configurable period.

Example: 24 hours

After that: Voting closes → verdict calculated → score awarded.

This avoids waiting indefinitely for people who are offline.

A future version can support alternative closing conditions, but V1 should use one simple rule.

⸻

## 14. Score Calculation

The scoring system should be intentionally simple.

The final score is determined from the community votes.

Example:

```
OD vote       = +10
Small OD      = +5
Reject        = +0
```

The final score can be calculated from the weighted votes.

Example:

```
4 OD
2 Small OD
1 Reject
= 50 total OD points
```

The exact formula should be configurable without making the user interface complicated.

The important thing is:

More people agreeing that something was an OD should generally produce a stronger OD score.

⸻

## 15. Live Display — Default State

When nothing is happening, the shared screen shows the leaderboard.

**Leaderboard elements**

* Board name
* Member faces
* Names
* Scores
* Ranking
* Large visual bars

The face should preferably be a cutout, supplied by the user/developer.

Example:

```
             FACE
              ↓
        ┌─────────────┐
        │             │
        │             │
        │      87     │
        │             │
        └─────────────┘
             RAHUL
```

The bars should communicate ranking immediately.

⸻

## 16. OD Detection Animation

When someone raises an OD, the leaderboard temporarily becomes an event screen.

**Sequence**

1. Leaderboard pauses
2. **Character enters** — A supplied character asset appears.
3. **Character raises board** — OD DETECTED
4. **Character points toward accused person** — The accused person's face/name becomes the focus.
5. **Incident appears**

```
RAHUL

Went for a movie without inviting the gang.
```

6. **Relevant asset appears** — The system displays the category's supplied Malayalam movie image / scene / dialogue.
7. **Case becomes pending** — OD UNDER INVESTIGATION

The display can show: "4 people have judged this case."

⸻

## 17. Pending OD on the Display

Because voting is asynchronous, the display should not wait for a verdict.

Instead, it can periodically show pending cases.

Example:

```
OD UNDER INVESTIGATION

Rahul's unauthorized movie outing

4 votes received

Voting closes in 18h 32m
```

This lets people know that there is an active case.

⸻

## 18. Voting From Phone

A user opening Oddy Board sees pending cases.

Example:

```
🚨 OD UNDER INVESTIGATION

Rahul

Went for a movie without inviting us.

[Evidence]

IS THIS AN OD?

OD

SMALL OD

REJECT
```

One tap should be enough.

After voting: "Vote recorded."

No additional workflow is necessary.

⸻

## 19. Verdict

Once voting closes, the display can show a verdict sequence.

Example

```
OD COURT

Rahul

Movie without inviting the gang

VERDICT

GUILTY

+17 OD
```

The relevant supplied movie/dialogue asset should appear.

The leaderboard then updates.

⸻

## 20. Score Update Animation

After the verdict:

```
RAHUL

67 → 84 OD
```

The leaderboard bar should animate to the new position.

Then the system returns to the normal leaderboard.

The animation should be short and satisfying.

⸻

## 21. Daily OD Limits

Users should have a configurable OD request limit.

Example: 3 OD requests per day

This prevents spam and gives OD requests some value.

The number should be configurable at board level.

V1 should not introduce complicated quotas.

⸻

## 22. Sharing

Every board should have a shareable identity.

Users can share:

* Board
* Leaderboard
* OD case
* Verdict

The most important shareable output is the visual leaderboard and OD verdict.

The sharing flow should be extremely simple.

⸻

## 23. Growth Loop

The product should naturally spread between friend groups.

```
Friend group
     ↓
Creates board
     ↓
Raises ODs
     ↓
Leaderboard becomes funny
     ↓
Someone screenshots it
     ↓
Shares it
     ↓
Another group sees it
     ↓
Creates their own board
```

The product should therefore make the visual output itself shareable.

⸻

## 24. User Interface Principles

**Clean Interface**

The UI should be very clean.

The content can be chaotic.

The interface should not.

**Asset First**

If an appropriate asset exists: Use the asset.

Do not replace it with a generic icon or emoji.

**No Random Decoration**

Do not add:

* Random emojis
* Random illustrations
* Random memes
* Random icons
* Random animations
* Random AI-generated content

Every visual element should have a reason.

**Strong Typography**

The most important information should be readable from a distance:

* Name
* OD
* Score
* Verdict
* Incident

**Minimal Components**

Avoid unnecessary:

* Cards
* Panels
* Borders
* Gradients
* Shadows
* Charts
* Filters
* Menus

The leaderboard and incident should dominate.

⸻

## 25. Design Philosophy

The product should follow this contrast:

Clean interface + ridiculous content

The visual system should feel polished and intentional.

The comedy should come from:

* The incident
* The person's face
* The timing
* The Malayalam reference
* The dialogue
* The verdict
* The leaderboard

Not from making the interface itself visually noisy.

⸻

## 26. Animation Rules

Animations should be limited to meaningful moments:

* Character entrance
* OD DETECTED
* Pointing
* Asset reveal
* Verdict
* Score update
* Leaderboard transition

Avoid continuous motion.

Avoid excessive particles.

Avoid random bouncing.

Avoid unnecessary transitions.

The product should feel calm until something funny happens.

⸻

## 27. Phone Experience

The phone interface should be much simpler than the display.

**Raise OD**

```
RAISE OD
   ↓
Select person
   ↓
Select category
   ↓
Describe what happened
   ↓
Optional evidence
   ↓
Submit
```

**Judge OD**

```
OD UNDER INVESTIGATION
        ↓
Read incident
        ↓
OD / SMALL OD / REJECT
        ↓
Done
```

The phone should never feel like a complicated social network.

⸻

## 28. Board Administration

Board admins can:

* Add/remove members
* Manage member images
* Configure categories
* Upload assets
* Configure voting duration
* Configure daily OD limits
* Manage board settings

The admin experience should remain simple.

⸻

## 29. Simple Data Model

**Board**

* id
* name
* created_by
* settings

**Member**

* id
* board_id
* name
* image

**Category**

* id
* board_id
* name
* scoring_rule

**OD**

* id
* board_id
* raised_by
* accused_member
* category
* description
* evidence
* status
* created_at
* closes_at
* final_score

**Vote**

* id
* od_id
* member_id
* vote
* created_at

**Score**

* member_id
* category_id
* total_score

**Asset**

* id
* category_id
* type
* file
* dialogue
* severity

Keep the backend simple.

Do not create unnecessary abstractions.

⸻

## 30. V1 Scope

V1 should only contain:

**Board**

* Create board
* Join board
* Add members

**Members**

* Name
* Photo
* Scores

**OD**

* Raise OD
* Evidence
* Pending state
* Asynchronous voting
* Automatic closing
* Final score

**Leaderboard**

* Face cutouts
* Bars
* Rankings
* Scores

**Live Display**

* Leaderboard
* OD detection sequence
* Pending case
* Verdict sequence
* Score update

**Assets**

* Category mapping
* Developer-provided images
* Developer-provided dialogues
* Movie references

**Sharing**

* Board link
* Leaderboard
* Verdict

Nothing more is required.

⸻

## 31. Explicit Non-Goals

Do not build:

* AI agents
* AI-generated memes
* AI-generated Malayalam dialogues
* AI-generated images
* Social feeds
* Followers
* Direct messages
* Likes
* Comments
* Complex notification systems
* Achievements
* Streaks
* Gamification layers
* Advanced analytics
* Recommendation algorithms
* Complex moderation
* Complex permissions
* Complex scoring systems

If a feature does not improve:

Raise → Judge → Verdict → Score → Leaderboard

it should probably not exist in V1.

⸻

## 32. Development Rules

**Rule 1 — Keep it stupidly simple**
The product is supposed to be silly. Do not turn it into a complicated platform.

**Rule 2 — Assets are the source of personality**
The supplied asset library should carry the personality of the product.

**Rule 3 — Developer-provided content wins**
When specific images, dialogues, scenes, or design references are supplied, use them rather than inventing alternatives.

**Rule 4 — No filler**
Never add content merely because the screen feels empty. Whitespace is acceptable.

**Rule 5 — Clean UI**
The UI should be polished, minimal, and highly readable.

**Rule 6 — Comedy through context**
The comedy should come from what happened + who did it + the selected asset, not random visual noise.

**Rule 7 — Asynchronous by default**
Nobody should need to be online simultaneously for an OD to work.

**Rule 8 — Display is entertainment**
The shared screen should make incidents fun to watch.

**Rule 9 — Phone is interaction**
The phone should make raising and judging an OD extremely fast.

**Rule 10 — Don't overbuild**
Build the smallest possible system that produces the complete Oddy Board loop.

⸻

## 33. Success Criteria

Oddy Board works if:

1. A group can create a board.
2. Members can be added.
3. Someone can raise an OD in seconds.
4. The shared screen announces it.
5. The appropriate asset appears.
6. People can vote whenever they are available.
7. The case closes automatically.
8. A verdict is produced.
9. The score changes.
10. The leaderboard updates.
11. The result is funny enough that someone wants to share it.
12. Another friend group wants to create its own board.

The ultimate success metric is not time spent in the app.

It is:

"Something happened. Someone immediately thought: raise an OD."

⸻

## 34. Core Product Loop

```
                 SOMETHING HAPPENS
                        ↓
                    RAISE OD
                        ↓
                  OD DETECTED 🚨
                        ↓
                 CHARACTER APPEARS
                        ↓
                 SHOW THE INCIDENT
                        ↓
             SHOW RELEVANT ASSET/DIALOGUE
                        ↓
                OD UNDER INVESTIGATION
                        ↓
              PEOPLE VOTE ASYNC
                        ↓
                  CASE CLOSES
                        ↓
                     VERDICT
                        ↓
                  SCORE CHANGES
                        ↓
                  LEADERBOARD
                        ↓
                      SHARE
                        ↓
              ANOTHER GROUP DISCOVERS IT
```

**One-line definition**

Oddy Board is a live, Malayalam-meme-powered social courtroom where friend groups record funny chathis, judge them asynchronously, and publicly rank the people who deserve the most ODs.
