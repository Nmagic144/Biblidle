// Daily verse pool (King James Version, public domain).
// Sections ("chunks") of the Bible, in canonical order.
const CHUNKS = [
  { id: "law", label: "Old Testament: Law", end: 5 },
  { id: "history", label: "Old Testament: History", end: 17 },
  { id: "wisdom", label: "Old Testament: Wisdom & Poetry", end: 22 },
  { id: "major", label: "Old Testament: Major Prophets", end: 27 },
  { id: "minor", label: "Old Testament: Minor Prophets", end: 39 },
  { id: "gospels", label: "New Testament: Gospels & Acts", end: 44 },
  { id: "paul", label: "New Testament: Paul's Letters", end: 57 },
  { id: "general", label: "New Testament: General Letters & Revelation", end: 66 },
];
function chunkOf(i) { return CHUNKS.find((c) => i < c.end).id; }

const BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
  "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
  "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah",
  "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians",
  "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians",
  "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
].map((name, i) => ({ name, idx: i, testament: i < 39 ? "OT" : "NT", chunk: chunkOf(i) }));

const VERSES = [
  { book: "Genesis", ch: 1, v: 1, text: "In the beginning God created the heaven and the earth." },
  { book: "Genesis", ch: 1, v: 27, text: "So God created man in his own image, in the image of God created he him; male and female created he them." },
  { book: "Exodus", ch: 20, v: 3, text: "Thou shalt have no other gods before me." },
  { book: "Deuteronomy", ch: 31, v: 6, text: "Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee." },
  { book: "Joshua", ch: 1, v: 9, text: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest." },
  { book: "Psalms", ch: 23, v: 1, text: "The LORD is my shepherd; I shall not want." },
  { book: "Psalms", ch: 27, v: 1, text: "The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?" },
  { book: "Psalms", ch: 34, v: 8, text: "O taste and see that the LORD is good: blessed is the man that trusteth in him." },
  { book: "Psalms", ch: 46, v: 1, text: "God is our refuge and strength, a very present help in trouble." },
  { book: "Psalms", ch: 119, v: 105, text: "Thy word is a lamp unto my feet, and a light unto my path." },
  { book: "Psalms", ch: 118, v: 24, text: "This is the day which the LORD hath made; we will rejoice and be glad in it." },
  { book: "Psalms", ch: 91, v: 1, text: "He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty." },
  { book: "Psalms", ch: 19, v: 1, text: "The heavens declare the glory of God; and the firmament sheweth his handywork." },
  { book: "Proverbs", ch: 3, v: 5, text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding." },
  { book: "Proverbs", ch: 3, v: 6, text: "In all thy ways acknowledge him, and he shall direct thy paths." },
  { book: "Ecclesiastes", ch: 3, v: 1, text: "To every thing there is a season, and a time to every purpose under the heaven:" },
  { book: "Isaiah", ch: 40, v: 31, text: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint." },
  { book: "Isaiah", ch: 41, v: 10, text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness." },
  { book: "Jeremiah", ch: 29, v: 11, text: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end." },
  { book: "Micah", ch: 6, v: 8, text: "He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?" },
  { book: "Matthew", ch: 5, v: 14, text: "Ye are the light of the world. A city that is set on an hill cannot be hid." },
  { book: "Matthew", ch: 6, v: 33, text: "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you." },
  { book: "Matthew", ch: 7, v: 7, text: "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:" },
  { book: "Matthew", ch: 11, v: 28, text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest." },
  { book: "Matthew", ch: 19, v: 26, text: "But Jesus beheld them, and said unto them, With men this is impossible; but with God all things are possible." },
  { book: "Matthew", ch: 28, v: 19, text: "Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost:" },
  { book: "Mark", ch: 12, v: 31, text: "And the second is like, namely this, Thou shalt love thy neighbour as thyself. There is none other commandment greater than these." },
  { book: "Luke", ch: 2, v: 11, text: "For unto you is born this day in the city of David a Saviour, which is Christ the Lord." },
  { book: "Luke", ch: 6, v: 31, text: "And as ye would that men should do to you, do ye also to them likewise." },
  { book: "John", ch: 1, v: 1, text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
  { book: "John", ch: 3, v: 16, text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." },
  { book: "John", ch: 8, v: 12, text: "Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life." },
  { book: "John", ch: 8, v: 32, text: "And ye shall know the truth, and the truth shall make you free." },
  { book: "John", ch: 11, v: 35, text: "Jesus wept." },
  { book: "John", ch: 14, v: 6, text: "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me." },
  { book: "John", ch: 15, v: 13, text: "Greater love hath no man than this, that a man lay down his life for his friends." },
  { book: "Romans", ch: 3, v: 23, text: "For all have sinned, and come short of the glory of God;" },
  { book: "Romans", ch: 6, v: 23, text: "For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord." },
  { book: "Romans", ch: 8, v: 28, text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose." },
  { book: "Romans", ch: 12, v: 2, text: "And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God." },
  { book: "1 Corinthians", ch: 13, v: 4, text: "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up," },
  { book: "1 Corinthians", ch: 13, v: 13, text: "And now abideth faith, hope, charity, these three; but the greatest of these is charity." },
  { book: "2 Corinthians", ch: 5, v: 17, text: "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new." },
  { book: "Galatians", ch: 5, v: 22, text: "But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith," },
  { book: "Ephesians", ch: 2, v: 8, text: "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:" },
  { book: "Philippians", ch: 4, v: 6, text: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God." },
  { book: "Philippians", ch: 4, v: 13, text: "I can do all things through Christ which strengtheneth me." },
  { book: "Colossians", ch: 3, v: 23, text: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men;" },
  { book: "1 Thessalonians", ch: 5, v: 17, text: "Pray without ceasing." },
  { book: "2 Timothy", ch: 1, v: 7, text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind." },
  { book: "Hebrews", ch: 11, v: 1, text: "Now faith is the substance of things hoped for, the evidence of things not seen." },
  { book: "James", ch: 1, v: 5, text: "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him." },
  { book: "1 Peter", ch: 5, v: 7, text: "Casting all your care upon him; for he careth for you." },
  { book: "1 John", ch: 4, v: 8, text: "He that loveth not knoweth not God; for God is love." },
  { book: "Revelation", ch: 3, v: 20, text: "Behold, I stand at the door, and knock: if any man hear my voice, and open the door, I will come in to him, and will sup with him, and he with me." },
  { book: "Revelation", ch: 21, v: 4, text: "And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away." },
];

// ---- daily verse selection (shared by the browser and the leaderboard server) ----
const EPOCH_UTC = Date.UTC(2026, 9, 5); // puzzle #1 is 5 Oct 2026

// Fixed-seed shuffle so the order is the same for everyone and never repeats within a cycle.
function shuffledIndexes(n) {
  let seed = 912;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dailyAnswer(dayNumber) {
  const order = shuffledIndexes(VERSES.length);
  return VERSES[order[((dayNumber % order.length) + order.length) % order.length]];
}

if (typeof module !== "undefined") module.exports = { BOOKS, VERSES, EPOCH_UTC, dailyAnswer };
