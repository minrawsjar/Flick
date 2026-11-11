# Making "Gone in a Flick" in Higgsfield

Every prompt here is complete: paste it as it is. The video is 55 seconds and 11 shots; the last
shot, the logo, is already made (`cards/install-now.mp4`).

## Which Higgsfield tool does what

| Job | Tool in Higgsfield | Why |
|---|---|---|
| References and start frames | **Image → Nano Banana Pro** | Keeps faces, costumes and agents right from uploaded references, and spells placard text correctly |
| Shots 1, 2, 3, 4, 7, 10 | **Video → Veo** (3.1 or newest) | The most realistic acting and light, and it makes the sound |
| The vanishes: shots 5, 6, 8, 9 | **Video → Kling** (newest), with a **start frame and an end frame** | You decide exactly who disappears: the end frame is the same picture without them |
| A backup vanish | **Video → Higgsfield DoP**, preset **Disintegration** | If Kling won't dissolve someone, make a close-up of the bill person alone and let the preset do it |
| Shot 11, the logo | none | `cards/install-now.mp4`, Flick's real logo animation |

## The workflow

1. **Make the references once** (section 1): Nina, a bill person and the five agents in 3D. Save
   them; every shot uses them.
2. **For each shot, make the start frame (A)** in Nano Banana Pro: upload the references the shot
   lists, *in that order* (the prompts say "image 1", "image 2"), set **16:9**, paste prompt A, and
   make 2 to 4. If a placard is misspelled, edit that image: "Fix the placard text to read exactly:
   …".
3. **For a vanish shot, make the end frame** too: upload the start frame to Nano Banana Pro and
   paste the shot's **end frame** prompt. It's the same picture with the bill people gone.
4. **Make the video (B)** with the model the shot names, and paste prompt B.
5. **Make 2 or 3 takes per shot** and keep the best. Each prompt has one clear action, which is
   what these models do best.

**Video settings**

| | Veo | Kling (start + end frame) | Higgsfield DoP |
|---|---|---|---|
| Image | the start frame | start frame in the first slot, end frame in the last | the close-up |
| Aspect ratio | 16:9 | 16:9 | 16:9 |
| Length | 8 s (trim in the edit) | 5 s | the preset's |
| Sound | on | on if offered, else add it in the edit | none, add it in the edit |
| Preset | none | General | Disintegration |
| Enhance prompt | off, if you see it | off | off |

Switching "Enhance prompt" off stops Higgsfield rewriting the prompt, which can lose the placard
text and the "no screen" rules.

**Negative prompt**, wherever there's a field for it (Kling has one):
```
garbled text, misspelled placards, readable phone screen, app interface, logos, brand names, subtitles, captions, watermark, extra fingers, deformed hands, fast camera moves, whip pans, cartoon style, music
```

**To save credits**, try a shot on a cheaper model first (Kling Turbo, or DoP's lite option), then
make the keeper on Veo or full Kling.

---

## 1. References (make these first)

**Nina:** Nano Banana Pro, no upload.
```
A photorealistic character reference of Nina, a woman in her mid-20s with warm brown skin, a short glossy black bob with blunt bangs, small gold hoop earrings and expressive, slightly tired dark eyes. She wears a mustard-yellow knee-length raincoat over a navy crew-neck sweater, dark straight jeans and white sneakers. Two views side by side: full body standing, and a head-and-shoulders close-up, both facing the camera. Plain warm-grey studio backdrop, soft even light, shot on 35mm film.
```

**A bill person:** Nano Banana Pro, no upload.
```
A photorealistic character reference of an expressionless man in his 40s in a charcoal-grey wool three-piece suit with a matching grey flat cap, white shirt and thin black tie, holding a blank white rectangular placard on a pale wooden stick at chest height with both hands. Full body, standing straight, facing the camera, plain warm-grey studio backdrop, soft even light, shot on 35mm film.
```

**The agents in 3D:** Nano Banana Pro, upload `references/agents.png`.
```
Turn these five flat characters into small 3D objects, each the size of a grapefruit, floating side by side in a row: smooth glossy plastic with the same soft gradient colours, the same shapes and the same two black oval eyes, no mouths, no arms. Each glows faintly in its own colour. From left to right: the cyan sphere, the green droplet, the yellow rounded cube, the pink capsule and the orange sphere. Plain warm-grey studio backdrop, soft light, photorealistic.
```
Save this as **agents-3d**. When a shot needs one agent, upload agents-3d and the prompt says
which one.

**If Nina's face drifts from shot to shot:** make 15 to 20 images of her from the reference (other
angles, expressions, light), train a **Soul ID** called Nina from them, and upload a Soul image of
her as image 1 instead.

