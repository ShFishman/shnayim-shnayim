# שְׁנַיִם שְׁנַיִם · Two by Two

A 3D browser game about **פרשת נח** — the Flood, the Ark, and a world that
would not listen.

You are Noah. You have an ark, a ramp, and a shofar. You have to get a male and
a female of every kind aboard before the water closes over the valley. You can
also try to talk the neighbours into coming with you. They have opinions.

It opens with a two-minute scene in which God gives Noah the specifications and
Noah asks reasonable follow-up questions. You can skip it.

**▶ Play: https://shfishman.github.io/shnayim-shnayim/**

Hebrew first, with an English toggle. Runs in any modern browser. No install,
no build step, no downloads.

---

## How to play

| | |
|---|---|
| `WASD` / arrows | walk |
| `Shift` | run |
| `Space` | blow the shofar — animals nearby start following you |
| `E` | talk to a villager |
| drag | turn the camera |
| wheel | zoom |
| `Esc` | pause |

On a phone you get a thumbstick and two buttons. Any click skips the opening.

**Finding your way.** The minimap bottom-left is also a flood map: ground still
above water is green, drowned ground is blue, so you can see at a glance where
it is still safe to walk. Pink and blue dots are the animals you still owe. The
gold arrow points at the nearest one; once you have animals following you it
turns green and points back at the ramp.

**The goal.** Lead animals to the foot of the ramp and they walk aboard. You
need *two of each kind, male and female* — the rings under their feet are blue
for males and pink for females, and the strip along the bottom of the screen
tracks what you still owe. You can lead five at a time.

**The pressure.** The water rises on a curve, not a line: for the first minute
almost nothing happens, and then it gets away from you. Animals caught by the
water panic and bolt uphill, which is usually away from the ark. Wading slows
you down badly.

**The side quest.** Every villager you talk round widens your shofar's range.
They take three conversations each and most of them spend the first two being
very funny about it.

And there is a unicorn somewhere. Good luck.

---

## Running it locally

It is a static site with no build step, but it does use ES modules, so it needs
to be served over HTTP rather than opened as a `file://` URL:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

Three.js is pulled from a CDN via an import map in `index.html`.

---

## How it is built

Everything is procedural. There is not a single texture, model or audio file in
this repository — the whole thing is geometry generated at load time, GLSL, and
Web Audio oscillators.

```
index.html          import map, all HUD markup
styles.css
src/
  main.js           boot, the run of play, the ending
  opening.js        the two-minute cold open: script and staging together
  minimap.js        radar, and the flood map
  engine.js         renderer, camera rig, post stack, frame loop
  world.js          terrain, the flood, sky, rain
  ark.js            the ark — hull lofted from elliptical sections
  player.js         Noah, and input
  animals.js        herding: the conga line, pairs, panic
  villagers.js      the neighbours and their dialogue
  fauna.js          procedural animal bodies
  flora.js          procedural trees
  particles.js      point-sprite systems
  hud.js            the HTML layer
  content.js        every word in the game, {he, en}
  audio.js          synthesised shofar, thunder, rain, honks
  shaders.js        GLSL: sky, water, ground, rain, clouds, wood
  materials.js      shader → ShaderMaterial bridge
  utils.js          easing, tweens, seeded RNG, the clock
```

A few things worth pointing at:

**The flood is free.** The water shader displaces its Gerstner waves in *world*
space, so raising the sea is literally `mesh.position.y = level`. The wave field
stays anchored to the world instead of sliding around with the mesh, and no
shader uniform has to know the flood is happening.

**Terrain agrees with itself.** The valley is displaced on the CPU from an
analytic height function, and `heightAt()` evaluates that same function. Gameplay
and geometry can never disagree, and nothing has to raycast.

**Nikud survives.** Dialogue reveals a word at a time, not a character at a time.
Hebrew vowel points are separate code points, so per-character typing gives you a
bare letter with a dangling kamatz for a frame or two. Word-at-a-time sidesteps it.

**The shofar is a model, not a sample.** A ram's horn has no valves and almost no
bore shaping, so it is mostly one buzzing partial that cracks up to the next one.
It is synthesised as a sawtooth through a tight bandpass with a pitch scoop at the
front and a deliberate break partway through.

The renderer, the noise library, the sky/water/veil shaders and the procedural
flora and fauna began life in a companion project about **פרשת בראשית** and were
adapted here.

---

## Notes on the text

Verses are Masoretic with nikud and the divine name written ה׳. The jokes were
written in Hebrew first; the English is a translation that tries to keep the joke
rather than the words, so a few lines are differently funny in each language.

The running gag — that Noah preaches for a hundred and twenty years and converts
nobody — is in the text. The scoreboard notes your final tally of believers
against the original, which is zero.

---

## Licence

MIT. Do what you like with it.
