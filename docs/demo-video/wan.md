# Flick in 30 seconds, made in Wan

Every feature starts as a problem. Nina's money problems follow her around as silent people in
grey suits holding placards. For each one, a Flick agent sorts it out, she flicks her finger at
her phone, and the problem vanishes. Then the Flick logo, and "Install Flick now".

| Time | Shot | The problem (on screen) | The fix (on screen) |
|---|---|---|---|
| 0:00–0:03 | 1. The street | Bills follow you everywhere. | |
| 0:03–0:07 | 2. Lens | A bill to pay? | Lens reads it. One flick pays it. |
| 0:07–0:11 | 3. Scout | Groceries cost too much? | Scout finds your usuals, cheapest. |
| 0:11–0:15 | 4. Splitter | Splitting dinner? | Splitter sends everyone their share. |
| 0:15–0:19 | 5. Nudge | A friend owes you? | Nudge gets you paid back. |
| 0:19–0:24 | 6. Autopilot | Bills every week? | Autopilot pays them all in one flick. |
| 0:24–0:30 | 7. The logo | `cards/install-now.mp4`: the logo flicks, then "Install Flick now", flickit.site and a QR code | |

Every prompt here is complete: paste it as it is.

---

## The media

**Already made, in this folder:**

| File | Use it for |
|---|---|
| `placards/electric.jpg`, `phone-bill.jpg`, `rent.jpg`, `groceries.jpg`, `gym.jpg`, `dinner-split.jpg`, `leo-owes-you.jpg` | The placards, with the text spelled exactly. Upload them with each start frame, so Wan copies the words instead of guessing them |
| `placards/blank.jpg` | The blank placard, for the bill person reference |
| `references/agents.png` | Flick's five agents, as drawn in the app. You turn them 3D in step 1 |
| `cards/install-now.mp4` | The last 6 seconds: Flick's real logo animation, "Install Flick now", flickit.site and a QR code to the install page |
| `subtitles-30s.srt` | The on-screen lines above, timed to this cut |

**You make three references in Wan first** (section 1): `nina`, `bill-person` and `agents-3d`.

---

## How to make it in Wan

1. **Make the three references** (section 1) with Wan's image model and save them.
2. **For each shot, make the start frame** with Wan's image model:
   - Upload the images the shot lists, in that order. The prompts say "image 1", "image 2", and so on.
   - Aspect ratio 16:9, highest resolution.
   - Make 2 to 4 and pick the best. If a placard's words come out wrong, edit that image: "Make the placard read exactly: …".
3. **For shots 2, 3, 5 and 6, make the end frame as well.** Upload the start frame to Wan's image editing and paste the shot's end-frame prompt. You get the same picture with the problem gone.
4. **Make the video** with Wan's newest video model (Wan 3.0 if your plan has it, otherwise 2.7):
   - Shots 1 and 4: **Image to Video**, with the start frame.
   - Shots 2, 3, 5 and 6: **First & Last Frame**, with the start frame first and the end frame last. You decide exactly who disappears, and Nina never does.
5. **Make 2 or 3 takes of each shot** and keep the best.

**Video settings (Pro):**
- **Resolution:** 1080p, with no watermark.
- **Duration:** 5 seconds, the shortest offered. You trim each shot to its time in the edit.
- **Aspect ratio:** 16:9.
- **Sound:** on, if your model makes it. If not, add each shot's sound in the edit.
- **Prompt extension / smart rewrite:** off. Otherwise Wan rewrites the prompt and can lose the placard and phone-screen rules.
- **Negative prompt:** the one below.

```
garbled text, misspelled placards, extra words, readable phone screen, app interface, logos, brand names, subtitles, captions, watermark, extra fingers, deformed hands, distorted faces, fast camera moves, whip pans, cartoon style, music
```

---

## 1. References (make these first)

**nina:** Wan image model, no upload.
```
A photorealistic character reference of Nina, a woman in her mid-20s with warm brown skin, a short glossy black bob with blunt bangs, small gold hoop earrings and expressive dark eyes. She wears a mustard-yellow knee-length raincoat over a navy crew-neck sweater, dark straight jeans and white sneakers. Two views side by side: full body standing, and a head-and-shoulders close-up, both facing the camera. Plain warm-grey studio backdrop, soft even light, shot on 35mm film.
```

**bill-person:** Wan image model. Upload `placards/blank.jpg`.
```
A photorealistic character reference of an expressionless man in his 40s in a charcoal-grey wool three-piece suit with a matching grey flat cap, white shirt and thin black tie, holding the blank placard from image 1 at chest height with both hands on its wooden stick. Full body, standing straight, facing the camera, plain warm-grey studio backdrop, soft even light, shot on 35mm film.
```

**agents-3d:** Wan image model. Upload `references/agents.png`.
```
Turn these five flat characters into small 3D objects, each the size of a grapefruit, floating side by side in a row: smooth glossy plastic with the same soft gradient colours, the same shapes and the same two black oval eyes, no mouths, no arms. Each glows faintly in its own colour. From left to right: the cyan sphere, the green droplet, the yellow rounded cube, the pink capsule and the orange sphere. Plain warm-grey studio backdrop, soft light, photorealistic.
```

