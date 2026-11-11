# Making "Gone in a Flick" in Google AI Studio

Every prompt here is complete: paste it as it is. Each shot has two:

- **A. The start frame**, made with Gemini's image model (Nano Banana), which keeps faces, costumes
  and placard text right when you upload reference images.
- **B. The video**, made with Veo from that frame. Veo makes the sound too.

The last shot, the logo, is already made: `cards/install-now.mp4`.

## The workflow

1. **Make the references once** (section 1) and save them: Nina, a bill person, and the five agents
   in 3D.
2. **For each shot, make the start frame (A).** Open a new image chat, upload the references
   the shot lists, in that order, and paste prompt A. If the placard text is wrong, say "Fix the
   placard text to read exactly: …" and it edits just that.
3. **Then make the video (B).** Open Veo, choose image-to-video (or "frames to video"), upload the
   start frame, and paste prompt B. Settings:
   - **Model:** the newest Veo you have (3.1, or 3).
   - **Aspect ratio:** 16:9.
   - **Resolution:** 1080p if offered.
   - **Length:** 8 seconds. Each shot is 4 to 6 seconds, so you trim in the edit; pick a shorter length if Veo offers one.
   - **Sound:** on.
   - **Negative prompt:** paste the one below, if there's a field for it.
4. **Make 2 or 3 takes per shot** and keep the best. Veo is better at one clear action per clip,
   so each prompt has one.
5. **For the vanishes (shots 5 to 9), give Veo an end frame too**, if your Veo has "first and last
   frame". Make the end frame by editing the start frame in the image chat: "Remove the man in
   the grey suit and his placard. Keep everything else exactly the same." Veo then animates the
   change, and the person reliably disappears.

**Negative prompt, for every video:**
```
garbled text, misspelled placards, readable phone screen, app interface, logos, brand names, subtitles, captions, watermark, extra fingers, deformed hands, fast camera moves, cartoon style, music
```

---

## 1. References (make these first)

**Nina:** a new image chat, no upload.
```
A photorealistic character reference of Nina, a woman in her mid-20s with warm brown skin, a short glossy black bob with blunt bangs, small gold hoop earrings and expressive, slightly tired dark eyes. She wears a mustard-yellow knee-length raincoat over a navy crew-neck sweater, dark straight jeans and white sneakers. Two views side by side: full body standing, and a head-and-shoulders close-up, both facing the camera. Plain warm-grey studio backdrop, soft even light, shot on 35mm film.
```

**A bill person:** a new image chat, no upload.
```
A photorealistic character reference of an expressionless man in his 40s in a charcoal-grey wool three-piece suit with a matching grey flat cap, white shirt and thin black tie, holding a blank white rectangular placard on a pale wooden stick at chest height with both hands. Full body, standing straight, facing the camera, plain warm-grey studio backdrop, soft even light, shot on 35mm film.
```

**The agents in 3D:** upload `references/agents.png`.
```
Turn these five flat characters into small 3D objects, each the size of a grapefruit, floating side by side in a row: smooth glossy plastic with the same soft gradient colours, the same shapes and the same two black oval eyes, no mouths, no arms. Each glows faintly in its own colour. From left to right: the cyan sphere, the green droplet, the yellow rounded cube, the pink capsule and the orange sphere. Plain warm-grey studio backdrop, soft light, photorealistic.
```
Save this as **agents-3d**. When a shot needs one agent, upload agents-3d and say which one,
"the cyan sphere" for example.

---

## 2. The shots

### Shot 1: Bills follow you everywhere (0:00–0:05)

**A.** Upload: Nina, bill person.
```
Using the woman from image 1 and the man's suit and placard from image 2: a wide, perfectly symmetrical shot of a quiet brownstone street in soft golden morning light. Nina walks toward the camera down the middle of the pavement holding a paper coffee cup, shoulders slumped. Behind her, about ten expressionless men and women in identical charcoal-grey suits and grey flat caps follow in loose formation, each holding a white placard on a wooden stick at chest height with bold black hand-painted capital letters. The placards read, exactly: "ELECTRIC $64.20", "PHONE BILL", "RENT", "GROCERIES", "GYM". Photorealistic, shot on 35mm film with an anamorphic lens, shallow depth of field, muted teal and amber palette, fine film grain, deadpan whimsical comedy, 16:9.
```

