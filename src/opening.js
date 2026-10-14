// opening.js — the two-minute cold open.
//
// Script and staging live together on purpose: every line is timed against a
// camera move, and splitting them across files makes both halves unreadable.
//
// The whole thing is skippable at any moment. Each beat awaits `hold()`, which
// resolves immediately once the skip flag is set, so a skip unwinds the entire
// sequence within a frame instead of leaving half a cutscene running.

import { clock, ease } from './utils.js';

const VOICE = { he: 'קוֹל', en: 'A Voice' };
const NOAH = { he: 'נֹחַ', en: 'Noah' };

/* The script. `who` null means narration rather than speech. */
export const OPENING = Object.freeze({
  verses: [
    { ref: 'בראשית ו׳:ה׳',
      he: 'וַיַּרְא ה׳ כִּי רַבָּה רָעַת הָאָדָם בָּאָרֶץ.',
      en: 'And the LORD saw that the wickedness of man was great upon the earth.' },
    { ref: 'בראשית ו׳:ח׳',
      he: 'וְנֹחַ מָצָא חֵן בְּעֵינֵי ה׳.',
      en: 'But Noah found favour in the eyes of the LORD.' },
  ],

  call: [
    { who: VOICE, he: 'נֹחַ.', en: 'Noah.', dur: 2.2 },
    { who: NOAH, he: '...כֵּן?', en: '...yes?', dur: 2.4 },
    { who: VOICE, he: 'עֲשֵׂה לְךָ תֵּבַת עֲצֵי גֹפֶר.', en: 'Make yourself an ark of gopher wood.', dur: 3.4 },
    { who: NOAH, he: 'תֵּבָה.', en: 'An ark.', dur: 2.0 },
    { who: VOICE, he: 'תֵּבָה.', en: 'An ark.', dur: 2.0 },
    { who: NOAH, he: 'וְאֵיפֹה בְּדִיּוּק מוֹצְאִים עֲצֵי גֹפֶר?', en: 'And where exactly does one find gopher wood?', dur: 3.6 },
    { who: null, he: '(שְׁתִיקָה אֲרֻכָּה)', en: '(a long silence)', dur: 2.8 },
    { who: NOAH, he: 'טוֹב. אֶמְצָא.', en: 'Fine. I will find some.', dur: 2.6 },
  ],

  measure: [
    { who: VOICE, he: 'שְׁלֹשׁ מֵאוֹת אַמָּה אָרְכָּהּ, חֲמִשִּׁים אַמָּה רָחְבָּהּ, שְׁלֹשִׁים אַמָּה קוֹמָתָהּ.',
      en: 'Three hundred cubits long, fifty wide, thirty high.', dur: 4.6 },
    { who: NOAH, he: 'רֶגַע — אֲנִי רוֹשֵׁם. שְׁלֹשׁ מֵאוֹת...', en: 'Hold on — I am writing this down. Three hundred...', dur: 3.6 },
    { who: VOICE, he: 'וְצֹהַר תַּעֲשֶׂה לַתֵּבָה.', en: 'And you shall make a window for the ark.', dur: 3.0 },
    { who: NOAH, he: 'חַלּוֹן אֶחָד?', en: 'One window?', dur: 2.2 },
    { who: VOICE, he: 'אֶחָד.', en: 'One.', dur: 1.8 },
    { who: NOAH, he: 'לְכָל הַחַיּוֹת בָּעוֹלָם.', en: 'For every animal in the world.', dur: 2.8 },
    { who: VOICE, he: 'אֶחָד.', en: 'One.', dur: 2.2 },
  ],

  /* said by whichever villagers happen to be standing there */
  neighbours: [
    { he: 'גֶּשֶׁם? מָה זֶה גֶּשֶׁם? מֵעוֹלָם לֹא רָאִיתִי גֶּשֶׁם.', en: 'Rain? What is rain? I have never seen rain.', dur: 3.6 },
    { he: 'אַתָּה בּוֹנֶה סִירָה. בְּאֶמְצַע הַיַּבָּשָׁה.', en: 'You are building a boat. In the middle of dry land.', dur: 3.4 },
    { he: 'יֵשׁ לְךָ בִּכְלָל אִשּׁוּר בְּנִיָּה?', en: 'Do you even have a building permit?', dur: 3.0 },
    { he: 'וְאֵיךְ בְּדִיּוּק הַגִּ׳ירָפָה נִכְנֶסֶת?', en: 'And how exactly does the giraffe fit?', dur: 3.2 },
    { he: 'סָבָא שֶׁלִּי צָחַק עָלֶיךָ. אַבָּא שֶׁלִּי צָחַק עָלֶיךָ. עַכְשָׁו תּוֹרִי.',
      en: 'My grandfather laughed at you. My father laughed at you. Now it is my turn.', dur: 4.4 },
  ],

  years: [
    { he: 'נֹחַ הִסְבִּיר. שׁוּב. וְשׁוּב.', en: 'Noah explained. Again. And again.', dur: 3.2 },
    { he: 'עָבְרוּ מֵאָה וְעֶשְׂרִים שָׁנָה.', en: 'A hundred and twenty years went by.', dur: 3.4 },
    { he: 'הַתֵּבָה גָּדְלָה.', en: 'The ark grew.', dur: 2.6 },
    { he: 'הַשְּׁכֵנִים הִזְדַּקְּנוּ. הַיְּלָדִים שֶׁלָּהֶם קִבְּלוּ אֶת הַבְּדִיחוֹת בִּירֻשָּׁה.',
      en: 'The neighbours grew old. Their children inherited the jokes.', dur: 4.4 },
    { he: 'נֹחַ לֹא עָנָה. נֹחַ הִמְשִׁיךְ לִבְנוֹת.',
      en: 'Noah did not answer. Noah kept building.', dur: 3.6 },
    { he: 'מִסְפַּר הַמִּתְנַדְּבִים: אֶפֶס.', en: 'Number of volunteers: zero.', dur: 3.4 },
  ],

  animals: [
    { he: 'וְאָז בָּאוּ הַחַיּוֹת. מֵעַצְמָן. שְׁנַיִם שְׁנַיִם.', en: 'And then the animals came. By themselves. Two by two.', dur: 4.0 },
    { he: 'רֻבָּן.', en: 'Most of them.', dur: 2.4 },
    { he: 'הַנְּמָלִים הִגִּיעוּ רִאשׁוֹנוֹת. אַף אֶחָד לֹא סָפַר אוֹתָן.',
      en: 'The ants arrived first. Nobody counted them.', dur: 3.8 },
    { he: 'חֶלְקָן הִתְבַּלְבְּלוּ בַּדֶּרֶךְ.', en: 'Some of them got lost on the way.', dur: 3.4 },
  ],

  drop: [
    { who: VOICE, he: 'עוֹד שִׁבְעָה יָמִים.', en: 'Seven more days.', dur: 3.0 },
    { who: NOAH, he: 'שִׁבְעָה?!', en: 'Seven?!', dur: 2.0 },
    { who: VOICE, he: 'שִׁבְעָה.', en: 'Seven.', dur: 2.2 },
  ],

  go: { he: 'לֵךְ לֶאֱסֹף אוֹתָן.', en: 'Go and gather them.', dur: 3.2 },
  skipHint: { he: 'לְחַץ לְדַלֵּג', en: 'click to skip' },
});