---

## 2. The shots

### Shot 1: Bills follow you everywhere (0:00–0:03) · Image to Video

**Upload:** `nina`, `bill-person`, `placards/rent.jpg`, `placards/phone-bill.jpg`,
`placards/groceries.jpg`, `placards/gym.jpg`, `placards/dinner-split.jpg`.

**Start frame:**
```
Using the woman from image 1, the suit and cap from image 2 and the placards from images 3 to 7: a wide, perfectly symmetrical shot of a quiet brownstone street in soft golden morning light. Nina walks toward the camera down the middle of the pavement holding a paper coffee cup, shoulders slumped. Close behind her, a crowd of expressionless men and women in identical charcoal-grey suits and grey flat caps follows in loose formation, each holding one of the placards from images 3 to 7 at chest height, facing the camera, with the words exactly as they are on them. Photorealistic, 35mm film, anamorphic lens, shallow depth of field, muted teal and amber palette, fine film grain, deadpan whimsical comedy.
```

**Video:**
```
The woman in the mustard-yellow raincoat trudges slowly toward the camera holding her coffee. The crowd in grey suits behind her follows in perfect step, placards held steady. She glances back over her shoulder, and every person in the crowd tilts their head at the same angle at the same moment. Slow dolly back matching her pace. Photorealistic, 35mm film, golden-hour haze, deadpan comedy.
Audio: footsteps falling in unison on the pavement, morning birdsong. No music, no dialogue.
```

### Shot 2: A bill to pay? Lens (0:03–0:07) · First & Last Frame

**Upload:** `nina`, `bill-person`, `agents-3d`, `placards/electric.jpg`.

**Start frame:**
```
Using the woman from image 1, the man from image 2, the cyan sphere from image 3 and the placard from image 4: the brownstone street at golden hour. The man in the charcoal-grey suit and grey flat cap stands in Nina's path, facing her, holding the placard from image 4 with its words exactly as they are. The small glossy cyan sphere with two black oval eyes hovers in front of the placard, casting a thin horizontal line of cyan light across it like a scanner. Nina stands beside it holding her phone at chest height, the screen facing her and out of sight. Photorealistic, 35mm film, warm light, symmetrical framing.
```

**End frame:** upload the start frame.
```
Remove the man in the grey suit and his placard completely, and fill in the street behind where he stood. A few specks of golden dust and tiny cyan, violet and pink sparks float in the air where he was. The cyan sphere floats a little higher, happy. Keep Nina, the light and the framing exactly the same.
```

**Video:**
```
The cyan sphere sweeps its thin line of cyan light down the placard and gives a small happy bounce. Nina flicks her index finger quickly upward once in front of her phone's front camera; three tiny sparks, cyan, violet and pink, pop off her fingertip. The man in the grey suit tips his cap and dissolves from the edges inward into drifting golden dust with tiny coloured sparks, the placard last. Static camera. Photorealistic, 35mm film, golden-hour light.
Audio: a soft scanner beep, then a whoosh and a shimmering chime. No music, no dialogue.
```

### Shot 3: Groceries cost too much? Scout (0:07–0:11) · First & Last Frame

**Upload:** `nina`, `bill-person`, `agents-3d`, `placards/groceries.jpg`.

**Start frame:**
```
Using the woman from image 1, the suit and cap from image 2, the orange sphere from image 3 and the placard from image 4: a symmetrical supermarket aisle in warm light with colourful shelves. Nina pushes an empty shopping trolley toward the camera. Behind her, a single-file line of five expressionless people in charcoal-grey suits and grey flat caps follows like ducklings, each holding the placard from image 4 with its words exactly as they are. The small glossy orange sphere with two black oval eyes floats ahead of the trolley. Photorealistic, 35mm film.
```

**End frame:** upload the start frame.
```
Remove all five people in grey suits and their placards, and fill in the aisle behind Nina. Her trolley is now neatly full of groceries. A few specks of golden dust and tiny coloured sparks float in the aisle. Keep Nina, the orange sphere, the shelves, the light and the framing exactly the same.
```

**Video:**
```
The orange sphere darts along the shelves, tapping products, which drop neatly into Nina's trolley. Nina flicks her index finger quickly upward once in front of her phone; tiny cyan, violet and pink sparks pop off her fingertip. The line of people in grey suits behind her dissolves one after another, front to back, like falling dominoes, into drifting golden dust with tiny coloured sparks. Slow dolly back. Photorealistic, 35mm film, warm light, whimsical.
Audio: trolley wheels, soft taps, a quick run of whooshes and chimes. No music, no dialogue.
```

### Shot 4: Splitting dinner? Splitter (0:11–0:15) · Image to Video

**Upload:** `nina`, `bill-person`, `agents-3d`, `placards/dinner-split.jpg`.

