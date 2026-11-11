# Flick demo video: the prompt pack

**"The Crowd."** All week, Nina is followed by silent people holding her bills on placards. Flick
makes them vanish one by one, and on Sunday night one flick of her finger clears a room full of them.

- **Part A, the film:** 1:30 of AI video, eight-second clips at most, cut on motion.
- **Part B, how it works:** 1:15 of real Flick screen recordings with a voice-over.
- **Total:** 2:45, under the 3:00 limit. Due Nov 12, 12:00 PST.

Every phone screen in the film is a real recording of Flick (marked **APP**). The AI never draws
the phone's screen.

## What's in this folder

| File | What it's for |
|---|---|
| `prompts.md` | This: every prompt, shot by shot, and what to record |
| `props/city-power-bill.png` | Print it, or show it on a second screen, and snap it with Lens (shot 8). Lens reads City Power, $64.20, due Nov 14 |
| `props/northwind-mobile-ebill.pdf` | The e-bill to share to Flick (shot 10). Lens reads Northwind Mobile, $31.75, due Nov 15 |
| `props/mama-lus-receipt.png` | The dinner receipt to split (shot 12). Lens reads four items, $64.71 |
| `cards/end-card.png` | The last frame, 1920×1080, with Flick's real logo |
| `cards/how-card.png` | The title between the film and the walkthrough |
| `subtitles.srt` | The film's day titles and lines, timed to the cut below |

The props were checked: Lens reads each one with the real model and gets the amount, the due
date and, on the receipt, every item.

## What changed from the first draft

- **The flick is a finger, not a hand.** Flick pays when you flick one finger *up* in front of the
  phone's front camera. Every flick in the film is that: quick, upward, at the selfie camera.
- **The vanish carries the logo's colours.** Flick's mark is a finger with three sparks: cyan,
  violet and pink. Each vanish is golden dust with a few of those sparks.
- **Friends pay in Flick Chat.** Splitter sends friends on Flick their share in a chat, and they
  pay it with a flick. Friends not on Flick get a PayPal invoice instead.
- **New beats** for features built since: an e-bill shared to Flick, a business paid at its own
  PayPal, and Ask Flick by voice (Part B).
- **Recordings use the props.** The working pages show only real data now, with no samples, so
  you make the data by snapping the props. The app then shows the same names and amounts as the
  placards.
- **Nina's skin is warm brown**, the colour of the logo's finger, so her flick in shot 17 echoes
  the logo. Change it in the NINA block if you'd rather.

---

## 1. Make the reference stills first

Use an image model that spells text well: GPT Image, Imagen 4 or Ideogram. These become the
"ingredients" (Veo), "elements" (Kling) or "references" (Runway) in every shot, and they keep faces
and costumes the same from shot to shot.

**R1, Nina (make two: full body, and face close-up)**
```
Character reference sheet, photorealistic. Nina, a woman in her mid-20s with warm brown skin, a
short glossy black bob with blunt bangs, small gold hoop earrings and expressive, slightly tired dark
eyes. Mustard-yellow knee-length raincoat over a navy crew-neck sweater, dark straight jeans, white
sneakers. Standing straight, facing camera, neutral expression, plain warm-grey studio backdrop,
soft even light, full body and a separate head-and-shoulders close-up, 35mm film look.
```

**R2, a sign-holder**
```
Character reference, photorealistic. An expressionless man in his 40s in a charcoal-grey wool
three-piece suit and a matching grey flat cap, white shirt, thin black tie, black leather shoes,
holding a blank white rectangular placard (60×40 cm) on a pale wooden stick at chest height with
both hands. Standing straight, facing camera, deadpan, plain warm-grey backdrop, soft even light,
full body, 35mm film look.
```
Make a second one, a woman, in the identical suit and cap. Crowds read as one uniform group.

**R3, the friends (one still, three people side by side)**
```
Three friends in their mid-20s, photorealistic, plain warm-grey backdrop, soft light, waist up,
facing camera, smiling. Left: Maya, freckled, curly copper-red hair, olive-green cardigan. Middle:
Leo, very tall, sandy hair, a red-and-white striped football scarf over a navy jacket. Right:
Priya, sleek long black ponytail, gold-rimmed glasses, burgundy turtleneck.
```