---

## 2. The shots

### Shot 1: Bills follow you everywhere (0:00–0:05) · Veo

**A. Start frame.** Upload: Nina, bill person.
```
Using the woman from image 1 and the man's suit and placard from image 2: a wide, perfectly symmetrical shot of a quiet brownstone street in soft golden morning light. Nina walks toward the camera down the middle of the pavement holding a paper coffee cup, shoulders slumped. Behind her, about ten expressionless men and women in identical charcoal-grey suits and grey flat caps follow in loose formation, each holding a white placard on a wooden stick at chest height with bold black hand-painted capital letters. The placards read, exactly: "ELECTRIC $64.20", "PHONE BILL", "RENT", "GROCERIES", "GYM". Photorealistic, shot on 35mm film with an anamorphic lens, shallow depth of field, muted teal and amber palette, fine film grain, deadpan whimsical comedy, 16:9.
```

**B. Video (Veo).**
```
Nina, the woman in the mustard-yellow raincoat, trudges slowly toward the camera holding her coffee. The crowd of people in grey suits behind her follows in perfect step, two paces back, placards held steady facing the camera. She glances back over her shoulder; every person in the crowd tilts their head at the same angle at the same moment. Slow dolly back matching her pace. Photorealistic, 35mm film, warm golden-hour light, soft haze, symmetrical composition, deadpan comedy.
Audio: footsteps falling in unison on the pavement, morning birdsong, a car passing far away. No music, no dialogue.
```

### Shot 2: Even on the bus (0:05–0:09) · Veo

**A. Start frame.** Upload: Nina, bill person.
```
Using the woman from image 1 and the suit and placard from image 2: inside a city bus in the morning, sunlight streaming through the windows. Nina sits in a window seat. Every other seat around her is taken by expressionless people in identical charcoal-grey suits and grey flat caps, all turned to face her, holding white placards with bold black hand-painted capital letters that read, exactly: "PHONE BILL", "DINNER SPLIT", "GROCERIES". Symmetrical framing down the aisle, photorealistic, 35mm film, warm light, muted teal and amber palette, film grain, deadpan comedy, 16:9.
```

**B. Video (Veo).**
```
The bus moves and sunlight flickers across the still faces of the people in grey suits, who do not move or blink. Nina slowly slides down in her seat and puts on a pair of dark sunglasses. Very slow push-in toward Nina. Photorealistic, 35mm film, warm light strobing through the windows, deadpan comedy.
Audio: a bus engine rumbling, brakes hissing softly. No music, no dialogue.
```

### Shot 3: Then she got Flick (0:09–0:14) · Veo

**A. Start frame.** Upload: Nina, bill person.
```
Using the woman from image 1 and the suit and placard from image 2: a park bench at golden hour, wide and symmetrical. Nina sits in the middle of the bench holding her phone in both hands, the screen glowing softly onto her face; the screen faces her and cannot be seen. Standing all around the bench, close, are a dozen expressionless people in identical charcoal-grey suits and grey flat caps holding white placards with bold black hand-painted capital letters reading "RENT", "GYM", "PHONE BILL" and "GROCERIES". Photorealistic, 35mm film, warm golden light, soft haze, film grain, 16:9.
```

**B. Video (Veo).**
```
Nina taps her phone once. A soft warm glow blooms from the phone and a few tiny sparks, cyan, violet and pink, drift up past her face like fireflies. She looks up from the phone, surprised and curious. The people in grey suits around her stay perfectly still. Slow push-in toward Nina. Photorealistic, 35mm film, golden-hour light.
Audio: a gentle download chime, then a soft sparkle. No music, no dialogue.
```

