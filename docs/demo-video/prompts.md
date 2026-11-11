# Flick intro video: "Gone in a Flick"

**About 55 seconds.** Nina's bills follow her everywhere: silent people in grey suits holding
placards. She installs Flick, five little agents pop out of her phone, and every bill vanishes with
a flick of her finger. Then the Flick logo flicks, and "Install Flick now".

Make the clips with an AI video tool (Veo 3, Sora 2, Kling or Runway), 4 to 8 seconds each. Then
edit them together and end on `cards/install-now.mp4`, the real Flick logo animating.

## What's in this folder

| File | What it's for |
|---|---|
| `ai-studio.md` | **Using Google AI Studio? Start here.** Every prompt written out to paste as it is: a start frame for Gemini's image model, then a video prompt for Veo |
| `prompts.md` | This: the one-paragraph prompt, then every shot, for any tool |
| `references/agent-*.png`, `references/agents.png` | Flick's five agents, drawn exactly as in the app. Attach them as references so the agents look right |
| `cards/install-now.mp4` | The last 6 seconds, 1920×1080: the logo flicks, its sparks burst, then "Install Flick now", flickit.site and a QR code that opens flickit.site/install |
| `cards/install-card.png` | Its last frame, as a still |
| `subtitles.srt` | The on-screen lines, timed to the cut below |
| `props/` | Optional: a bill, an e-bill and a receipt to snap if you cut real Flick screens into the video |

---

## The whole video in one prompt

Use this in a tool that takes a storyboard or a long multi-shot prompt (Sora 2 storyboard, Kling
multi-shot, Veo in Flow), or as the brief for the shots below.

```
A whimsical, deadpan cinematic short in the style of a symmetrical European art-house comedy, 35mm
film, golden-hour light. Nina, a woman in her mid-20s with warm brown skin, a short black bob with
blunt bangs and a mustard-yellow raincoat, walks to work followed by a silent crowd of people in
identical charcoal-grey suits and grey flat caps, each holding a white placard with a bill on it:
"ELECTRIC $64.20", "PHONE BILL", "GROCERIES", "DINNER SPLIT", "LEO OWES YOU". They follow her onto
the bus, into the café, everywhere. Exhausted on a park bench, she installs an app; her phone glows
and five small floating characters pop out like fireflies: a cyan sphere, a green droplet, a
yellow rounded cube, a pink capsule and an orange sphere, each with two black oval eyes. One by one
they handle her bills: the cyan one scans the electric bill, the orange one races through a
supermarket, the yellow one splits a dinner bill between her friends, the pink one taps a friend on
the shoulder to pay her back. Each time, Nina flicks one finger up in front of her phone's camera,
and the person holding that bill dissolves into drifting golden dust with tiny cyan, violet and
pink sparks. On Sunday night her bedroom is packed with them; the green droplet circles the room,
she flicks once, and the whole crowd vanishes in a ripple of golden dust. Next morning she walks
the empty street, light and free, the five little agents bobbing around her.
```

---

## Before the shots: make the references

Make these with an image model that spells text well, such as GPT Image, Imagen 4 or Ideogram. Then
attach them to each shot as Veo's ingredients, Kling's elements or Runway's references, so faces,
costumes and agents stay the same from shot to shot.

**Nina**
```
Character reference, photorealistic. Nina, a woman in her mid-20s with warm brown skin, a short
glossy black bob with blunt bangs, small gold hoop earrings, expressive tired dark eyes, a
mustard-yellow knee-length raincoat over a navy sweater, dark jeans, white sneakers. Full body and
a head-and-shoulders close-up, facing camera, plain warm-grey backdrop, soft even light, 35mm film.
```

**A bill person**
```
Character reference, photorealistic. An expressionless man in a charcoal-grey wool three-piece suit
and matching grey flat cap, white shirt, thin black tie, holding a blank white rectangular placard
on a pale wooden stick at chest height with both hands. Full body, facing camera, plain warm-grey
backdrop, soft light, 35mm film.
```
Make a woman in the identical suit and cap too, so the crowds read as one uniform group.

**The agents:** use `references/agent-lens.png`, `agent-autopilot.png`, `agent-splitter.png`,
`agent-nudge.png` and `agent-scout.png`. To make them 3D, run each through your image model with:
```
This exact character as a small 3D object the size of a grapefruit: smooth glossy plastic with a
soft diagonal gradient, the same shape, colour and two black oval eyes, no mouth, no arms, floating
in mid-air with a faint glow in its own colour, studio light, plain background.
```

**The placards:** make one start image per placard, so the text is right before it animates:
```
A white rectangular placard on a pale wooden stick, straight on, filling the frame, bold black
hand-painted capital letters, exactly: "[TEXT]". Clean, legible, evenly lit, no other text.
```
`ELECTRIC $64.20` · `PHONE BILL` · `GROCERIES` · `DINNER SPLIT` · `LEO OWES YOU` · `RENT` · `GYM`

---

## Blocks to paste after every shot prompt