**B.**
```
Nina, the woman in the mustard-yellow raincoat, trudges slowly toward the camera holding her coffee. The crowd of people in grey suits behind her follows in perfect step, two paces back, placards held steady facing the camera. She glances back over her shoulder; every person in the crowd tilts their head at the same angle at the same moment. Slow dolly back matching her pace. Photorealistic, 35mm film, warm golden-hour light, soft haze, symmetrical composition, deadpan comedy.
Audio: footsteps falling in unison on the pavement, morning birdsong, a car passing far away. No music, no dialogue.
```

### Shot 2: Even on the bus (0:05–0:09)

**A.** Upload: Nina, bill person.
```
Using the woman from image 1 and the suit and placard from image 2: inside a city bus in the morning, sunlight streaming through the windows. Nina sits in a window seat. Every other seat around her is taken by expressionless people in identical charcoal-grey suits and grey flat caps, all turned to face her, holding white placards with bold black hand-painted capital letters that read, exactly: "PHONE BILL", "DINNER SPLIT", "GROCERIES". Symmetrical framing down the aisle, photorealistic, 35mm film, warm light, muted teal and amber palette, film grain, deadpan comedy, 16:9.
```

**B.**
```
The bus moves and sunlight flickers across the still faces of the people in grey suits, who do not move or blink. Nina slowly slides down in her seat and puts on a pair of dark sunglasses. Very slow push-in toward Nina. Photorealistic, 35mm film, warm light strobing through the windows, deadpan comedy.
Audio: a bus engine rumbling, brakes hissing softly. No music, no dialogue.
```

### Shot 3: Then she got Flick (0:09–0:14)

**A.** Upload: Nina, bill person.
```
Using the woman from image 1 and the suit and placard from image 2: a park bench at golden hour, wide and symmetrical. Nina sits in the middle of the bench holding her phone in both hands, the screen glowing softly onto her face; the screen faces her and cannot be seen. Standing all around the bench, close, are a dozen expressionless people in identical charcoal-grey suits and grey flat caps holding white placards with bold black hand-painted capital letters reading "RENT", "GYM", "PHONE BILL" and "GROCERIES". Photorealistic, 35mm film, warm golden light, soft haze, film grain, 16:9.
```

**B.**
```
Nina taps her phone once. A soft warm glow blooms from the phone and a few tiny sparks, cyan, violet and pink, drift up past her face like fireflies. She looks up from the phone, surprised and curious. The people in grey suits around her stay perfectly still. Slow push-in toward Nina. Photorealistic, 35mm film, golden-hour light.
Audio: a gentle download chime, then a soft sparkle. No music, no dialogue.
```

### Shot 4: Meet the agents (0:14–0:19)

**A.** Upload: Nina, agents-3d.
```
Using the woman from image 1 and the five small floating characters from image 2: a close shot of Nina on a park bench at golden hour, holding her phone at chest height with the screen facing her. The five little glossy characters float in a gentle arc just above her phone: the cyan sphere, the green droplet, the yellow rounded cube, the pink capsule and the orange sphere, each with two black oval eyes and a faint glow in its own colour. Nina looks at them in wonder. Photorealistic, 35mm film, shallow depth of field, warm light, 16:9.
```

**B.**
```
The five small glossy characters pop out of the phone one after another like corks, then float up and settle in the air around Nina's shoulders, bobbing gently and blinking their black oval eyes. Nina's eyebrows rise and she breaks into a delighted grin. Gentle slow push-in. Photorealistic, 35mm film, golden-hour light, whimsical.
Audio: five soft pops rising in pitch, then a happy little shimmer. No music, no dialogue.
```

### Shot 5: Lens, snap it and flick it (0:19–0:24)