### Shot 4: Meet the agents (0:14–0:19) · Veo

**A. Start frame.** Upload: Nina, agents-3d.
```
Using the woman from image 1 and the five small floating characters from image 2: a close shot of Nina on a park bench at golden hour, holding her phone at chest height with the screen facing her. The five little glossy characters float in a gentle arc just above her phone: the cyan sphere, the green droplet, the yellow rounded cube, the pink capsule and the orange sphere, each with two black oval eyes and a faint glow in its own colour. Nina looks at them in wonder. Photorealistic, 35mm film, shallow depth of field, warm light, 16:9.
```

**B. Video (Veo).**
```
The five small glossy characters pop out of the phone one after another like corks, then float up and settle in the air around Nina's shoulders, bobbing gently and blinking their black oval eyes. Nina's eyebrows rise and she breaks into a delighted grin. Gentle slow push-in. Photorealistic, 35mm film, golden-hour light, whimsical.
Audio: five soft pops rising in pitch, then a happy little shimmer. No music, no dialogue.
```

### Shot 5: Lens, snap it and flick it (0:19–0:24) · Kling, start + end frame

**A. Start frame.** Upload: Nina, bill person, agents-3d.
```
Using the woman from image 1, the man from image 2 and the cyan sphere from image 3: the brownstone street at golden hour. The man in the charcoal-grey suit and grey flat cap stands facing Nina, holding a white placard reading, exactly, "ELECTRIC $64.20" in bold black hand-painted capital letters. The small glossy cyan sphere with two black oval eyes hovers in front of his placard, casting a thin horizontal line of cyan light across it like a scanner. Nina stands beside it holding her phone at chest height, screen facing her. Photorealistic, 35mm film, warm light, symmetrical, 16:9.
```

**End frame.** Upload the start frame.
```
Remove the man in the grey suit and his placard completely, and fill in the street behind where he stood. A few specks of golden dust and tiny cyan, violet and pink sparks float in the air where he was. Keep Nina, the cyan sphere, the light and the framing exactly the same.
```

