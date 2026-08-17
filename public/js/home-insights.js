const benefitContent = {
  stress: {
    icon: "~",
    title: "Make space to decompress",
    copy: "Stepping away from familiar routines can create breathing room, support rest, and help everyday tension feel more manageable.",
  },
  creativity: {
    icon: "✦",
    title: "Invite fresh ideas",
    copy: "New surroundings, cultures, and ways of living can challenge familiar thinking and encourage more flexible, creative perspectives.",
  },
  immunity: {
    icon: "+",
    title: "Support healthy routines",
    copy: "Active days, restorative sleep, time outdoors, and varied experiences can reinforce the everyday habits that support general well-being.",
  },
  heart: {
    icon: "♥",
    title: "Keep gently active",
    copy: "Walking tours, nature routes, and unhurried city exploration can add enjoyable movement to a trip and support cardiovascular fitness.",
  },
};

const featuredJourneys = [
  {
    code: "BKK",
    season: "Upcoming · Cool season",
    title: "Bangkok in four thoughtful days",
    copy: "A balanced route through riverside landmarks, neighbourhood food, temples, and quieter creative spaces.",
    meta: ["4 days", "Culture & food", "From ฿30,000"],
    destination: "Bangkok",
  },
  {
    code: "RGN",
    season: "Destination highlight · Heritage",
    title: "Yangon through stories and streets",
    copy: "Golden landmarks, local markets, colonial-era streets, and community-led insights shaped into a calm city plan.",
    meta: ["3 days", "History & culture", "Easy pace"],
    destination: "Yangon",
  },
  {
    code: "SEL",
    season: "Upcoming · Autumn colour",
    title: "Seoul, old and new",
    copy: "Palace mornings, design districts, memorable food, and hillside views arranged into an energetic five-day route.",
    meta: ["5 days", "Design & food", "City energy"],
    destination: "Seoul",
  },
];

const benefitTabs = [...document.querySelectorAll("[data-benefit]")];
const journeyButtons = [...document.querySelectorAll("[data-journey-direction]")];
let activeJourney = 0;

function showBenefit(key) {
  const benefit = benefitContent[key];
  if (!benefit) return;

  document.querySelector("#benefit-icon").textContent = benefit.icon;
  document.querySelector("#benefit-title").textContent = benefit.title;
  document.querySelector("#benefit-copy").textContent = benefit.copy;

  for (const tab of benefitTabs) {
    const isActive = tab.dataset.benefit === key;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-pressed", String(isActive));
  }
}

function showJourney(index) {
  activeJourney = (index + featuredJourneys.length) % featuredJourneys.length;
  const journey = featuredJourneys[activeJourney];

  document.querySelector("#journey-code").textContent = journey.code;
  document.querySelector("#journey-season").textContent = journey.season;
  document.querySelector("#journey-title").textContent = journey.title;
  document.querySelector("#journey-copy").textContent = journey.copy;
  document.querySelector("#journey-meta").replaceChildren(
    ...journey.meta.map((detail) => {
      const item = document.createElement("span");
      item.textContent = detail;
      return item;
    }),
  );
  document.querySelector("#journey-link").href =
    `/trip-planner?destination=${encodeURIComponent(journey.destination.toLowerCase())}&focus=1`;
  document.querySelector("#journey-position").textContent =
    `${activeJourney + 1} / ${featuredJourneys.length}`;
}

for (const tab of benefitTabs) {
  tab.addEventListener("click", () => showBenefit(tab.dataset.benefit));
}

for (const button of journeyButtons) {
  button.addEventListener("click", () => {
    showJourney(activeJourney + (button.dataset.journeyDirection === "next" ? 1 : -1));
  });
}