**A.** Upload: Nina, bill person, agents-3d.
```
Using the woman from image 1, the man from image 2 and the cyan sphere from image 3: the brownstone street at golden hour. The man in the charcoal-grey suit and grey flat cap stands facing Nina, holding a white placard reading, exactly, "ELECTRIC $64.20" in bold black hand-painted capital letters. The small glossy cyan sphere with two black oval eyes hovers in front of his placard, casting a thin horizontal line of cyan light across it like a scanner. Nina stands beside it holding her phone at chest height, screen facing her. Photorealistic, 35mm film, warm light, symmetrical, 16:9.
```

**B.** Optional end frame: the same image with the man and his placard removed.
```
The cyan sphere sweeps its thin line of cyan light down the placard and gives a small happy bounce. Nina holds her phone at chest height and flicks her index finger quickly upward once in front of the phone's front camera; three tiny sparks, cyan, violet and pink, pop off her fingertip. The man in the grey suit politely tips his cap, then dissolves from the edges inward into drifting golden dust with tiny cyan, violet and pink sparks that float upward and catch the light, the placard dissolving last. The cyan sphere does a little loop of joy. Static camera. Photorealistic, 35mm film, golden-hour light.
Audio: a soft scanner hum and a beep, then a whoosh and a shimmering chime as he vanishes. No music, no dialogue.
```

### Shot 6: Scout, the usual, cheaper (0:24–0:29)

**A.** Upload: Nina, bill person, agents-3d.
```
Using the woman from image 1, the suits from image 2 and the orange sphere from image 3: a symmetrical supermarket aisle in warm light with colourful shelves. Nina pushes a shopping trolley toward the camera. Behind her, a single-file line of six expressionless people in charcoal-grey suits and grey flat caps follows like ducklings, each holding a white placard reading, exactly, "GROCERIES" in bold black hand-painted capital letters. The small glossy orange sphere with two black oval eyes floats ahead of the trolley. Photorealistic, 35mm film, 16:9.
```

**B.**
```
The orange sphere darts along the shelves, tapping products, which drop neatly into Nina's trolley. Nina holds her phone up and flicks her index finger quickly upward once in front of the phone's front camera; tiny cyan, violet and pink sparks pop off her fingertip. The line of people in grey suits behind her dissolves one after another, front to back, like falling dominoes, each into drifting golden dust with tiny coloured sparks. Slow dolly back down the aisle. Photorealistic, 35mm film, warm light, whimsical.
Audio: trolley wheels rolling, soft taps, a quick run of whooshes and chimes. No music, no dialogue.
```

### Shot 7: Splitter, dinner shared (0:29–0:34)

**A.** Upload: Nina, bill person, agents-3d.
```
Using the woman from image 1, the suit from image 2 and the yellow rounded cube from image 3: a candlelit dumpling restaurant with red paper lanterns, a symmetrical table for four. Nina sits facing the camera with three friends: Maya with curly copper-red hair and freckles, Leo, very tall, with a red-and-white striped football scarf, and Priya with a sleek black ponytail and gold-rimmed glasses. Behind Nina stands a man in a charcoal-grey suit and grey flat cap holding a white placard reading, exactly, "DINNER SPLIT" in bold black hand-painted capital letters. The small glossy yellow rounded cube with two black oval eyes hovers over the table. Photorealistic, 35mm film, warm candlelight, 16:9.
```

**B.**
```
The yellow rounded cube hops onto the top edge of the "DINNER SPLIT" placard, and the placard splits into three small placards that float gently through the air and land on the table in front of Maya, Leo and Priya. Maya and Priya each lift their phones and flick one finger upward in front of the camera, and their small placards turn into golden dust with tiny coloured sparks. Leo frowns at his placard and puts his phone in his pocket. Static camera. Photorealistic, 35mm film, warm candlelight, deadpan comedy.
Audio: restaurant chatter and chopsticks, a soft paper rip, two whooshes with chimes, Leo sighing. No music.
```

### Shot 8: Nudge, and friends paying back (0:34–0:39)

**A.** Upload: bill person, agents-3d. Describe Leo as below.
```
Using the suit and placard from image 1 and the pink capsule from image 2: a five-a-side football pitch in soft morning mist, wide and symmetrical. Leo, a very tall man in his mid-20s with sandy hair and a red-and-white striped football scarf, dribbles a football. A man in a charcoal-grey suit and grey flat cap jogs right beside him holding a white placard reading, exactly, "LEO OWES YOU" in bold black hand-painted capital letters. The small glossy pink capsule with two black oval eyes floats toward Leo's shoulder. Photorealistic, 35mm film, 16:9.
```