**R4, the placards (one still per sign, for start frames)**
```
A white rectangular placard on a pale wooden stick, photographed straight on, filling the frame,
hand-painted bold black capital letters, slightly uneven brush strokes, the words exactly:
"[TEXT]". Clean, legible, evenly lit, no other text.
```
Make one for each:
`CITY POWER $64.20 DUE SAT` · `CITY POWER $64.20 DUE TODAY` · `NEW E-BILL NORTHWIND MOBILE $31.75` ·
`MAYA PILATES $9 THU` · `MOBILE CO $25` · `BEAN THERE TIP?` · `CORNER GROCERY $38.50` ·
`MAYA'S SHARE` · `LEO'S SHARE` · `PRIYA'S SHARE` · `LEO OWES YOU` · `LEO FIVE-A-SIDE $3.60 SUN`

---

## 2. Blocks to paste into every prompt

**STYLE**
```
Shot on 35mm film, anamorphic lens, warm golden-hour light, soft haze, shallow depth of field,
muted teal and amber palette, fine film grain, symmetrical composition, deadpan comedic tone in the
style of a whimsical European art-house comedy, photorealistic, cinematic, 24fps, 16:9.
```

**NINA**
```
Nina, a woman in her mid-20s with warm brown skin, a short glossy black bob with blunt bangs, small
gold hoop earrings, a mustard-yellow raincoat over a navy sweater, expressive tired eyes.
```

**SIGN-HOLDERS**
```
Expressionless men and women in identical charcoal-grey wool suits and grey flat caps, each holding
a white rectangular placard on a pale wooden stick at chest height, bold black hand-painted capital
letters, perfectly still, staring politely at Nina.
```

**VANISH**
```
The sign-holder dissolves from the edges inward into drifting golden dust motes, with a few tiny
cyan, violet and pink sparks among them; the dust floats upward and catches the light; the placard
dissolves last; the space where they stood is simply empty.
```

**NEGATIVE** (Kling and Runway take it as a negative prompt; for Veo and Sora, add "Avoid: …")
```
garbled text, misspelled placards, extra fingers, deformed hands, readable phone screens, app
interfaces, logos, brand names, subtitles, watermarks, captions, fast whip pans, cartoon style
```

The mustard coat against the grey suits makes Nina pop in every crowd shot.

---

## 3. The film, shot by shot

**How to make each shot:**
1. Make the **start frame** with your image model, with the placard text right and the reference stills attached.
2. Animate it with the **video prompt**: image-to-video in Veo 3 (Flow), Sora 2, Kling 2 or Runway Gen-4. Text that's already in the first frame stays readable when the camera moves slowly.
3. **Sound** is for Veo 3 and Sora 2, which make audio. With Kling or Runway, add sound in the edit. Music always goes on in the edit, so tell the model "no music".
4. Make 2 or 3 takes per shot and keep the best. Each prompt below gets the STYLE and NINA blocks pasted after it, and SIGN-HOLDERS where there are any.

### Act 1: the crowd grows (0:00–0:26)

**Shot 1. MONDAY (4s)**
- *Start frame:* Wide, symmetrical shot of a quiet brownstone street in soft morning light. Nina, holding a paper coffee cup, steps out of a green front door at the top of five stone steps. A sign-holder stands half-hidden behind a plane tree at the foot of the steps, placard "CITY POWER $64.20 DUE SAT".
- *Video:* Nina walks down the steps and along the pavement toward camera, sipping her coffee, unaware. The sign-holder steps out from behind the tree and falls into step exactly two paces behind her, placard held steady facing camera. Slow dolly back, matching her pace.
- *Sound:* quiet street ambience, birdsong, footsteps on stone, one car passing far off; no music.
- *Super:* MONDAY

**Shot 2. TUESDAY (4s)**
- *Start frame:* Inside a brushed-steel office elevator, framed dead centre and head-on. Nina stands in the middle facing the doors. Three sign-holders stand packed tightly behind her, placards facing camera: "MAYA PILATES $9 THU", "MOBILE CO $25" and "CITY POWER $64.20 DUE SAT".
- *Video:* Static locked-off camera. Nobody moves. The elevator doors slide shut from both sides toward the centre, closing on the scene. Nina blinks once.
- *Sound:* elevator hum, a soft ding, doors sliding shut; no music.
- *Super:* TUESDAY

