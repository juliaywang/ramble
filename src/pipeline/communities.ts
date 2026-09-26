import type { Community } from "./types";

export const COMMUNITIES: Community[] = [
  {
    id: "community-impact",
    name: "Community Impact",
    kind: "Volunteer organization",
    where: "Ford Hall, 616 West 114th Street",
    tags: ["volunteering", "food", "sustainability"],
    pitch:
      "Columbia's largest student-run service group. Pantry shifts are short, neighborhood-facing, and how a lot of people actually meet each other off the group chat.",
    about:
      "The easiest door is Ford Hall: three middays a week, fresh food, dry goods, and a clothes closet. You can bring a donation without a campus ID. Longer volunteer roles — tutoring, food runs, shifts — are how regulars get to know each other. Call ahead before you arrive with a group.",
    discoveryId: "ford-hall",
  },
  {
    id: "postcrypt-collective",
    name: "Postcrypt Coffeehouse",
    kind: "Student music community",
    where: "St. Paul's Chapel basement",
    tags: ["music", "coffee", "culture"],
    pitch:
      "A student-run room under the chapel. If music is an interest, Friday nights are how this neighborhood hangs out without a cover charge.",
    about:
      "Acoustic sets, coffee, and a bill booked by students. Showing up is the membership. If you want to do more than listen, the people at the door can tell you how the collective staffs a night.",
    discoveryId: "postcrypt",
  },
  {
    id: "hex-play",
    name: "Hex & Co. open play",
    kind: "Game community",
    where: "2911 Broadway",
    tags: ["gaming", "coffee", "technology"],
    pitch:
      "Open tables, taught rules, and a calendar of Commander, D&D, and league nights. You can arrive without a group.",
    about:
      "The café is the clubhouse. Daytime is for learning a short game. Evenings are when the same tables turn into a weekly community. Tell them how long you have and they will not hand you a campaign.",
    discoveryId: "hex",
  },
  {
    id: "gatehouse-volunteers",
    name: "Gatehouse Garden",
    kind: "Garden volunteers",
    where: "1195 Amsterdam Avenue",
    tags: ["sustainability", "food", "volunteering"],
    pitch:
      "Neighbors who keep a GreenThumb garden going: beds, compost, pollinators, and chickens. Open hours are when the people are actually there.",
    about:
      "This is a work garden, not a backdrop. Saturday and Sunday mornings and Wednesday afternoons in season are the times to introduce yourself. Winter is mostly a locked gate and a sign, which is its own kind of honesty.",
    discoveryId: "gatehouse",
  },
  {
    id: "wkcr",
    name: "WKCR 89.9 FM",
    kind: "Student radio",
    where: "On campus · 89.9 FM",
    tags: ["music", "technology", "culture"],
    pitch:
      "Columbia's student station. If you care about music or technology, the way in is a training shift, not a follower count.",
    about:
      "WKCR has been on the air with jazz, new music, and news for decades, staffed by students who learn the board before they learn the brand. Listening is free. Joining means showing up for training and a shift.",
  },
  {
    id: "cathedral-cares",
    name: "Cathedral Community Cares",
    kind: "Cultural & volunteer community",
    where: "Cathedral of St. John the Divine",
    tags: ["volunteering", "culture", "history"],
    pitch:
      "The cathedral's community programs sit beside the stonework: meals, clothing, and volunteer roles that belong to the neighborhood, not only the nave.",
    about:
      "St. John's is a building and a set of rooms where people organize. If history brought you to the unfinished tower, the bulletin is how you stay. Ask what is open to non-parishioners before you promise a shift.",
    discoveryId: "cathedral",
  },
  {
    id: "miller-audience",
    name: "Miller Theatre",
    kind: "Music community",
    where: "2960 Broadway",
    tags: ["music", "culture"],
    pitch:
      "A contemporary-music hall with a real audience, not a background playlist. The regulars are the people who read the program notes.",
    about:
      "You do not need to perform to belong here. Buy a ticket, or start by learning one piece on this week's poster. Ushers and front-of-house are the student-facing way further in.",
    discoveryId: "miller",
  },
  {
    id: "roerich-rooms",
    name: "Nicholas Roerich Museum",
    kind: "Art community",
    where: "319 West 107th Street",
    tags: ["art", "culture", "history"],
    pitch:
      "A free museum in a townhouse. Small enough that people who come back get recognized, which is a rare thing above 96th Street.",
    about:
      "The paintings are Himalayan and the rooms are domestic. Admission is free, so the barrier is the walk down to 107th, not a ticket. Go alone the first time. The person at the door is part of the visit.",
    discoveryId: "roerich",
  },
  {
    id: "greenmarket-regulars",
    name: "Columbia Greenmarket",
    kind: "Food & sustainability",
    where: "Broadway between 114th and 116th",
    tags: ["food", "sustainability"],
    pitch:
      "Farmers, neighbors, and the Thursday campus rush. The people who shop the same stand every week are a community whether they call it one or not.",
    about:
      "Twice a week, year-round. If you want more than a tomato, the information tent posts cooking demos and ways to help the market. Learning one farmer's name is the whole membership requirement.",
    discoveryId: "greenmarket",
  },
  {
    id: "riverside-ministries",
    name: "Riverside social justice ministries",
    kind: "Cultural organization",
    where: "490 Riverside Drive",
    tags: ["culture", "volunteering", "music"],
    pitch:
      "A church that posts concerts, meals, and organizing on the same board. Useful if culture and volunteering are the same interest for you.",
    about:
      "The tower is what you see from the park. The ministries are why people who are not members still know the building. Read the week’s board, then pick one event that is not a tour.",
    discoveryId: "riverside-church",
  },
];