**B.** Optional end frame: the same image with the jogging man removed.
```
The pink capsule gently bumps Leo's shoulder, a little nudge. Leo stops, sighs, then smiles, takes out his phone and flicks one finger quickly upward in front of the phone's front camera; tiny cyan, violet and pink sparks pop off his fingertip. The jogging man in the grey suit dissolves mid-stride into drifting golden dust with tiny coloured sparks, his placard last. A thin ribbon of golden sparks arcs away from Leo's phone, off to the side of the frame. Static wide camera. Photorealistic, 35mm film, misty morning light.
Audio: a ball thudding, a soft boop as the capsule bumps him, a whoosh and a chime. No music, no dialogue.
```

### Shot 9: Autopilot, the whole week in one flick (0:39–0:45)

**A.** Upload: Nina, bill person, agents-3d.
```
Using the woman from image 1, the suits from image 2 and the green droplet from image 3: Sunday night, a small cosy bedroom lit by lamplight and a string of fairy lights, wide and perfectly symmetrical. The room is packed wall to wall with expressionless people in charcoal-grey suits and grey flat caps: on the bed, in the open wardrobe, by the window, standing in every corner, each holding a white placard with bold black hand-painted capital letters reading "RENT", "PHONE BILL", "GYM" and "GROCERIES". Nina sits on the edge of the bed in the middle holding her phone. The small glossy green droplet with two black oval eyes floats above her. Photorealistic, 35mm film, warm light, 16:9.
```

**B.** Optional end frame: "Remove every person in a grey suit and every placard except one blank placard lying on the floor. Keep the room, the lights and Nina exactly the same."
```
The green droplet flies one loop around the room, leaving a soft glowing green trail that circles everyone. In slow motion, Nina raises her phone and flicks her index finger quickly upward once in front of the front camera; three tiny sparks, cyan, violet and pink, pop off her fingertip. The entire crowd dissolves at once in a ripple of golden dust with tiny coloured sparks, from the door to the window. A single blank placard drifts down to the floor. The room is empty and quiet; Nina falls back onto the bed laughing. Static camera. Photorealistic, 35mm film, warm lamplight.
Audio: a clock ticking, then a whoosh that swells into a shimmering chord, then silence and Nina's laughter. No music.
```

### Shot 10: Free (0:45–0:49)

**A.** Upload: Nina, agents-3d. Also upload the start frame from shot 1, so the street matches.
```
Using the woman from image 1, the five characters from image 2 and the street from image 3: the same brownstone street, framed exactly the same way, now empty and bright with morning sun. Nina walks toward the camera with a coffee, light and smiling. The five small glossy characters, the cyan sphere, green droplet, yellow rounded cube, pink capsule and orange sphere, bob in the air around her shoulders like a little entourage. Photorealistic, 35mm film, warm light, symmetrical, 16:9.
```

**B.**
```
Nina walks toward the camera, relaxed and happy, the five little characters bobbing around her shoulders. She glances straight at the camera and does a small, playful flick with one finger; three tiny sparks, cyan, violet and pink, pop off her fingertip. Slow dolly back. Photorealistic, 35mm film, bright morning light.
Audio: birdsong, light footsteps, one bright chime on the flick. No music, no dialogue.
```

### Shot 11: The logo (0:49–0:55)

Use `cards/install-now.mp4` as it is. It's Flick's real logo, animated: the finger flicks, the sparks
burst, then "Install Flick now", flickit.site and a QR code to the install page. Veo isn't needed.

---

## Putting it together

- **Trim each Veo clip** to its time above, keeping the moment of action, and cut on motion.
- **Keep Veo's sound**, and lay music on top: playful pizzicato strings that build, a pause
  before shot 9's flick, one warm chord over the empty room, and a hit on the logo's flick.
- **On-screen lines:** import `subtitles.srt`.
- **Export** 1080p at 24fps.
