import type { Knot } from './types'

// Ported verbatim from the pre-refactor prototype. Path data and step text
// preserved. Spec §20 requires per-knot mechanical validation before v1.3
// is called complete — that lives in Milestone G. Do not adjust paths here
// without a validated reference source.
const RAW: Array<[string, string, string, string, string[], string[], [string, string]]> = [
  [
    'Achtknoten',
    'Figure-eight knot',
    'Verhindert das Ausrauschen eines Endes durch einen Block, eine Öse oder einen Beschlag.',
    'A stopper knot that prevents a line end running out through a block, eye or fitting.',
    [
      'Eine Bucht mit dem losen Ende bilden.',
      'Das lose Ende um den stehenden Part herumführen.',
      'Das lose Ende durch die zuerst gebildete Bucht zurückstecken.',
      'Festziehen; die fertige Form sieht wie eine Acht aus.',
    ],
    [
      'Form a loop with the working end.',
      'Pass the working end around the standing part.',
      'Feed it back through the original loop.',
      'Dress and tighten; the finished knot resembles a figure eight.',
    ],
    [
      'M35 155 C90 70 155 65 205 120 C245 165 210 220 155 200 C105 180 100 115 150 95 C205 72 265 105 330 170',
      'M35 155 C90 70 155 65 205 120 C245 165 210 220 155 200',
    ],
  ],
  [
    'Kreuzknoten',
    'Reef / square knot',
    'Verbindet zwei gleich starke Enden desselben Tauwerks, z. B. beim Reffen oder Zusammenbinden.',
    'Joins two ends of similar rope, e.g. reefing or bundling.',
    [
      'Rechtes Ende über das linke legen und darunter durchführen.',
      'Linkes Ende über das rechte legen.',
      'Wieder darunter durchführen.',
      'Beide stehenden Parts gleichmäßig festziehen.',
    ],
    [
      'Pass right end over left and tuck under.',
      'Pass left end over right.',
      'Tuck it under again.',
      'Pull both standing parts evenly.',
    ],
    [
      'M35 85 C110 85 145 170 220 170 C275 170 305 125 345 85 M35 170 C105 170 150 85 220 85 C275 85 310 130 345 170',
      'M35 85 C110 85 145 170 220 170',
    ],
  ],
  [
    'Palstek',
    'Bowline',
    'Erzeugt ein festes Auge, das sich unter Belastung nicht zuzieht; z. B. zum Festmachen über Poller oder Pfahl.',
    'Creates a fixed loop that does not tighten under load; e.g. over a bollard or post.',
    [
      'Eine kleine Bucht in den stehenden Part legen.',
      'Loses Ende von unten durch die Bucht führen.',
      'Um den stehenden Part herumführen.',
      'Loses Ende wieder durch die Bucht zurückführen und festziehen.',
    ],
    [
      'Make a small loop in the standing part.',
      'Bring the working end up through the loop.',
      'Pass it around the standing part.',
      'Bring it back through the loop and tighten.',
    ],
    [
      'M35 190 C90 190 115 155 110 110 C105 65 160 55 185 90 C205 120 180 145 145 140 C105 135 110 95 150 95 C205 95 235 150 335 185',
      'M35 190 C90 190 115 155 110 110 C105 65 160 55 185 90',
    ],
  ],
  [
    'Einfacher / doppelter Schotstek',
    'Single / double sheet bend',
    'Verbindet zwei ungleich starke oder verschiedenartige Leinen; doppelt für mehr Halt.',
    'Joins two ropes of unequal diameter/type; the double version gives extra security.',
    [
      'Mit der stärkeren Leine eine Bucht bilden.',
      'Dünnere Leine von unten durch die Bucht führen.',
      'Um beide Parts der Bucht herumführen.',
      'Unter dem eigenen Part durchstecken; doppelt: vorher ein zweites Mal herumführen.',
    ],
    [
      'Form a bight in the thicker rope.',
      'Pass the thinner rope up through it.',
      'Take it around both legs.',
      'Tuck under its own part; double: make a second turn first.',
    ],
    [
      'M45 85 C95 45 150 55 150 110 C150 165 95 175 45 135 C95 175 175 190 230 145 C265 115 250 80 215 82 C185 84 175 112 205 125 C245 143 290 125 340 90',
      'M45 85 C95 45 150 55 150 110 C150 165 95 175 45 135',
    ],
  ],
  [
    'Stopperstek',
    'Rolling hitch',
    'Befestigt eine Leine an einer anderen und hält bei Zug in einer Richtung; z. B. zum Entlasten einer belasteten Leine.',
    'Attaches to another line and grips against pull in one direction; useful to take strain off a loaded line.',
    [
      'Loses Ende um die zu greifende Leine legen.',
      'In Zugrichtung zwei eng anliegende Törns machen.',
      'Einen weiteren Törn auf der anderen Seite legen.',
      'Mit einem halben Schlag abschließen und festziehen.',
    ],
    [
      'Wrap around the line to be gripped.',
      'Make two close turns toward the pull.',
      'Make another turn on the opposite side.',
      'Finish with a half hitch and tighten.',
    ],
    [
      'M30 135 C110 135 145 135 350 135 M90 200 C125 175 125 95 175 92 C220 90 230 180 185 190 C145 198 135 150 175 135 C215 120 250 105 300 75',
      'M30 135 C110 135 145 135 350 135',
    ],
  ],
  [
    'Webleinstek',
    'Clove hitch',
    'Zum schnellen Befestigen an Pfahl, Reling o. Ä.; typisch zum Befestigen von Fendern.',
    'Quick fastening to a post or rail; commonly used for fenders.',
    [
      'Einmal um den Gegenstand führen.',
      'Kreuzen und ein zweites Mal herumführen.',
      'Loses Ende unter dem letzten Kreuzungsteil durchstecken.',
      'Festziehen.',
    ],
    [
      'Take one turn around the object.',
      'Cross and take a second turn.',
      'Tuck the working end under the last crossing.',
      'Tighten.',
    ],
    [
      'M45 190 C75 150 85 95 130 80 C175 65 205 105 190 135 C175 165 125 155 120 120 C115 85 165 72 210 105 C250 135 280 165 340 180',
      'M45 190 C75 150 85 95 130 80',
    ],
  ],
  [
    'Webleinstek auf Slip',
    'Slipped clove hitch',
    'Wie der Webleinstek, aber durch die Slip-Bucht schnell lösbar.',
    'Like a clove hitch, but with a slipped bight for rapid release.',
    [
      'Webleinstek beginnen.',
      'Beim letzten Durchstecken nicht das ganze Ende durchziehen.',
      'Eine Bucht als Slip durchstecken.',
      'An der Bucht festziehen; am freien Ende lösen.',
    ],
    [
      'Begin a normal clove hitch.',
      'Do not pull the whole end through at the final tuck.',
      'Push a bight through as the slip.',
      'Tighten the bight; pull the free end to release.',
    ],
    [
      'M45 190 C75 150 85 95 130 80 C175 65 205 105 190 135 C175 165 125 155 120 120 C115 85 165 72 210 105 C245 132 255 160 230 180 C215 192 205 178 220 165 C245 145 285 165 340 190',
      'M45 190 C75 150 85 95 130 80',
    ],
  ],
  [
    'Rundtörn mit zwei halben Schlägen',
    'Round turn and two half hitches',
    'Zum sicheren Festmachen an Ring, Pfahl oder Stange; der Rundtörn nimmt zunächst Last auf.',
    'Secure fastening to a ring, post or rail; the round turn initially takes the load.',
    [
      'Einen vollständigen Rundtörn um Ring/Pfahl legen.',
      'Loses Ende um den stehenden Part führen.',
      'Ersten halben Schlag bilden.',
      'Zweiten halben Schlag in gleicher Richtung setzen.',
    ],
    [
      'Make a full round turn around the ring/post.',
      'Pass the working end around the standing part.',
      'Make the first half hitch.',
      'Make a second half hitch in the same direction.',
    ],
    [
      'M55 190 C75 120 75 65 125 65 C170 65 170 120 125 120 C80 120 80 70 125 70 C185 70 210 180 270 180 C320 180 330 140 300 125 C270 110 245 135 260 155 C275 175 315 165 345 145',
      'M55 190 C75 120 75 65 125 65 C170 65 170 120 125 120',
    ],
  ],
  [
    'Belegen einer Klampe mit Kopfschlag',
    'Cleat hitch with locking turn',
    'Zum Belegen einer Festmacherleine auf einer Klampe, z. B. beim Anlegen.',
    'Secures a mooring line to a cleat, e.g. when alongside.',
    [
      'Leine zuerst um den weiter entfernten Klampefuß führen.',
      'Kreuztouren in Achterform über die Hörner legen.',
      'Beim letzten Törn eine Bucht für den Kopfschlag drehen.',
      'Bucht über das Horn legen und festziehen.',
    ],
    [
      'Lead around the far horn/base first.',
      'Make figure-eight turns over the horns.',
      'Twist a bight for the locking turn.',
      'Place it over the horn and tighten.',
    ],
    [
      'M40 170 C95 170 105 70 160 70 C210 70 220 170 275 170 C320 170 335 125 350 95 M40 205 C105 205 105 105 160 105 C215 105 220 205 285 205',
      'M40 170 C95 170 105 70 160 70',
    ],
  ],
]

export const KNOTS: readonly Knot[] = RAW.map((r, i) => ({
  id: i + 1,
  de: { name: r[0], use: r[2], steps: r[4], examSentence: r[2] },
  en: { name: r[1], use: r[3], steps: r[5], examSentence: r[3] },
  svg: { ghostPath: r[6][0], ropePath: r[6][1] },
}))
