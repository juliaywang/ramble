import type { QuestTemplate } from "./types";

export const QUEST_TEMPLATES: QuestTemplate[] = [
  {
    id: "quest-ingredient",
    discoveryId: "greenmarket",
    title: "One ingredient you can't name",
    objective:
      "Walk the Columbia Greenmarket and buy one ingredient you have never cooked with. Ask the farmer how they would eat it this week.",
    visitMinutes: 30,
    xp: 50,
  },
  {
    id: "quest-pantry",
    discoveryId: "ford-hall",
    title: "Bring something eligible",
    objective:
      "Stop at Ford Hall and ask what donation they can take today — often shelf-stable food, clothing, or housewares. Bring one eligible item, or sign the next volunteer sheet if you came empty-handed.",
    visitMinutes: 25,
    xp: 70,
  },
  {
    id: "quest-owl",
    discoveryId: "alma-mater",
    title: "The owl in the robe",
    objective:
      "Stand on the Low steps, find the owl tucked into Alma Mater's robe, and read the inscription on the base before you take a photo.",
    visitMinutes: 15,
    xp: 30,
  },
  {
    id: "quest-giraffes",
    discoveryId: "peace-fountain",
    title: "Count the giraffes",
    objective:
      "Find the Peace Fountain and count the giraffes. Then walk the rim of children's sculptures and read one plaque you did not expect — Gandhi, Einstein, and a line from Lennon are all in the mix.",
    visitMinutes: 20,
    xp: 35,
  },
  {
    id: "quest-rules",
    discoveryId: "hex",
    title: "Learn a game you didn't bring",
    objective:
      "Go to Hex & Co. and ask someone to teach you the rules of one short game. Play a round if a table will have you. Leave the three-hour boxes for another day.",
    visitMinutes: 50,
    xp: 45,
  },
  {
    id: "quest-no-wifi",
    discoveryId: "hungarian",
    title: "Coffee with no Wi-Fi",
    objective:
      "Order a coffee at the Hungarian Pastry Shop and leave your laptop in your bag. Stay long enough to read the authors' wall and notice the cathedral across the street.",
    visitMinutes: 35,
    xp: 30,
  },
  {
    id: "quest-other-cafe",
    discoveryId: "max-caffe",
    title: "A café that isn't the famous one",
    objective:
      "Skip the pastry shop for one visit. Get something small at Max Caffé on Amsterdam and stay long enough to notice who treats it as a living room.",
    visitMinutes: 30,
    xp: 30,
  },
  {
    id: "quest-not-assigned",
    discoveryId: "book-culture",
    title: "Something that isn't assigned",
    objective:
      "Ask a bookseller at Book Culture for a book that is not on a syllabus. Leave with a title you can explain in one sentence, even if you only write the sentence in your notes.",
    visitMinutes: 25,
    xp: 40,
  },
  {
    id: "quest-sky",
    discoveryId: "roerich",
    title: "A free museum of mountains",
    objective:
      "Walk down to the Nicholas Roerich Museum — admission is free — and find a painting where the sky is doing more work than the mountains. Note the color.",
    visitMinutes: 35,
    xp: 50,
  },
  {
    id: "quest-program",
    discoveryId: "miller",
    title: "One piece on this week's program",
    objective:
      "Stop at Miller Theatre and write down one piece on this week's program. If the lobby is closed, the poster outside still counts. Read the note, not just the title.",
    visitMinutes: 20,
    xp: 40,
  },
  {
    id: "quest-chapel",
    discoveryId: "postcrypt",
    title: "Under the chapel",
    objective:
      "Find out who is playing at Postcrypt. If it is a Friday or Saturday night during the term, stay for one set. If not, put the next date somewhere you will actually see it.",
    visitMinutes: 25,
    xp: 45,
  },
  {
    id: "quest-chickens",
    discoveryId: "gatehouse",
    title: "Ask about the chickens",
    objective:
      "Visit Gatehouse Garden during posted open hours and ask one question about the chickens or the compost. If the gate is locked, read the board and come back on a listed afternoon.",
    visitMinutes: 25,
    xp: 55,
  },
  {
    id: "quest-hold",
    discoveryId: "nypl",
    title: "The shelf you walk past",
    objective:
      "Leave the Morningside Heights Library with a book you would not have searched for. A staff pick counts. If you already have a hold waiting, that is not this quest.",
    visitMinutes: 25,
    xp: 30,
  },
  {
    id: "quest-carillon",
    discoveryId: "riverside-church",
    title: "The tower and the bulletin",
    objective:
      "Walk to Riverside Church, find the carillon tower, and read one public program posted for the week — a concert, a meal, or a meeting. The tower alone is only half the stop.",
    visitMinutes: 25,
    xp: 35,
  },
  {
    id: "quest-lion",
    discoveryId: "scholars-lion",
    title: "The other bronze animal",
    objective:
      "Find the Scholar's Lion by the 116th Street gate and read the plaque. Then walk to Alma Mater and name one way the two sculptures treat an animal differently.",
    visitMinutes: 15,
    xp: 25,
  },
  {
    id: "quest-waterfall",
    discoveryId: "morningside-park",
    title: "Down the stairs, not the overlook",
    objective:
      "Enter Morningside Park by a staircase, walk to the waterfall, and name three plants you can actually see. The cliff edge on Morningside Drive is the view, not the park.",
    visitMinutes: 30,
    xp: 35,
  },
  {
    id: "quest-sounds",
    discoveryId: "riverside-park",
    title: "Three sounds by the Hudson",
    objective:
      "Walk west to the overlook in Riverside Park and stay until you can name three separate sounds that are not traffic. Then decide whether to keep going north.",
    visitMinutes: 20,
    xp: 30,
  },
  {
    id: "quest-counter",
    discoveryId: "toms",
    title: "Ignore the sign",
    objective:
      "Eat one thing at Tom's Restaurant that you did not order because of the red sign. Sit at the counter if there is a seat.",
    visitMinutes: 35,
    xp: 30,
  },
  {
    id: "quest-maker",
    discoveryId: "purple-waves",
    title: "A maker you can't name yet",
    objective:
      "Stop at Purple Waves and find one product from a maker you have never heard of. Ask where it was grown or made, and remember the answer.",
    visitMinutes: 25,
    xp: 40,
  },
  {
    id: "quest-blossoms",
    discoveryId: "sakura",
    title: "The park between the towers",
    objective:
      "Sit in Sakura Park long enough to find the cherry trees even if they are not in bloom, and read one plaque about how the park got here.",
    visitMinutes: 15,
    xp: 25,
  },
];