**Start frame:**
```
Using the woman from image 1, the suit and cap from image 2, the yellow rounded cube from image 3 and the placard from image 4: a candlelit dumpling restaurant with red paper lanterns, a symmetrical table for four. Nina sits facing the camera with three friends: Maya with curly copper-red hair and freckles, Leo, very tall, with a red-and-white striped football scarf, and Priya with a sleek black ponytail and gold-rimmed glasses. Behind Nina stands a man in a charcoal-grey suit and grey flat cap holding the placard from image 4 with its words exactly as they are. The small glossy yellow rounded cube with two black oval eyes hovers over the table. Photorealistic, 35mm film, warm candlelight.
```

**Video:**
```
The yellow rounded cube hops onto the top edge of the placard, and the placard splits into three small blank placards that float gently through the air and land on the table in front of Maya, Leo and Priya. Maya and Priya flick one finger upward at their phones, and their small placards turn into golden dust with tiny coloured sparks. Leo frowns at his and puts his phone in his pocket. Static camera. Photorealistic, 35mm film, warm candlelight, deadpan comedy.
Audio: restaurant chatter, a soft paper rip, two whooshes with chimes, Leo sighing. No music.
```
Keep a frame with Leo's face in it: it's his reference for shot 5.

### Shot 5: A friend owes you? Nudge (0:15–0:19) · First & Last Frame

**Upload:** a frame of Leo from shot 4, `bill-person`, `agents-3d`, `placards/leo-owes-you.jpg`.

**Start frame:**
```
Using the tall man with the striped scarf from image 1, the suit and cap from image 2, the pink capsule from image 3 and the placard from image 4: a five-a-side football pitch in soft morning mist, wide and symmetrical. Leo dribbles a football. A man in a charcoal-grey suit and grey flat cap jogs right beside him holding the placard from image 4 with its words exactly as they are. The small glossy pink capsule with two black oval eyes floats toward Leo's shoulder. Photorealistic, 35mm film.
```

**End frame:** upload the start frame.
```
Remove the jogging man in the grey suit and his placard, and fill in the pitch behind him. Leo has stopped and holds his phone at chest height, smiling; a thin ribbon of golden sparks arcs from his phone off the side of the frame. Keep Leo's face and clothes, the pink capsule, the mist and the framing exactly the same.
```

**Video:**
```
The pink capsule gently bumps Leo's shoulder, a little nudge. Leo stops, sighs, smiles, and flicks one finger quickly upward at his phone; tiny cyan, violet and pink sparks pop off his fingertip. The jogging man in the grey suit dissolves mid-stride into drifting golden dust with tiny coloured sparks, his placard last, and a ribbon of golden sparks arcs away from Leo's phone. Static wide camera. Photorealistic, 35mm film, misty morning light.
Audio: a ball thudding, a soft boop as the capsule bumps him, a whoosh and a chime. No music, no dialogue.
```

### Shot 6: Bills every week? Autopilot (0:19–0:24) · First & Last Frame

**Upload:** `nina`, `bill-person`, `agents-3d`, `placards/rent.jpg`, `placards/phone-bill.jpg`,
`placards/gym.jpg`, `placards/groceries.jpg`.

**Start frame:**
```
Using the woman from image 1, the suit and cap from image 2, the green droplet from image 3 and the placards from images 4 to 7: Sunday night, a small cosy bedroom lit by lamplight and a string of fairy lights, wide and perfectly symmetrical. The room is packed wall to wall with expressionless people in charcoal-grey suits and grey flat caps: on the bed, in the open wardrobe, by the window, in every corner, each holding one of the placards from images 4 to 7 with the words exactly as they are. Nina sits on the edge of the bed in the middle holding her phone. The small glossy green droplet with two black oval eyes floats above her. Photorealistic, 35mm film, warm light.
```

**End frame:** upload the start frame.
```
Remove every person in a grey suit and every placard, except one blank white placard lying on the floor. Nina is now lying back on the bed, laughing, and a few specks of golden dust float in the lamplight. Keep the room, the lamplight, the fairy lights, the green droplet and the framing exactly the same.
```

**Video:**
```
The green droplet flies one quick loop around the room, leaving a soft glowing green trail that circles everyone. Nina raises her phone and flicks her index finger quickly upward once; three tiny sparks, cyan, violet and pink, pop off her fingertip. The whole crowd dissolves at once in a ripple of golden dust with tiny coloured sparks, from the door to the window. The room is empty and quiet, and Nina falls back onto the bed laughing. Static camera. Photorealistic, 35mm film, warm lamplight.
Audio: a clock ticking, then a whoosh that swells into a shimmering chord, then Nina's laughter. No music.
```

### Shot 7: The logo (0:24–0:30)

`cards/install-now.mp4`, as it is. Nothing to generate.

---

## Putting it together

1. **Trim** each clip to its time in the table, keeping the flick and the vanish. Cut on motion.
2. **End on** `cards/install-now.mp4`.
3. **Import** `subtitles-30s.srt` for the on-screen lines: small, white, clean sans serif, lower third.
   Each shot shows its problem, then its fix.
4. **Sound:** keep Wan's. Put the same whoosh and chime on every vanish, so it becomes Flick's
   sound. Add music on top: playful pizzicato strings, a short pause before Autopilot's flick, and
   a hit on the logo's flick.
5. **Export** 1080p at 24 or 30fps.
