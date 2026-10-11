/** Learn-as-you-watch glossary (Easy mode). Every term in one line,
 *  EN + Hinglish. Static copy — no AI needed. */

export type GlossaryTerm = { term: string; en: string; hi: string };

export const GLOSSARY: GlossaryTerm[] = [
  {
    term: "DRS",
    en: "A flap on the rear wing that opens on straights to give the chasing car extra speed for a pass.",
    hi: "Ek flap jo peeche wali car ko straight pe extra speed deta hai, taaki wo pass kar sake.",
  },
  {
    term: "Pit stop",
    en: "The car stops in the pit lane to change tyres. Costs time now to gain speed later.",
    hi: "Gaadi tyres badalne ke liye pit lane mein rukti hai. Abhi time kharch, baad mein speed ka fayda.",
  },
  {
    term: "Undercut",
    en: "Pitting early for fresh tyres to set fast laps and jump ahead when a rival pits later.",
    hi: "Jaldi pit karke fresh tyres par tez laps maarna, taaki rival ke pit ke baad usse aage nikal jao.",
  },
  {
    term: "Gap",
    en: "The time between two cars on track, in seconds. Under a second usually means a fight is coming.",
    hi: "Do gaadiyon ke beech ka time antar, seconds mein. Ek second se kam ka matlab battle hone wali hai.",
  },
  {
    term: "Safety car",
    en: "A pace car that bunches up the field after a crash, wiping out gaps between cars.",
    hi: "Crash ke baad aane wali pace car jo saari gaadiyon ko paas la deti hai aur gaps mita deti hai.",
  },
  {
    term: "Fastest lap",
    en: "The quickest single lap of the race. Worth watching — it shows who has real pace.",
    hi: "Race ka sabse tez single lap. Isse pata chalta hai kiske paas asli pace hai.",
  },
  {
    term: "Tyre age",
    en: "How many laps a tyre has done. Older tyres are slower — fresh rubber is a big advantage.",
    hi: "Tyre ne kitne laps kiye hain. Purane tyres slow hote hain — fresh tyres bada fayda dete hain.",
  },
  {
    term: "Overtake",
    en: "One car passing another on track to take its position.",
    hi: "Track par ek gaadi ka doosri ko pass karke uski position lena.",
  },
];