**Shot 3. WEDNESDAY (5s)**
- *Start frame:* A city bus interior, morning light strobing through the windows. Nina sits by the window. Every seat around her is filled by sign-holders, all turned to face her. The nearest placard reads "CITY POWER $64.20 DUE TODAY"; behind it, one reads "NEW E-BILL NORTHWIND MOBILE $31.75".
- *Video:* The light flickers across faces as the bus moves. Nina's phone, face down in her lap, buzzes once. She slowly puts on dark sunglasses. The sign-holders do not move. Very slow push-in on Nina.
- *Sound:* bus engine rumble, a phone buzzing once; Nina, quietly: "Please stop." The nearest sign-holder, flat and polite: "Due today." No music.
- *Super:* WEDNESDAY

**Shot 4. THURSDAY (4s)**
- *Start frame:* A cosy café counter, warm wood and brass, symmetrical. The barista holds out Nina's cup across the counter. Behind the counter, a short sign-holder is just rising into view, a small placard reading "BEAN THERE TIP?".
- *Video:* The short sign-holder rises slowly until the placard is level with Nina's face. Nina takes her cup and closes her eyes in silent suffering. Static camera.
- *Sound:* espresso machine hiss, cups clinking; no music.
- *Super:* THURSDAY

**Shot 5. FRIDAY (4s)**
- *Start frame:* A supermarket aisle, symmetrical, warm fluorescent light, shelves of colourful cereal. Nina pushes a trolley straight toward camera. A single-file line of eight sign-holders follows behind her like ducklings; the nearest placard reads "CORNER GROCERY $38.50".
- *Video:* Nina walks toward camera; the line of sign-holders follows in perfect step, all turning their heads together when she turns hers. Slow dolly back down the aisle.
- *Sound:* trolley wheels squeaking, supermarket hum; no music.
- *Super:* FRIDAY

**Shot 6. The standoff (5s)**
- *Start frame:* A street at golden hour, long shadows. Nina has stopped and turned around to face camera. Behind her, a crowd of about twelve sign-holders has stopped in perfect unison, placards raised.
- *Video:* Complete stillness. Wind moves Nina's hair and the hem of her coat. Very slow push-in to a close-up of her face; her eyes narrow. She reaches into her coat pocket for her phone.
- *Sound:* music cuts out (in the edit); only wind and a distant church bell.

### Act 2: snap it (0:26–1:06)

**Shot 7. The snap (3s)**
- *Start frame:* Over Nina's shoulder: she holds up her phone, its screen facing away from camera and out of focus, framing the City Power sign-holder. His placard has become an oversized paper electricity bill.
- *Video:* She steadies the phone; a soft camera-shutter flash. The sign-holder stays perfectly still.
- *Sound:* a camera shutter click.

**Shot 8. APP: Lens, and a business on Flick (6s)**
Screen recording (see section 4). Lens reads the City Power bill: City Power, $64.20, due Nov 14. The green line reads "City Power is on Flick: paid to its own PayPal". She taps Pay, the Flick to pay sheet opens, and a finger flicks up in front of the front camera: paid.

**Shot 9. The first vanish (4s)**
- *Start frame:* Back on the golden-hour street. The City Power sign-holder stands in front of the crowd, facing Nina.
- *Video:* He touches the brim of his cap politely, then [VANISH]. The crowd behind him shifts uneasily, glancing at each other.
- *Sound:* a soft whoosh and a shimmering chime; Nina, under her breath: "…huh."

**Shot 10. APP: an e-bill, shared to Flick (4s)**
Screen recording. In the mail app: the Northwind Mobile e-bill PDF, Share, then Flick. Lens reads Northwind Mobile, $31.75, due Nov 15. It's due this week, so it goes into Sunday's plan. Cut back to the crowd: the e-bill sign-holder steps to the back, flipping his placard to read "SUN".