**B. Video (Kling).**
```
The cyan sphere sweeps its thin line of cyan light down the placard and gives a small happy bounce. Nina holds her phone at chest height and flicks her index finger quickly upward once in front of the phone's front camera; three tiny sparks, cyan, violet and pink, pop off her fingertip. The man in the grey suit politely tips his cap, then dissolves from the edges inward into drifting golden dust with tiny cyan, violet and pink sparks that float upward and catch the light, the placard dissolving last. The cyan sphere does a little loop of joy. Static camera. Photorealistic, 35mm film, golden-hour light.
```
Sound (Kling's, or in the edit): a soft scanner hum and a beep, then a whoosh and a shimmering chime as he vanishes.

### Shot 6: Scout, the usual, cheaper (0:24–0:29) · Kling, start + end frame

**A. Start frame.** Upload: Nina, bill person, agents-3d.
```
Using the woman from image 1, the suits from image 2 and the orange sphere from image 3: a symmetrical supermarket aisle in warm light with colourful shelves. Nina pushes an empty shopping trolley toward the camera. Behind her, a single-file line of six expressionless people in charcoal-grey suits and grey flat caps follows like ducklings, each holding a white placard reading, exactly, "GROCERIES" in bold black hand-painted capital letters. The small glossy orange sphere with two black oval eyes floats ahead of the trolley. Photorealistic, 35mm film, 16:9.
```

**End frame.** Upload the start frame.
```
Remove all six people in grey suits and their placards, and fill in the aisle behind Nina. Her trolley is now neatly full of groceries. A few specks of golden dust and tiny coloured sparks float in the aisle. Keep Nina, the orange sphere, the shelves, the light and the framing exactly the same.
```

**B. Video (Kling).**
```
The orange sphere darts along the shelves, tapping products, which drop neatly into Nina's trolley. Nina holds her phone up and flicks her index finger quickly upward once in front of the phone's front camera; tiny cyan, violet and pink sparks pop off her fingertip. The line of people in grey suits behind her dissolves one after another, front to back, like falling dominoes, each into drifting golden dust with tiny coloured sparks. Slow dolly back down the aisle. Photorealistic, 35mm film, warm light, whimsical.
```
Sound: trolley wheels rolling, soft taps, a quick run of whooshes and chimes.

### Shot 7: Splitter, dinner shared (0:29–0:34) · Veo

**A. Start frame.** Upload: Nina, bill person, agents-3d.
```
Using the woman from image 1, the suit from image 2 and the yellow rounded cube from image 3: a candlelit dumpling restaurant with red paper lanterns, a symmetrical table for four. Nina sits facing the camera with three friends: Maya with curly copper-red hair and freckles, Leo, very tall, with a red-and-white striped football scarf, and Priya with a sleek black ponytail and gold-rimmed glasses. Behind Nina stands a man in a charcoal-grey suit and grey flat cap holding a white placard reading, exactly, "DINNER SPLIT" in bold black hand-painted capital letters. The small glossy yellow rounded cube with two black oval eyes hovers over the table. Photorealistic, 35mm film, warm candlelight, 16:9.
```

**B. Video (Veo).**
```
The yellow rounded cube hops onto the top edge of the "DINNER SPLIT" placard, and the placard splits into three small placards that float gently through the air and land on the table in front of Maya, Leo and Priya. Maya and Priya each lift their phones and flick one finger upward in front of the camera, and their small placards turn into golden dust with tiny coloured sparks. Leo frowns at his placard and puts his phone in his pocket. Static camera. Photorealistic, 35mm film, warm candlelight, deadpan comedy.
Audio: restaurant chatter and chopsticks, a soft paper rip, two whooshes with chimes, Leo sighing. No music.
```

### Shot 8: Nudge, and friends paying back (0:34–0:39) · Kling, start + end frame

**A. Start frame.** Upload: bill person, agents-3d. Leo is described in the prompt; if you kept
a good Leo from shot 7, upload that frame as image 3 and add "Leo is the tall man from image 3".
```
Using the suit and placard from image 1 and the pink capsule from image 2: a five-a-side football pitch in soft morning mist, wide and symmetrical. Leo, a very tall man in his mid-20s with sandy hair and a red-and-white striped football scarf, dribbles a football. A man in a charcoal-grey suit and grey flat cap jogs right beside him holding a white placard reading, exactly, "LEO OWES YOU" in bold black hand-painted capital letters. The small glossy pink capsule with two black oval eyes floats toward Leo's shoulder. Photorealistic, 35mm film, 16:9.
```

**End frame.** Upload the start frame.
```
Remove the jogging man in the grey suit and his placard, and fill in the pitch behind him. Leo has stopped, holds his phone at chest height and smiles; a thin ribbon of golden sparks arcs from his phone off the side of the frame. Keep Leo's face and clothes, the pink capsule, the mist and the framing exactly the same.
```

**B. Video (Kling).**
```
The pink capsule gently bumps Leo's shoulder, a little nudge. Leo stops, sighs, then smiles, takes out his phone and flicks one finger quickly upward in front of the phone's front camera; tiny cyan, violet and pink sparks pop off his fingertip. The jogging man in the grey suit dissolves mid-stride into drifting golden dust with tiny coloured sparks, his placard last. A thin ribbon of golden sparks arcs away from Leo's phone, off to the side of the frame. Static wide camera. Photorealistic, 35mm film, misty morning light.
```
Sound: a ball thudding, a soft boop as the capsule bumps him, a whoosh and a chime.

### Shot 9: Autopilot, the whole week in one flick (0:39–0:45) · Kling, start + end frame

**A. Start frame.** Upload: Nina, bill person, agents-3d.
```
Using the woman from image 1, the suits from image 2 and the green droplet from image 3: Sunday night, a small cosy bedroom lit by lamplight and a string of fairy lights, wide and perfectly symmetrical. The room is packed wall to wall with expressionless people in charcoal-grey suits and grey flat caps: on the bed, in the open wardrobe, by the window, standing in every corner, each holding a white placard with bold black hand-painted capital letters reading "RENT", "PHONE BILL", "GYM" and "GROCERIES". Nina sits on the edge of the bed in the middle holding her phone. The small glossy green droplet with two black oval eyes floats above her. Photorealistic, 35mm film, warm light, 16:9.
```

**End frame.** Upload the start frame.
```
Remove every person in a grey suit and every placard, except one blank white placard lying on the floor. Nina is now lying back on the bed, laughing. Keep the room, the lamplight, the fairy lights, the green droplet and the framing exactly the same.
```

**B. Video (Kling).**
```
The green droplet flies one loop around the room, leaving a soft glowing green trail that circles everyone. In slow motion, Nina raises her phone and flicks her index finger quickly upward once in front of the front camera; three tiny sparks, cyan, violet and pink, pop off her fingertip. The entire crowd dissolves at once in a ripple of golden dust with tiny coloured sparks, from the door to the window. A single blank placard drifts down to the floor. The room is empty and quiet; Nina falls back onto the bed laughing. Static camera. Photorealistic, 35mm film, warm lamplight.
```
Sound: a clock ticking, then a whoosh that swells into a shimmering chord, then silence and
Nina's laughter. Kling's 5 seconds is tight for this; if it rushes, make it 10 seconds and speed up
the middle in the edit.

### Shot 10: Free (0:45–0:49) · Veo

**A. Start frame.** Upload: Nina, agents-3d, and your start frame from shot 1, so the street
matches.
```
Using the woman from image 1, the five characters from image 2 and the street from image 3: the same brownstone street, framed exactly the same way, now empty and bright with morning sun. Nina walks toward the camera with a coffee, light and smiling. The five small glossy characters, the cyan sphere, green droplet, yellow rounded cube, pink capsule and orange sphere, bob in the air around her shoulders like a little entourage. Photorealistic, 35mm film, warm light, symmetrical, 16:9.
```

**B. Video (Veo).**
```
Nina walks toward the camera, relaxed and happy, the five little characters bobbing around her shoulders. She glances straight at the camera and does a small, playful flick with one finger; three tiny sparks, cyan, violet and pink, pop off her fingertip. Slow dolly back. Photorealistic, 35mm film, bright morning light.
Audio: birdsong, light footsteps, one bright chime on the flick. No music, no dialogue.
```

### Shot 11: The logo (0:49–0:55)

Use `cards/install-now.mp4` as it is: Flick's real logo, animated. The finger flicks, the sparks
burst, then "Install Flick now", flickit.site and a QR code to the install page. Nothing to
generate.

---

## Backup: the vanish with DoP's Disintegration preset

If Kling won't make someone disappear, cut in a 2-second close-up of them vanishing, right after
the flick. Make the close-up in Nano Banana Pro (upload the shot's start frame, so the place and
light match):
```
Using the man and the place from image 1: a medium close-up of the man in the charcoal-grey suit and grey flat cap alone, centred, holding his white placard reading, exactly, "ELECTRIC $64.20" in bold black hand-painted capital letters, the background soft and out of focus. Photorealistic, 35mm film, warm golden light, 16:9.
```
Change the placard text to match the shot. Then **Video → Higgsfield DoP**, preset
**Disintegration**, with this prompt:
```
The man in the grey suit calmly tips his cap and disintegrates into drifting golden dust with tiny cyan, violet and pink sparks that float upward and catch the light; the placard goes last. Static camera, photorealistic, 35mm film, warm light.
```
DoP doesn't make sound: put the same whoosh and chime on it in the edit.

---

## Putting it together

- **Trim each clip** to its time above, keeping the moment of action, and cut on motion.
- **Sound:** keep Veo's. For the Kling and DoP clips, add each shot's listed sound; use the same
  whoosh and chime on every vanish, so it becomes Flick's sound.
- **Music** on top: playful pizzicato strings that build, a pause before shot 9's flick, one
  warm chord over the empty room, and a hit on the logo's flick.
- **On-screen lines:** import `subtitles.srt`.
- **Optional:** run the finished clips through Higgsfield's **Upscale** before the edit.
- **Export** 1080p at 24fps.
