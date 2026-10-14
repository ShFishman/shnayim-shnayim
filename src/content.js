// content.js — every word in the game.
//
// Pure data, no logic. Hebrew is the original; English is a translation that
// tries to keep the joke rather than the words. Where a gag only works in one
// language the other gets a different gag of the same size.
//
// Conventions:
//   - verses are Masoretic with nikud, the divine name written ה׳
//   - refs in Hebrew style: "בראשית ז׳:ד׳"
//   - everything the player reads is {he, en}

export const T = Object.freeze({

  meta: {
    title:    { he: 'שְׁנַיִם שְׁנַיִם', en: 'Two by Two' },
    subtitle: { he: 'אַרְבָּעִים יוֹם, אַרְבָּעִים לַיְלָה, וְאֶפֶס מִתְנַדְּבִים',
                en: 'Forty days, forty nights, and zero volunteers' },
    blurb: {
      he: 'אַתָּה נֹחַ. יֵשׁ לְךָ תֵּבָה, רַמְפָּה, וְשׁוֹפָר.<br>הָעוֹלָם חוֹשֵׁב שֶׁאַתָּה מַצְחִיק. הַגֶּשֶׁם כְּבָר בַּדֶּרֶךְ.',
      en: 'You are Noah. You have an ark, a ramp, and a shofar.<br>The world thinks you are hilarious. The rain is already on its way.',
    },
    begin: { he: 'הַתְחֵל', en: 'Begin' },
    headphones: { he: 'אוזניות מומלצות', en: 'Headphones recommended' },
  },

  /* ─────────────── UI chrome ─────────────── */
  ui: {
    aboard:     { he: 'בַּתֵּבָה', en: 'Aboard' },
    pairs:      { he: 'זוּגוֹת', en: 'Pairs' },
    water:      { he: 'מִפְלַס הַמַּיִם', en: 'Water' },
    days:       { he: 'יוֹם', en: 'Day' },
    preached:   { he: 'הֶאֱמִינוּ לְךָ', en: 'Believed you' },
    sound:      { he: 'צליל', en: 'Sound' },
    lang:       { he: 'English', en: 'עברית' },
    fullscreen: { he: 'מסך מלא', en: 'Fullscreen' },
    help:       { he: 'עזרה', en: 'Help' },
    resume:     { he: 'חֲזֹר לַמִּשְׂחָק', en: 'Resume' },
    restart:    { he: 'מֵהַתְחָלָה', en: 'Play again' },
    paused:     { he: 'הֻפְסַק', en: 'Paused' },
    skip:       { he: 'דַּלֵּג', en: 'Skip' },
  },

  controls: {
    title: { he: 'אֵיךְ מְשַׂחֲקִים', en: 'How to play' },
    rows: [
      { k: 'WASD / ←↑↓→', he: 'לָלֶכֶת', en: 'Walk' },
      { k: 'Shift',       he: 'לָרוּץ', en: 'Run' },
      { k: 'רווח / Space', he: 'לִתְקֹעַ בַּשּׁוֹפָר — חַיּוֹת בַּסְּבִיבָה יֵלְכוּ אַחֲרֶיךָ',
                           en: 'Blow the shofar — nearby animals follow you' },
      { k: 'E',           he: 'לְדַבֵּר עִם אֲנָשִׁים (זֶה לֹא יַעֲזֹר. תְּנַסֶּה בְּכָל זֹאת)',
                           en: 'Talk to people (it will not help. Try anyway)' },
      { k: 'גרירה / Drag', he: 'לְהִסְתּוֹבֵב', en: 'Turn the camera' },
      { k: 'גלגלת / Wheel', he: 'לְהִתְקָרֵב', en: 'Zoom' },
    ],
    goal: {
      he: 'הַכְנֵס זוּג מִכָּל מִין לַתֵּבָה לִפְנֵי שֶׁהַמַּיִם יְכַסּוּ אֶת הַכֹּל. זָכָר וּנְקֵבָה — שְׁנַיִם שְׁנַיִם.',
      en: 'Get a pair of every kind aboard before the water covers everything. Male and female — two by two.',
    },
  },

  /* ─────────────── opening ─────────────── */
  intro: [
    { he: 'וַיֹּאמֶר ה׳ לְנֹחַ: בֹּא אַתָּה וְכָל בֵּיתְךָ אֶל הַתֵּבָה.', en: 'And the LORD said to Noah: come, you and all your household, into the ark.', ref: 'בראשית ז׳:א׳', dwell: 4200 },
    { he: 'מִכֹּל הַבְּהֵמָה הַטְּהוֹרָה תִּקַּח לְךָ שִׁבְעָה שִׁבְעָה — וּמִן הַבְּהֵמָה אֲשֶׁר לֹא טְהֹרָה הִוא, שְׁנַיִם.', en: 'Of every clean animal take seven pairs — and of the animals that are not clean, two.', ref: 'בראשית ז׳:ב׳', dwell: 4600 },
    { he: 'נֹחַ קָרָא לָהֶם מֵאָה וְעֶשְׂרִים שָׁנָה.', en: 'Noah called to them for a hundred and twenty years.', dwell: 3400 },
    { he: 'אַף אֶחָד לֹא בָּא.', en: 'Nobody came.', dwell: 3000 },
    { he: 'נִשְׁאֲרוּ לְךָ שֶׁבַע דַּקּוֹת.', en: 'You have seven minutes left.', dwell: 3200 },
  ],

  /* ─────────────── the collectible roster ───────────────
   * key must exist in fauna.js SPECIES.
   * line plays once, when the pair is complete.
   */
  species: [
    { key: 'pil', he: 'פִּיל', en: 'Elephant',
      line: { he: 'הַפִּיל עָלָה. הָרַמְפָּה חָרְקָה. כֻּלָּם הֶעֱמִידוּ פָּנִים שֶׁלֹּא שָׁמְעוּ.',
              en: 'The elephant boarded. The ramp creaked. Everyone pretended not to hear it.' } },

    { key: 'gerafa', he: 'גִּ׳ירָפָה', en: 'Giraffe',
      line: { he: 'הַגִּ׳ירָפָה בּוֹדֶקֶת אֶת גֹּבַהּ הַתִּקְרָה. הַתִּקְרָה בּוֹדֶקֶת בַּחֲזָרָה.',
              en: 'The giraffe checks the ceiling height. The ceiling checks back.' } },

    { key: 'aryeh', he: 'אַרְיֵה', en: 'Lion',
      line: { he: 'הָאַרְיֵה הִסְכִּים לֹא לֶאֱכֹל אַף אֶחָד. בִּכְתָב. אֲנַחְנוּ סוֹמְכִים עָלָיו.',
              en: 'The lion agreed not to eat anyone. In writing. We trust him completely.' } },

    { key: 'kof', he: 'קוֹף', en: 'Monkey',
      line: { he: 'הַקּוֹף כְּבָר גָּנַב לְךָ אֶת הַמַּפְתְּחוֹת שֶׁל הַתֵּבָה.',
              en: 'The monkey has already stolen the keys to the ark.' } },

    { key: 'hipo', he: 'הִיפּוֹפּוֹטָם', en: 'Hippo',
      line: { he: 'הַהִיפּוֹפּוֹטָם שׁוֹאֵל אִם יֵשׁ בְּרֵכָה. תִּרְגַּע. יִהְיֶה הַרְבֵּה מַיִם.',
              en: 'The hippo asks if there is a pool. Relax. There is going to be a lot of water.' } },

    { key: 'gamal', he: 'גָּמָל', en: 'Camel',
      line: { he: 'הַגָּמָל מַדְגִּישׁ שֶׁהוּא מַחֲזִיק אַרְבָּעִים יוֹם בְּלִי לִשְׁתּוֹת. זֶה בֶּאֱמֶת לֹא הַבְּעָיָה כָּרֶגַע.',
              en: 'The camel points out he can go forty days without drinking. Truly not the issue right now.' } },

    { key: 'hazir', he: 'חֲזִיר', en: 'Pig',
      line: { he: 'הַחֲזִיר יוֹדֵעַ שֶׁהוּא לֹא טָהוֹר. לָכֵן הוּא בָּא רַק בִּשְׁנַיִם, וְלֹא בְּשִׁבְעָה. הוּא עוֹשֶׂה מִזֶּה עִנְיָן.',
              en: 'The pig knows he is not kosher. That is why he comes in twos and not in sevens. He will not let it go.' } },

    { key: 'pingvin', he: 'פִּינְגְּוִין', en: 'Penguin',
      line: { he: 'הַפִּינְגְּוִין לֹא מֵבִין לָמָּה כֻּלָּם לְחוּצִים. סוֹף סוֹף מֶזֶג אֲוִיר נוֹרְמָלִי.',
              en: 'The penguin does not see the problem. Finally, normal weather.' } },
  ],

  /* animals that wander the valley but are not on the manifest */
  extras: ['tzvi', 'shual', 'arnav', 'tarnegol', 'dov', 'sus', 'shor', 'zeev'],

  secret: {
    key: 'hadkeren',
    he: 'חַד־קֶרֶן', en: 'Unicorn',
    tease: { he: 'מַשֶּׁהוּ לָבָן חָלַף שָׁם בֵּין הָעֵצִים.', en: 'Something white just moved between the trees.' },
    line: { he: 'חַד־קֶרֶן. אַתָּה בָּטוּחַ? ... אַתָּה בֶּאֱמֶת בָּטוּחַ?',
            en: 'A unicorn. Are you sure? ... Are you really sure?' },
    missed: { he: 'הַחַד־קֶרֶן הִגִּיעַ לָרַמְפָּה שְׁתֵּי שְׁנִיּוֹת אַחֲרֵי שֶׁנִּסְגְּרָה. וְזֶה, יְלָדִים, לָמָּה אֵין חַד־קֶרֶן.',
              en: 'The unicorn reached the ramp two seconds after it closed. And that, children, is why there are no unicorns.' },
  },

  /* ─────────────── herding feedback ─────────────── */
  herd: {
    called:   { he: 'הֵן בָּאוֹת אַחֲרֶיךָ!', en: 'They are following you!' },
    full:     { he: 'יוֹתֵר מִדַּי חַיּוֹת בַּטּוּר. תּוֹרִיד אוֹתָן קֹדֶם.', en: 'Your line is full. Drop these off first.' },
    boarded:  { he: 'עָלוּ!', en: 'Aboard!' },
    lonely:   { he: 'זֶה אֶחָד. צָרִיךְ שְׁנַיִם. זָכָר וּנְקֵבָה.', en: 'That is one. You need two. Male and female.' },
    sameSex:  { he: 'שְׁנַיִם — זָכָר וּנְקֵבָה. לֹא שְׁנֵי זְכָרִים שֶׁמִּסְתַּכְּלִים אֶחָד עַל הַשֵּׁנִי.',
                en: 'Two — male and female. Not two males looking at each other.' },
    complete: { he: 'זוּג שָׁלֵם!', en: 'A complete pair!' },
    drowning: { he: 'הַמַּיִם מַגִּיעִים אֵלֶיהָ!', en: 'The water is reaching it!' },
    lost:     { he: 'אִבַּדְתָּ אוֹתָהּ.', en: 'You lost it.' },
  },

  /* ─────────────── villagers ───────────────
   * name is what floats over their head. lines cycle on each E press.
   * `sway` is how close that line brings them to believing you, 0..3.
   */
  villagers: [
    { name: { he: 'יֶתֶר', en: 'Yeter' }, lines: [
      { he: 'גֶּשֶׁם? מָה זֶה גֶּשֶׁם? מֵעוֹלָם לֹא רָאִיתִי גֶּשֶׁם.', en: 'Rain? What is rain? I have never seen rain.', sway: 1 },
      { he: 'אָז מַיִם נוֹפְלִים מִלְמַעְלָה. בְּסֵדֶר. וְלָמָּה שֶׁאֶעֱלֶה לְסִירָה?', en: 'So water falls from above. Fine. And why would I get on a boat?', sway: 2 },
      { he: '...כַּמָּה מָקוֹם אָמַרְתָּ שֶׁיֵּשׁ?', en: '...how much room did you say there was?', sway: 3 },
    ]},
    { name: { he: 'מְשֻׁלָּם', en: 'Meshulam' }, lines: [
      { he: 'מֵאָה וְעֶשְׂרִים שָׁנָה אַתָּה בּוֹנֶה אֶת זֶה. מֵאָה וְעֶשְׂרִים! אֲנִי בָּנִיתִי מִרְפֶּסֶת בִּשְׁבוּעַיִם.', en: 'A hundred and twenty years you have been building this. A hundred and twenty! I built a balcony in two weeks.', sway: 0 },
      { he: 'יֵשׁ לְךָ בִּכְלָל אִשּׁוּר בְּנִיָּה?', en: 'Do you even have a building permit?', sway: 0 },
      { he: 'טוֹב, נָכוֹן, הַשָּׁמַיִם נִרְאִים מוּזָר הַיּוֹם. אֲבָל זֶה לֹא אוֹמֵר כְּלוּם.', en: 'Fine, the sky does look odd today. That means nothing.', sway: 1 },
    ]},
    { name: { he: 'צִלָּה', en: 'Tzilah' }, lines: [
      { he: 'שְׁתֵּי חַיּוֹת מִכָּל מִין? נֹחַ, יֵשׁ לִי אַלֶּרְגְּיָה.', en: 'Two of every animal? Noah, I have allergies.', sway: 1 },
      { he: 'וְאֵיךְ בְּדִיּוּק הַגִּ׳ירָפָה נִכְנֶסֶת?', en: 'And how exactly does the giraffe fit?', sway: 1 },
      { he: 'תִּשְׁמַע, אִם זֶה נָכוֹן — אֲנִי רוֹצָה מָקוֹם לְיַד הַחַלּוֹן.', en: 'Listen, if this is true — I want a seat by the window.', sway: 3 },
    ]},
    { name: { he: 'עִירָד', en: 'Irad' }, lines: [
      { he: 'וְאִם יִהְיֶה מַבּוּל — אֶשְׂחֶה. אֲנִי שׂוֹחֶה מְצֻיָּן.', en: 'And if there is a flood, I will swim. I am an excellent swimmer.', sway: 0 },
      { he: 'אַרְבָּעִים יוֹם? אֲנִי שׂוֹחֶה אַרְבָּעִים יוֹם בְּקַלּוּת.', en: 'Forty days? I can swim forty days easily.', sway: 0 },
      { he: 'שְׁלֹשִׁים יוֹם. סוֹפִי.', en: 'Thirty days. Final offer.', sway: 1 },
    ]},
    { name: { he: 'נַעֲמָה', en: 'Naamah' }, lines: [
      { he: 'אֲנִי לֹא עוֹלָה עַל סִירָה עִם חַלּוֹן אֶחָד. אֶחָד, נֹחַ.', en: 'I am not boarding a boat with one window. One, Noah.', sway: 1 },
      { he: 'וּמִי מְנַקֶּה אַחֲרֵי הַפִּילִים? אָמַרְתִּי מַשֶּׁהוּ.', en: 'And who cleans up after the elephants? I said what I said.', sway: 1 },
      { he: 'טוֹב. אֲבָל אֲנִי יוֹשֶׁבֶת רָחוֹק מֵהַקּוֹפִים.', en: 'Fine. But I am sitting far from the monkeys.', sway: 3 },
    ]},
    { name: { he: 'תּוּבַל', en: 'Tuval' }, lines: [
      { he: 'סָבָא שֶׁלִּי אָמַר לִי: לְעוֹלָם אַל תַּשְׁקִיעַ בְּסִירָה שֶׁל שָׁכֵן.', en: 'My grandfather told me: never invest in a neighbour’s boat.', sway: 0 },
      { he: 'הַמַּבּוּל מַתְחִיל בַּשְּׁלִישִׁי? יֵשׁ לִי חֲתֻנָּה בַּשְּׁלִישִׁי.', en: 'The flood starts Tuesday? I have a wedding Tuesday.', sway: 0 },
      { he: 'בִּטַּלְתִּי אֶת הַחֲתֻנָּה.', en: 'I cancelled the wedding.', sway: 2 },
    ]},
    { name: { he: 'חֲנוֹךְ', en: 'Hanoch' }, lines: [
      { he: 'נֹחַ, אָח שֶׁלִּי, בּוֹא נֵשֵׁב. אַתָּה עוֹבֵד יוֹתֵר מִדַּי.', en: 'Noah, buddy, sit down. You are working too hard.', sway: 1 },
      { he: 'אַתָּה בּוֹנֶה סִירָה. בְּאֶמְצַע הַיַּבָּשָׁה. בְּלִי יָם.', en: 'You are building a boat. In the middle of dry land. With no sea.', sway: 1 },
      { he: 'אוֹקֵיי עַכְשָׁו יֵשׁ יָם. עַכְשָׁו יֵשׁ יָם!', en: 'Okay now there is a sea. NOW THERE IS A SEA!', sway: 3 },
    ]},
  ],

  /* what Noah shouts back */
  preach: [
    { he: 'הַמַּבּוּל בָּא!', en: 'The flood is coming!' },
    { he: 'יֵשׁ מָקוֹם! יֵשׁ הַרְבֵּה מָקוֹם!', en: 'There is room! There is plenty of room!' },
    { he: 'אֲנִי לֹא מְבַקֵּשׁ כֶּסֶף. אֲנִי מְבַקֵּשׁ שֶׁתַּעֲלוּ.', en: 'I am not asking for money. I am asking you to come aboard.' },
    { he: 'תִּסְתַּכְּלוּ עַל הַשָּׁמַיִם. פָּשׁוּט תִּסְתַּכְּלוּ.', en: 'Look at the sky. Just look at it.' },
    { he: 'לֹא אָמַרְתִּי לָכֶם? אָמַרְתִּי לָכֶם מֵאָה וְעֶשְׂרִים שָׁנָה.', en: 'Did I not tell you? I told you for a hundred and twenty years.' },
  ],

  believed: {
    he: 'הוּא הֶאֱמִין לְךָ. אֶחָד. זֶה יוֹתֵר מִמָּה שֶׁקָּרָה בַּמָּקוֹר.',
    en: 'He believed you. One person. That is more than happened in the original.',
  },

  /* ─────────────── flood phases ─────────────── */
  phases: [
    { id: 'calm',  he: 'אַחַר הַצָּהֳרַיִם נָעִים',       en: 'A pleasant afternoon' },
    { id: 'cloud', he: 'מִתְעַנֵּן',                      en: 'Clouding over' },
    { id: 'first', he: 'טִפָּה רִאשׁוֹנָה',               en: 'The first drop' },
    { id: 'rain',  he: 'גֶּשֶׁם',                         en: 'Rain' },
    { id: 'flood', he: 'נִבְקְעוּ כָּל מַעְיְנוֹת תְּהוֹם רַבָּה', en: 'All the fountains of the deep burst open' },
    { id: 'lift',  he: 'וַתָּרָם הַתֵּבָה',                en: 'And the ark was lifted up' },
  ],

  phaseShout: {
    cloud: { he: 'הַשָּׁמַיִם מִתְעַנְּנִים. עַכְשָׁו כֻּלָּם מִסְתַּכְּלִים לְמַעְלָה.', en: 'The sky is clouding over. Now everyone looks up.' },
    first: { he: 'טִפָּה אַחַת נָפְלָה. יֶתֶר אָמַר שֶׁזֹּאת צִפּוֹר.', en: 'One drop fell. Yeter said it was a bird.' },
    rain:  { he: 'זֶה לֹא צִפּוֹר.', en: 'It is not a bird.' },
    flood: { he: 'הַמַּיִם עוֹלִים. תָּרוּץ.', en: 'The water is rising. Run.' },
    lift:  { he: 'הַתֵּבָה מִתְרוֹמֶמֶת.', en: 'The ark is lifting.' },
  },

  /* ─────────────── endings ─────────────── */
  endings: {
    perfect: {
      title: { he: 'צַדִּיק תָּמִים', en: 'Righteous and Whole' },
      body: { he: 'כָּל הַזּוּגוֹת עָלוּ. הַדֶּלֶת נִסְגְּרָה. בַּחוּץ הָיָה שָׁקֵט מְאוֹד.',
              en: 'Every pair aboard. The door closed. Outside it was very quiet.' },
    },
    good: {
      title: { he: 'נֹחַ מָצָא חֵן', en: 'Noah Found Favour' },
      body: { he: 'רֹב הַחַיּוֹת עָלוּ. הַשְּׁאָר... נִשְׁאֲרוּ. אַל תַּחְשֹׁב עַל זֶה יוֹתֵר מִדַּי.',
              en: 'Most of the animals made it. The rest... did not. Try not to dwell on it.' },
    },
    poor: {
      title: { he: 'הִתְחָלָה צְנוּעָה', en: 'A Modest Beginning' },
      body: { he: 'הַתֵּבָה צָפָה. הִיא דֵּי רֵיקָה. הָעוֹלָם הַבָּא יִהְיֶה שֶׁקֶט בְּאֹפֶן מַפְתִּיעַ.',
              en: 'The ark floats. It is quite empty. The next world is going to be surprisingly quiet.' },
    },
    stats: {
      pairs:    { he: 'זוּגוֹת שֶׁעָלוּ', en: 'Pairs aboard' },
      animals:  { he: 'חַיּוֹת', en: 'Animals' },
      believed: { he: 'אֲנָשִׁים שֶׁהֶאֱמִינוּ לְךָ', en: 'People who believed you' },
      believedNote: { he: '(בַּמָּקוֹר: אֶפֶס)', en: '(in the original: zero)' },
      secret:   { he: 'חַד־קֶרֶן', en: 'Unicorn' },
      yes: { he: 'כֵּן', en: 'Yes' },
      no:  { he: 'לֹא', en: 'No' },
      time: { he: 'נִשְׁאֲרוּ', en: 'Time left' },
    },
    again: { he: 'עוֹד פַּעַם', en: 'Again' },
  },

  outro: [
    { he: 'וַיִּזְכֹּר אֱלֹהִים אֶת נֹחַ וְאֵת כָּל הַחַיָּה וְאֶת כָּל הַבְּהֵמָה אֲשֶׁר אִתּוֹ בַּתֵּבָה.', en: 'And God remembered Noah, and every living thing, and all the cattle that were with him in the ark.', ref: 'בראשית ח׳:א׳', dwell: 4600 },
    { he: 'אֶת קַשְׁתִּי נָתַתִּי בֶּעָנָן.', en: 'I have set my bow in the cloud.', ref: 'בראשית ט׳:י״ג', dwell: 4000 },
  ],

  tips: [
    { he: 'תְּקַע בַּשּׁוֹפָר לְיַד חַיָּה — הִיא תֵּלֵךְ אַחֲרֶיךָ.', en: 'Blow the shofar near an animal and it will follow you.' },
    { he: 'אַתָּה יָכוֹל לְהוֹבִיל אַרְבַּע חַיּוֹת בְּבַת אַחַת.', en: 'You can lead four animals at a time.' },
    { he: 'חַיּוֹת שֶׁהַמַּיִם מַגִּיעִים אֲלֵיהֶן נִבְהָלוֹת וּבוֹרְחוֹת לְמַעְלָה.', en: 'Animals panic as the water reaches them and flee uphill.' },
    { he: 'כָּל אָדָם שֶׁתְּשַׁכְנֵעַ מַרְחִיב לְךָ אֶת טְוַח הַשּׁוֹפָר.', en: 'Every person you convince widens your shofar’s range.' },
    { he: 'צָרִיךְ זָכָר וּנְקֵבָה. שְׁנֵי זְכָרִים זֶה לֹא זוּג.', en: 'You need male and female. Two males is not a pair.' },
  ],
});

export default T;