**Shot 11. SATURDAY NIGHT (5s)**
- *Start frame:* A candlelit dumpling restaurant, red lanterns, symmetrical table for four. Nina sits facing camera with Maya, Leo and Priya [R3]. A waiter sets the bill down in front of Nina. Three sign-holders stand behind her chair: "MAYA'S SHARE", "LEO'S SHARE" and "PRIYA'S SHARE".
- *Video:* The friends laugh, oblivious. Nina glances back at the three sign-holders, then down at the bill. She picks up her phone.
- *Sound:* restaurant chatter, chopsticks, laughter; no music.
- *Super:* SATURDAY

**Shot 12. APP: Splitter, then Flick Chat (6s)**
Screen recording:
1. Snap Mama Lu's receipt.
2. *Split it with friends*: the who-had-what grid fills in.
3. Type "Maya and I shared the dumplings, Leo had the wontons, we all had tea".
4. *Tick it for me*: the grid ticks itself.
5. Send. Each friend's share goes into Flick Chat.

**Shot 13. The handover (6s)**
- *Start frame:* Same restaurant framing as shot 11. The three sign-holders have walked around the table and each stands behind one friend, placards over their heads. The friends look up, horrified. Nina sips green tea, smug.
- *Video:* Maya and Priya each lift their phones and flick one finger up at the front camera; their sign-holders [VANISH] one after the other. Leo slides his phone into his pocket with a sigh; his sign-holder stays, unmoved.
- *Sound:* two soft whooshes with chimes; Leo, flatly: "Oh, come on."

**Shot 14. SUNDAY MORNING (6s)**
- *Start frame:* A five-a-side football pitch in morning mist, wide and symmetrical. Leo dribbles a ball; a sign-holder jogs right beside him, placard "LEO OWES YOU".
- *Video:* They jog in perfect step. Leo's phone buzzes on the bench; he stops, sighs, walks over and picks it up. Then cut to the APP insert (below), and back: Leo flicks one finger up at the phone's front camera, and the jogging sign-holder [VANISH] mid-stride.
- *APP insert:* Nudge, a reminder in the Funny tone, sent to Leo.
- *Sound:* ball thuds, breath, a phone buzz, then a whoosh and a chime.
- *Super:* SUNDAY

### Act 3: one flick (1:06–1:30)

**Shot 15. SUNDAY NIGHT (5s)**
- *Start frame:* Nina opens her bedroom door. The small room is packed wall to wall with sign-holders: on the bed, in the wardrobe, by the window, under a string of fairy lights. Placards: "MOBILE CO $25", "MAYA PILATES $9 THU", "BEAN THERE TIP?", "CORNER GROCERY $38.50", "LEO FIVE-A-SIDE $3.60 SUN" and "NORTHWIND MOBILE $31.75 SUN". Wide, perfectly symmetrical, warm lamplight.
- *Video:* Static. Nina stands in the doorway taking it in. A wall clock ticks. One sign-holder on the bed adjusts his cap.
- *Sound:* a clock ticking, total silence otherwise.

**Shot 16. APP: Autopilot (4s)**
Screen recording. Nina squeezes onto the edge of the bed and opens Flick: the week's plan, Monday to Sunday, every payment with Autopilot's reason. Then *Approve with PayPal*.

**Shot 17. The flick (3s)**
- *Start frame:* Extreme close-up, slow motion. Nina's hand holds her phone up at eye level, the screen facing her, out of focus; her index finger is poised just below the phone's front camera.
- *Video:* In slow motion she flicks her index finger upward once, quickly, in front of the front camera. Three tiny sparks, cyan, violet and pink, burst off her fingertip, like the Flick logo.
- *Sound:* a soft, satisfying whoosh, then silence.

**Shot 18. The empty room (5s)**
- *Start frame:* Same framing as shot 15.
- *Video:* The whole crowd dissolves at once in a ripple of golden dust with cyan, violet and pink sparks, from the doorway to the window. A single blank placard drifts down to the floor. The room is empty and quiet. Nina falls back onto the bed and laughs.
- *Sound:* a rising shimmer that resolves into silence, then Nina's laugh.