**STYLE**
```
Shot on 35mm film, anamorphic lens, warm golden-hour light, soft haze, shallow depth of field,
muted teal and amber palette, fine film grain, symmetrical composition, deadpan whimsical comedy,
photorealistic, cinematic, 24fps, 16:9, no music.
```

**NINA**
```
Nina, a woman in her mid-20s with warm brown skin, a short glossy black bob with blunt bangs, small
gold hoop earrings and a mustard-yellow raincoat over a navy sweater.
```

**THE BILLS**
```
Expressionless men and women in identical charcoal-grey wool suits and grey flat caps, each holding
a white placard on a pale wooden stick at chest height, bold black hand-painted capital letters,
standing perfectly still and staring politely at Nina.
```

**THE AGENTS**
```
Five small floating characters, each the size of a grapefruit, smooth glossy plastic with a soft
gradient and two black oval eyes, no mouths, no arms: a cyan sphere, a green droplet, a yellow
rounded cube, a pink capsule and an orange sphere. They bob gently in mid-air and glow faintly in
their own colour.
```

**THE FLICK**
```
She holds her phone at chest height, its screen toward her and out of focus, and flicks her index
finger quickly upward once in front of the phone's front camera; three tiny sparks, cyan, violet
and pink, pop off her fingertip.
```

**VANISH**
```
The person dissolves from the edges inward into drifting golden dust with a few tiny cyan, violet
and pink sparks; the dust floats upward and catches the light; the placard dissolves last.
```

**AVOID** (paste as a negative prompt, or as "Avoid: …" for Veo and Sora)
```
garbled or misspelled text, readable phone screens, app interfaces, logos, brand names, subtitles,
watermarks, extra fingers, deformed hands, fast whip pans, cartoon style
```

The mustard coat against the grey suits makes Nina pop in every crowd shot. Flick's logo is a
finger flicking up with three sparks in cyan, violet and pink, and every flick and vanish echoes it.

---

## The shots

**How to make each shot:**
1. Make the **start frame** with your image model, with the references attached and the placard text right.
2. Animate it with the **video prompt**, image to video. Text already in the first frame stays readable if the camera moves slowly.
3. With Veo 3 or Sora 2, include the **sound** line; they make audio. With Kling or Runway, add sound in the edit.
4. Make 2 or 3 takes of each shot and keep the best.

**1. Bills follow you everywhere (0:00–0:05)**
- *Start frame:* Wide, symmetrical brownstone street in soft morning light. Nina walks toward camera holding a coffee, shoulders slumped. Behind her, a crowd of about ten bill people follows in loose formation, placards facing camera: "ELECTRIC $64.20", "PHONE BILL", "RENT", "GROCERIES", "GYM".
- *Video:* Nina trudges toward camera; the crowd follows in perfect step, two paces behind. She glances back; every head tilts at the same angle. Slow dolly back. [STYLE] [NINA] [THE BILLS]
- *Sound:* footsteps in unison, morning birds, a distant car.
- *On screen:* Bills follow you everywhere.

**2. Even on the bus (0:05–0:09)**
- *Start frame:* A city bus interior, sunlight strobing through the windows. Nina sits by the window; every seat around her is taken by bill people turned to face her, placards up: "PHONE BILL", "DINNER SPLIT", "GROCERIES".
- *Video:* The light flickers across their still faces as the bus moves. Nina slowly slides down in her seat and puts on sunglasses. Very slow push-in. [STYLE] [NINA] [THE BILLS]
- *Sound:* bus engine rumble, brakes hissing.

**3. Then she got Flick (0:09–0:14)**
- *Start frame:* A park bench at golden hour. Nina sits in the middle, bill people standing all around the bench. She holds her phone in both hands, its screen glowing softly toward her face.
- *Video:* She taps the phone once. A soft glow blooms from it, and a few tiny cyan, violet and pink sparks drift up past her face. She looks up, surprised. Slow push-in. [STYLE] [NINA] [THE BILLS]
- *Sound:* a gentle download chime, then a soft sparkle.
- *On screen:* Then she got Flick.

**4. Meet the agents (0:14–0:19)**
- *Start frame:* Close on Nina on the bench. Five small floating characters hover just above her phone [THE AGENTS], in a little arc.
- *Video:* The five agents pop out of the phone one after another, like corks, then float up and settle in the air around her shoulders, bobbing gently and blinking. Nina's eyebrows rise and she breaks into a grin. [STYLE] [NINA] [THE AGENTS]
- *Sound:* five soft pops, rising in pitch, then a happy little shimmer.
- *Attach:* `references/agents.png`.

**5. Lens: snap it, flick it (0:19–0:24)**
- *Start frame:* The street. The cyan sphere agent hovers in front of the bill person holding "ELECTRIC $64.20", a thin line of cyan light across his placard like a scanner.
- *Video:* The cyan agent sweeps its light down the placard and beeps. Nina, beside it, does [THE FLICK]. The bill person tips his cap, then [VANISH]. The cyan agent does a little loop of joy. [STYLE] [NINA] [THE BILLS]
- *Sound:* a soft scanner hum and beep, then a whoosh and a chime.
- *On screen:* Lens reads it. One flick pays it.
- *Attach:* `references/agent-lens.png`.