/**
 * Play the cold open.
 * ctx: { engine, hud, audio, sky, rain, ocean, terrain, ark, crowd, herd, noah }
 * Returns when the scene is done or skipped.
 */
export async function playOpening(ctx) {
  const { engine, hud, audio, sky, rain, ark, crowd, herd, noah } = ctx;

  const state = { skipped: false };
  const skipNow = () => { state.skipped = true; };
  const onKey = e => { if (['Space', 'Enter', 'Escape'].includes(e.code)) skipNow(); };
  addEventListener('pointerdown', skipNow);
  addEventListener('keydown', onKey);

  /** Wait, unless we have been skipped. */
  const hold = async (sec) => {
    if (state.skipped) return;
    await clock.wait(sec);
  };
  const say = async (line) => {
    if (state.skipped) return;
    if (line.who) hud.speak(line.who, line, line.dur + 0.6);
    else hud.caption(line, line.dur + 0.4);
    await hold(line.dur);
  };
  const beat = async (fn) => { if (!state.skipped) await fn(); };

  hud.setHudVisible(false);
  hud.setCinema(true);
  hud.showSkipHint(OPENING.skipHint);
  engine.rig.free();
  engine.veil.vignette = 0.42;

  try {
    /* ── 1. the world, from above ───────────────────────────── */
    await beat(async () => {
      engine.rig.snap([40, 86, 120], [0, 6, 0]);
      engine.rig.fov = 52;
      engine.rig.moveTo([26, 30, 62], [0, 5, 0], 15, ease.inOutQuad);
      await hold(3.4);
      await hud.verse(OPENING.verses[0], 4.6);
      await hud.verse(OPENING.verses[1], 4.2);
    });

    /* ── 2. the call ─────────────────────────────────────────── */
    await beat(async () => {
      // drop to Noah, standing alone by the unbuilt ark
      engine.rig.moveTo([noah.pos.x + 6, noah.pos.y + 3.2, noah.pos.z + 7],
                        [noah.pos.x, noah.pos.y + 1.7, noah.pos.z], 3.2, ease.inOutCubic);
      await hold(2.2);
      audio.voice(0);
      await say(OPENING.call[0]);
      noah.headPivot.rotation.x = -0.25;
      await say(OPENING.call[1]);
      audio.voice(1);
      await say(OPENING.call[2]);
      await say(OPENING.call[3]);
      audio.voice(0);
      await say(OPENING.call[4]);
      await say(OPENING.call[5]);
      await say(OPENING.call[6]);          // the silence
      await say(OPENING.call[7]);
      noah.headPivot.rotation.x = 0;
    });

    /* ── 3. the measurements ─────────────────────────────────── */
    await beat(async () => {
      engine.rig.arcTo([30, 12, 34], [0, 6, 0], 13, 5, ease.inOutQuad);
      audio.voice(1);
      await say(OPENING.measure[0]);
      await say(OPENING.measure[1]);
      audio.voice(0);
      await say(OPENING.measure[2]);
      await say(OPENING.measure[3]);
      audio.voice(1);
      await say(OPENING.measure[4]);
      await say(OPENING.measure[5]);
      audio.voice(0);
      await say(OPENING.measure[6]);
    });

    /* ── 4. the neighbours ───────────────────────────────────── */
    await beat(async () => {
      const vs = crowd.list.slice(0, Math.max(OPENING.neighbours.length, 5));
      for (let i = 0; i < OPENING.neighbours.length; i++) {
        if (state.skipped) break;
        const v = vs[i % vs.length];
        if (!v) break;
        // cut to each heckler in turn
        // Villager.pos.y stays 0; the ground height lives on the group
        const vy = v.group.position.y;
        engine.rig.snap(
          [v.pos.x + 4.2, vy + 2.8, v.pos.z + 4.6],
          [v.pos.x, vy + 1.5, v.pos.z],
        );
        v._talk = OPENING.neighbours[i].dur;
        audio.blip();
        hud.speak(v.data.name, OPENING.neighbours[i], OPENING.neighbours[i].dur + 0.5);
        await hold(OPENING.neighbours[i].dur);
      }
    });

    /* ── 5. a hundred and twenty years ───────────────────────── */
    await beat(async () => {
      engine.rig.snap([44, 34, 60], [0, 6, 0]);
      engine.rig.moveTo([-40, 30, 56], [0, 6, 0], 18, ease.inOutQuad);
      for (const line of OPENING.years) {
        if (state.skipped) break;
        await say(line);
      }
    });

    /* ── 6. the animals arrive ───────────────────────────────── */
    await beat(async () => {
      // march a few pairs toward the ramp for the shot
      const marchers = herd.critters.filter(c => !c.extra && !c.isSecret).slice(0, 8);
      marchers.forEach((c, i) => {
        // park the idle wander timer, or it reassigns a random waypoint
        // mid-shot and the procession wanders off
        c.wanderT = 1e6;
        c.animal._wp = { x: ark.boardX + (i % 2 ? 1.7 : -1.7), z: ark.boardZ + 4 + i * 2.3 };
        c.animal._speedTarget = 1.5;
      });
      engine.rig.snap([14, 2.4, 30], [2, 2.0, 16]);
      engine.rig.moveTo([10, 3.4, 26], [0, 3.0, 10], 12, ease.inOutQuad);
      for (const line of OPENING.animals) {
        if (state.skipped) break;
        await say(line);
      }
    });

    /* ── 7. the first drop ───────────────────────────────────── */
    await beat(async () => {
      engine.rig.moveTo([noah.pos.x + 5, noah.pos.y + 4.4, noah.pos.z + 8],
                        [noah.pos.x, noah.pos.y + 2.6, noah.pos.z], 5, ease.inOutCubic);
      sky.setStorm(0.22);
      rain.setIntensity(0.06);
      audio.setRain(0.12);
      await hold(1.6);
      audio.thunder(0.9);
      engine.rig.shake(0.22, 2.2);
      noah.headPivot.rotation.x = -0.4;
      audio.voice(1);
      await say(OPENING.drop[0]);
      await say(OPENING.drop[1]);
      audio.voice(0);
      await say(OPENING.drop[2]);
      noah.headPivot.rotation.x = 0;
      await say(OPENING.go);
    });
  } finally {
    removeEventListener('pointerdown', skipNow);
    removeEventListener('keydown', onKey);

    // whatever happened above, leave the world in a clean, playable state
    clock.clear();
    hud.hideVerse();
    hud.hideDialog();
    hud.hideCaption();
    hud.hideSkipHint();
    hud.setCinema(false);
    engine.veil.vignette = 0.22;
    engine.rig.fov = 60;
    sky.setStorm(0);
    rain.setIntensity(0);
    audio.setRain(0);
    noah.headPivot.rotation.x = 0;
    for (const v of crowd.list) v._talk = 0;
    for (const c of herd.critters) {
      c.animal._wp = null;
      c.animal._speedTarget = 0;
      if (c.wanderT > 1e5) c.wanderT = Math.random() * 3;
    }
  }

  return state.skipped;
}