**Shot 19. APP: done, then the end card (7s)**
Screen recording: the week approved, every payment scheduled. Then `cards/end-card.png`, "Your week, paid in one flick." Hold it for 4 seconds.

**Music:** playful pizzicato strings that build through Act 1, silence at the standoff, a lift
when the first one vanishes, silence before the flick, one warm chord over the empty room. A soft
whoosh and shimmer on every vanish.

---

## 4. What to record in the app

Record on the installed app on a phone, or in Chrome's device mode at 390×844, with the phone's
own screen recorder or OBS. Record each APP insert as its own clip, in this order. Each step makes
the data the next one needs.

**Before you start:**
- Deploy first, so the live site has e-bills, businesses and Flick Chat notifications.
- Sign in with PayPal (a sandbox personal account) on the phone that plays Nina. A flick then pays at once, with no PayPal page.
- In another browser, sign in with a second sandbox account, a **business** one, and register **City Power** on `/business`. Shot 8 then shows "City Power is on Flick: paid to its own PayPal".
- Add Maya, Leo and Priya on `/friends`. For shot 13's chat, at least Maya must be a sandbox account that has signed in to Flick on a second phone. Use placeholder emails for the others.
- Have the three props ready, printed or on a second screen.

| Shot | On screen | Steps |
|---|---|---|
| 8 | Lens, then Flick to pay | `/lens`, *Snap your own*, the City Power prop. The green "on Flick" line shows. *Pay $64.20*, flick a finger up at the camera: paid |
| 10 | Share sheet, then Lens | Open `northwind-mobile-ebill.pdf` in the mail or files app, *Share*, *Flick*: Lens reads it (on Android). On iPhone, use Lens's *Upload an e-bill*. Don't pay it: it goes into the week |
| 12 | Lens, then Splitter | Snap the Mama Lu's prop, *Split it with friends*, type the sentence from shot 12, *Tick it for me*, *Send* |
| 13 | Flick Chat, on Maya's phone | The banner "Nina asked you for $…", open the chat, *Pay*, flick |
| 14 | Nudge | `/nudge`, pick Leo, the *Funny* tone, *Send reminder* |
| 16 | Autopilot | `/autopilot`: Northwind Mobile $31.75 on Sunday, with Autopilot's reason. *Approve with PayPal*. For a fuller week on screen, also record the one-pager's Autopilot section on flickit.site, which plays the week from the placards in shot 15 |
| 19 | Done | The week approved, its payments scheduled |

---

## 5. Part B: how it works (1:15)

`cards/how-card.png` for 2 seconds, then real recordings with a short voice-over:

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 | Lens reads a bill; the green "on Flick" line | "Snap any bill, or share an e-bill. Flick's AI reads it, and businesses on Flick are paid straight to their own PayPal." |
| 0:12 | Flick to pay: a finger flicked up | "You say yes with one flick at your camera. The frames never leave your phone." |
| 0:20 | Autopilot: the week, an unusual payment flagged, Approve | "Autopilot learns what you pay and plans your week, flags anything odd, and takes one approval." |
| 0:33 | Splitter, then Flick Chat | "Splitter shares a bill to the cent. Friends pay their share in Flick Chat, with a flick." |
| 0:45 | Ask Flick, by voice | "Or just ask, out loud. Ask Flick reads your real money, and every action waits for your OK." |
| 0:57 | Money Studio | "Money Studio shows where it all went, with every PayPal payment." |
| 1:07 | `cards/end-card.png` | "Flick. Your week, paid in one flick." |

For the Ask Flick clip, tap the mic and say: "What do I still owe this week?" Then turn on *Read
replies aloud* so the reply is spoken.

---

## 6. Putting it together

1. Lay the shots out in order in CapCut or DaVinci Resolve. Trim each clip to its marked length, and cut on motion.
2. Drop each APP recording in at its shot. Crop or zoom to the phone screen, or use the 390×844 recording full height in a 16:9 frame over a soft blurred background.
3. Import `subtitles.srt` for the day titles and lines, and style them small, white, in a clean sans serif.
4. Music and sound effects go on top, as in the music note at the end of section 3.
5. Export at 1080p, 24fps, and upload to YouTube, unlisted or public, for the submission.
