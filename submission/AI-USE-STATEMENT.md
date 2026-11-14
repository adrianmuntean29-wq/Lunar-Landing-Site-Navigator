<!--
DRAFT for Eren's approval (SUBMISSION session, 2026-11-14 15:20). Source: vault\AI_USE.md (rows up to 15:07) and DECISIONS.md.
Paste the "Statement" section into the NASA form field that asks how AI was used. ~330 words.
Open before pasting: (1) Adrian and the 3 other members' own AI use is not in AI_USE.md; ask them.
(2) Re-read AI_USE.md after the freeze and add any later rows (e.g. voice, images).
-->

# AI use statement (for the NASA project form)

## Statement

We used **Claude Code (Anthropic)** as a coding and research assistant throughout the event. We did not use AI to
generate images, video, audio or voice. [UPDATE if ElevenLabs or any AI media is added; AI images need a visible watermark.]

**What the AI did**
- **Code:** helped write the Python pipeline (reading the NASA LOLA elevation model, terrain-horizon masks, sunlight and Earth
  statistics, permanent-shadow layer, unit tests) and the web page (Sun and Earth positions from JPL Horizons, landing-window
  calendar, sliders, ranking, 3D terrain view).
- **Research:** summarised NASA data products, papers and the challenge rules; surveyed existing tools and other public projects
  for this challenge (reading only, no code copied); checked the landing values in a 2024 NASA presentation.
- **Testing:** ran benchmarks and cross-checks and wrote up the results.
- **Writing:** helped draft this README, the credits list and the slide text.

**What people decided**
The team chose the problem and every product decision. Ideas that came from team members, not from the AI:
- the **site-first landing-window calendar** (pick a site, see every good landing day across years);
- the **automatic horizon reach** (each ray stops when terrain can no longer block the Sun, instead of a fixed distance);
- the **other-missions layer** (show past and planned landers and keep a safe distance from them);
- the **dashboard layout** of the page (status bar, side panel, full-screen 3D view, bottom drawer), taken from a team member's
  earlier drone-dashboard design (layout only, no code reused);
- showing **when the data was computed** and with which versions, and flagging sites with less published data.
AI sessions proposed options and found problems; a person accepted or rejected each one and recorded it in our decision log.

**What people checked**
- Sun and Earth positions in the browser against live JPL Horizons values (max error 0.0042 deg).
- The browser calendar against an independently written Python engine: 0 of 1,460 landing days in 2027 disagree.
- Sunlight at two sites against a published study (Gläser et al. 2018): Shackleton rim 79.1% vs 81.0%,
  Connecting Ridge 85.6% vs 88.0% (ours over 2027-2031).
- Every number in our materials carries a label (measured by us, verified against a source, or unverified),
  and every source is cited in CREDITS.md.

**Where it is recorded**
AI use is logged line by line in the repository [CHECK: AI_USE.md is in the vault, not the repo yet; copy it or link it],
and AI-assisted code is acknowledged in the README.

## Short version (if the form has a small field, ~70 words)

We used Claude Code (Anthropic) to help write the Python pipeline and the web page, to research NASA data and existing tools,
and to run cross-checks. No AI images, video or voice. The team chose the problem and all product ideas (site-first landing
calendar, automatic horizon reach, other-missions layer, dashboard layout). People checked the results against JPL Horizons,
an independent second implementation and a published study. Full log: [AI_USE link].