**6. Scout: the usual, cheaper (0:24–0:29)**
- *Start frame:* A supermarket aisle, symmetrical, warm light. Nina pushes a trolley; a single-file line of bill people holding "GROCERIES" follows her like ducklings. The orange sphere agent floats ahead of the trolley.
- *Video:* The orange agent darts along the shelves, tapping products, which drop neatly into the trolley. Nina does [THE FLICK], and the grocery bill people [VANISH] one after another like falling dominoes. [STYLE] [NINA] [THE BILLS]
- *Sound:* trolley wheels, soft taps, a run of whooshes and chimes.
- *On screen:* Scout finds your usuals, cheapest.
- *Attach:* `references/agent-scout.png`.

**7. Splitter: dinner, shared (0:29–0:34)**
- *Start frame:* A candlelit dumpling restaurant, symmetrical table for four: Nina with three friends, Maya (curly copper-red hair), Leo (tall, a striped football scarf) and Priya (sleek black ponytail, gold glasses). A bill person stands behind Nina holding "DINNER SPLIT". The yellow rounded-cube agent hovers over the table.
- *Video:* The yellow agent hops onto the top of the placard, which splits into three small placards that float through the air and land in front of Maya, Leo and Priya. Maya and Priya each flick a finger up at their phones, and their small placards turn into golden dust. Leo frowns at his and puts his phone away. [STYLE] [NINA] [THE BILLS]
- *Sound:* restaurant chatter, a paper rip, two soft whooshes, Leo's sigh.
- *On screen:* Splitter shares the bill.
- *Attach:* `references/agent-splitter.png`.

**8. Nudge, and paying friends back (0:34–0:39)**
- *Start frame:* A five-a-side football pitch in morning mist. Leo dribbles a ball; a bill person jogs right beside him holding "LEO OWES YOU". The pink capsule agent floats toward Leo's shoulder.
- *Video:* The pink agent gives Leo's shoulder a gentle bump, a nudge. Leo stops, sighs, smiles and flicks one finger up at his phone; the jogging bill person [VANISH] mid-stride. Across the pitch, Nina waves, and a thin ribbon of golden sparks arcs from his phone to hers. [STYLE] [THE BILLS]
- *Sound:* ball thuds, a soft boop as the agent bumps him, a whoosh and a chime.
- *On screen:* Nudge gets you paid back. Friends pay in a flick.
- *Attach:* `references/agent-nudge.png`.

**9. Autopilot: the whole week, one flick (0:39–0:45)**
- *Start frame:* Sunday night. Nina's small bedroom is packed wall to wall with bill people: on the bed, in the wardrobe, by the window, under fairy lights; placards "RENT", "PHONE BILL", "GYM", "GROCERIES". Nina sits on the edge of the bed with her phone. The green droplet agent floats above her.
- *Video:* The green agent flies one loop around the room, leaving a soft glowing green trail that circles everyone. Nina, slow motion, does [THE FLICK]. The entire crowd dissolves at once in a ripple of golden dust with sparks, from the door to the window. A single blank placard drifts to the floor. Nina falls back onto the bed laughing. [STYLE] [NINA] [THE BILLS]
- *Sound:* a clock ticking, a whoosh that swells into a shimmering chord, then Nina's laugh.
- *On screen:* Autopilot pays your week.
- *Attach:* `references/agent-autopilot.png`.

**10. Free (0:45–0:49)**
- *Start frame:* The same street as shot 1, framed the same way, now empty and sunny. Nina walks toward camera with a coffee, light and smiling. The five agents bob around her shoulders.
- *Video:* She walks toward camera, then glances right at the lens and does a small, playful flick with one finger. Three sparks pop. Slow dolly back. [STYLE] [NINA] [THE AGENTS]
- *Sound:* birdsong, footsteps, one bright chime on the flick.
- *On screen:* Your week, paid in one flick.

**11. The logo (0:49–0:55)**
`cards/install-now.mp4`, as it is: the Flick logo's finger flicks, the three sparks burst, then
"Install Flick now", flickit.site, and the QR code. Put a whoosh on the flick at 2.5 seconds into
the clip.

---

## Sound and the edit

- **Music:** playful pizzicato strings that grow through shots 1 and 2, a lift as the agents pop out, a bouncy beat for 5 to 8, a pause before Autopilot's flick, one warm chord over the empty room, and a final hit on the logo's flick.
- **Effects:** a whoosh and a shimmering chime on every vanish, from the same family each time, so it becomes Flick's sound.
- **On-screen lines:** small, white, clean sans serif, lower third. They're in `subtitles.srt`.
- **Edit** in CapCut or DaVinci Resolve. Cut on motion, export 1080p at 24fps, and upload to YouTube.

## Optional: real Flick screens

To show the real app inside the story, cut a 2-second screen recording in after the flick in shots
5, 6, 7 and 9: Lens reading a bill, Scout's basket, Splitter's grid, Autopilot's week. Record
them on the installed app, snapping the bills in `props/` so the app shows what the placards say.
Never let the AI draw the phone screen.
