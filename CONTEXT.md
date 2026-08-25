# Context: Taxi Chaos: Johannesburg

Glossary only — no implementation details. See `docs/agents/domain.md` for how skills should consume this.

## Terms

**Taxi** — the player-controlled vehicle (a Toyota Quantum minibus). Moves via auto-scroll (constant forward speed) with lateral lane-steering plus a brake/boost modifier.

**Passenger** — an NPC who boards the Taxi at a Pickup Marker. Carries a **Requested Drop-off Type** (`Legal` or `Illegal`) fixed at spawn. Up to 14 Passengers can be aboard at once (see Overload).

**Pickup Marker** — a roadside point where a Passenger waits to board. Spawns periodically ahead of the Taxi as it drives; boarding is automatic on proximity. No timeout — an unreached Pickup Marker is simply missed once it scrolls off-screen, no penalty.

**Drop-off Zone** — a marked location the Taxi can stop a Passenger at. Has a fixed **Zone Type** (`Legal` or `Illegal`), set independently of any Passenger's request. Drop-off is automatic on proximity. Color-coded per Passenger (the Passenger's onboard icon color matches their Requested Drop-off Type's marker color) so the player can identify which zone serves which Passenger at a glance.

**Fare** — the payment received when a Passenger is dropped off, drawn from and added to **Points** (see below; there is no separate cash currency). Determined by the **Fare Payout Matrix**:
- Requested `Illegal`, dropped at `Illegal` → full Fare + Heat
- Requested `Illegal`, dropped at `Legal` → **partial Fare** (the one case that reduces payout), no Heat from this action
- Requested `Legal`, dropped at `Legal` → full Fare, no Heat
- Requested `Legal`, dropped at `Illegal` → full Fare + Heat (driver's own risk choice, not the Passenger's ask)

**Points** — the single unified currency: score, leaderboard value, and Bribe fund all draw from the same running total. Earned from Fares and from Reckless Driving. Never a separate "cash" track.

**Heat** — a single numeric meter (not a discrete state machine) representing JMPD's alertness. Driven up by Illegal drop-offs, Reckless Driving, and Overload; decays on Legal drop-offs / safe driving. JMPD's pursuit speed and aggression scale continuously with Heat. Displayed on the HUD as a gauge.

**JMPD** (Johannesburg Metropolitan Police Department) — the pursuing van AI. Speed/aggression is a direct function of Heat, plus a slow passive difficulty ramp over distance/time independent of Heat.

**Reckless Driving** — umbrella term for player actions that add Heat and Points beyond normal fare-running: **Oncoming-Lane Driving** (driving in the opposing-traffic lanes), **Near-Miss** (passing very close to Traffic or a pedestrian without colliding), and **Overload** (see below). Each is a distinct trigger, all feeding the same Heat/Points pools.

**Overload** — the state of carrying more than the **Legal Capacity** (4 Passengers) aboard. Heat/Points bonus scales with the excess above Legal Capacity, up to the **Hard Cap** (14 Passengers), which cannot be exceeded regardless of risk appetite.

**Collision** — contact with a Pedestrian or a Traffic vehicle. Always instant game-over (Taxi is "arrested" — see Capture). Contact with a static Hazard (pothole, barrier) is NOT a Collision — it's a lesser penalty (slow-down/damage), kept as a distinct, lower-stakes category.

**Traffic** — other vehicles on the road, moving at constant speed in a straight line (no lane-changing, no reactive AI). A subset of what can cause a Collision or a Near-Miss.

**Pedestrian** — mostly static NPCs near Drop-off Zones/crossings, with a small population crossing on a timer. A subset of what can cause a Collision or a Near-Miss.

**Capture** — the moment JMPD reaches the Taxi. Resolves automatically: if Points ≥ the **Bribe Threshold**, Points are deducted and the Taxi is released (flavor: paying a "cool drink" — Johannesburg slang for a bribe; "Bribe" is the canonical term, "cool drink" is UI/flavor text only). If Points < Bribe Threshold, the run ends (arrested).

**Run** — one continuous play session: auto-scroll driving from start until either Collision or a failed Capture ends it. Single life, no discrete "shifts". Final Points posted to the local high-score table (localStorage; no backend).

## Terminology decisions

- **"Heat" over "wanted level"/"suspicion"**: a single continuous meter, not a discrete state machine — "heat" reads as continuous in a way "level" doesn't.
- **"Bribe" over "cool drink fund"**: "cool drink" is kept as in-fiction/UI flavor text (matches SA slang for a bribe), but the mechanic itself is named plainly so it doesn't collide with any future in-game item literally called a cool drink.
- **Points is the only currency** — flagged and resolved during grilling: "score" and "bribe fund" are not two systems, they're one (see [[Points]] above).
- **Drop-off Zone's Zone Type is independent of any Passenger's Requested Drop-off Type** — a zone doesn't "belong" to a passenger; any Passenger can be dropped at any Zone, and the Fare Payout Matrix compares the two independently. This was the one real ambiguity: "illegal spot" initially read as if each Passenger had their own dedicated zone, but the design is cleaner with Zones as a shared, reusable map feature.
