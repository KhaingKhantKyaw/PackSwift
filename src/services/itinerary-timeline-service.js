import { destinationCatalog } from "./travel-planner.js";

const transferProfiles = Object.freeze({
  bangkok: {
    transitMode: "Airport Rail Link or official metered taxi",
    duration: 60,
    safety:
      "Use the official taxi queue or signed rail connection and keep valuables secure in crowded areas.",
  },
  singapore: {
    transitMode: "MRT or official taxi",
    duration: 45,
    safety:
      "Follow airport transport signs and use only licensed taxi ranks.",
  },
  yangon: {
    transitMode: "Official airport taxi or pre-arranged hotel transfer",
    duration: 60,
    safety:
      "Confirm the fare or hotel driver details before leaving the terminal and check current official travel guidance.",
  },
});

function minutesFromTime(time) {
  const [hours, minutes] = String(time || "09:00")
    .slice(0, 5)
    .split(":")
    .map(Number);
  return Math.max(0, Math.min(1439, hours * 60 + minutes));
}

function timeFromMinutes(totalMinutes) {
  const normalized = Math.max(0, Math.min(1439, totalMinutes));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function item({
  day,
  sequence,
  start,
  duration,
  type,
  title,
  description,
  locationName = null,
  transitMode = null,
  safetyNote = null,
}) {
  const startMinutes = minutesFromTime(start);
  return {
    day,
    sequence,
    startTime: timeFromMinutes(startMinutes),
    endTime: timeFromMinutes(startMinutes + duration),
    type,
    title,
    description,
    locationName,
    transitMode,
    estimatedDurationMinutes: duration,
    safetyNote,
  };
}

function destinationProfile(slug) {
  return destinationCatalog.find((destination) => destination.slug === slug);
}

function transferProfile(destination) {
  return transferProfiles[destination.slug] || {
    transitMode: "Licensed airport taxi or pre-arranged hotel transfer",
    duration: 60,
    safety:
      "Use official airport transport desks, confirm the destination and estimated fare, and avoid unsolicited drivers.",
  };
}

function arrivalStart(value) {
  if (!value) return "09:00";
  const match = String(value).match(/[T ](\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : String(value).slice(0, 5);
}

export function buildDetailedTimeline(plan, destinationContext = {}) {
  const destination = {
    slug: destinationContext.slug || plan.destination.slug,
    name: destinationContext.name || plan.destination.name,
    countryName:
      destinationContext.countryName ||
      plan.destination.country ||
      "",
    airportCode:
      destinationContext.primaryAirportCode ||
      destinationContext.airportCode ||
      plan.destination.code ||
      "Airport",
  };
  const catalog = destinationProfile(destination.slug) || plan.destination;
  const attractions = catalog.attractions?.length
    ? catalog.attractions
    : ["A central neighbourhood", "A local cultural highlight"];
  const transfer = transferProfile(destination);
  const days = Math.max(1, Math.min(30, Number(plan.days) || 1));
  const purpose = plan.input?.tripPurpose || "leisure";
  const pace = plan.input?.pace || "balanced";
  const arrival = arrivalStart(
    destinationContext.arrivalAt || plan.input?.arrivalAt,
  );
  const timeline = [];
  let sequence = 1;
  let cursor = minutesFromTime(arrival);

  const addArrivalItem = (options) => {
    const entry = item({
      day: 1,
      sequence,
      start: timeFromMinutes(cursor),
      ...options,
    });
    timeline.push(entry);
    cursor = minutesFromTime(entry.endTime);
    sequence += 1;
  };

  addArrivalItem({
    duration: 30,
    type: "arrival",
    title: `Arrive at ${destination.airportCode}`,
    description:
      "Follow arrival signs, keep travel documents ready, and confirm the local time.",
    locationName: `${destination.name} airport`,
  });
  addArrivalItem({
    duration: 45,
    type: "immigration",
    title: "Immigration and entry formalities",
    description:
      "Complete entry checks and keep accommodation details available if requested.",
    safetyNote: "Keep passports and arrival documents secure and accessible.",
  });
  addArrivalItem({
    duration: 30,
    type: "baggage",
    title: "Collect baggage and prepare for transfer",
    description:
      "Collect luggage, use an official cash machine or exchange counter if needed, and contact the hotel if plans change.",
  });
  addArrivalItem({
    duration: transfer.duration,
    type: "airport-transfer",
    title: "Transfer from the airport to the hotel",
    description: `Travel into ${destination.name} using a reliable arrival option.`,
    transitMode: transfer.transitMode,
    safetyNote: transfer.safety,
  });
  addArrivalItem({
    duration: 45,
    type: "hotel",
    title: "Hotel check-in and orientation",
    description:
      "Confirm check-out time, hotel contact details, breakfast arrangements, and the safest nearby transport options.",
    locationName: destinationContext.hotelName || "Selected hotel",
  });

  if (cursor < 18 * 60) {
    cursor = Math.max(cursor + 30, 13 * 60);
    addArrivalItem({
      duration: 60,
      type: "meal",
      title: "Easy local meal",
      description:
        "Choose a nearby, well-reviewed place and keep the first meal flexible after the journey.",
    });
    if (cursor < 19 * 60) {
      addArrivalItem({
        duration: pace === "relaxed" ? 60 : 90,
        type: "activity",
        title: `Gentle introduction to ${destination.name}`,
        description: `Take an unhurried orientation around ${attractions[0]} or the hotel neighbourhood.`,
        locationName: attractions[0],
        safetyNote:
          "Carry only what you need, note the route back to the hotel, and avoid isolated areas after dark.",
      });
    }
  }

  for (let day = 2; day <= days; day += 1) {
    const isDepartureDay = day === days;
    sequence = 1;

    if (isDepartureDay) {
      timeline.push(
        item({
          day,
          sequence: sequence++,
          start: "08:00",
          duration: 60,
          type: "meal",
          title: "Breakfast and final packing check",
          description:
            "Confirm passports, transport details, chargers, medication, and checked baggage.",
        }),
        item({
          day,
          sequence: sequence++,
          start: "10:00",
          duration: 60,
          type: "hotel",
          title: "Hotel check-out",
          description:
            "Check the room and safe, settle any remaining charges, and retain a receipt.",
          locationName: destinationContext.hotelName || "Selected hotel",
        }),
        item({
          day,
          sequence: sequence++,
          start: "11:30",
          duration: transfer.duration,
          type: "airport-transfer",
          title: `Transfer to ${destination.airportCode}`,
          description:
            "Allow additional time for traffic, terminal navigation, and airline check-in.",
          transitMode: transfer.transitMode,
          safetyNote: transfer.safety,
        }),
        item({
          day,
          sequence: sequence++,
          start: timeFromMinutes(11 * 60 + 30 + transfer.duration),
          duration: 120,
          type: "departure",
          title: "Airport check-in and departure preparation",
          description:
            "Complete check-in, security, border formalities, and proceed to the gate.",
          locationName: `${destination.name} airport`,
        }),
      );
      continue;
    }

    const firstAttraction = attractions[(day - 2) % attractions.length];
    const secondAttraction = attractions[(day - 1) % attractions.length];
    const morningTitle =
      purpose === "business" && day === 2
        ? "Protected meeting or work block"
        : firstAttraction;
    timeline.push(
      item({
        day,
        sequence: sequence++,
        start: "08:00",
        duration: 60,
        type: "meal",
        title: "Breakfast and daily check",
        description:
          "Review weather, transport conditions, opening hours, and any current local advisories.",
      }),
      item({
        day,
        sequence: sequence++,
        start: "09:30",
        duration: pace === "relaxed" ? 120 : 150,
        type: "activity",
        title: morningTitle,
        description:
          purpose === "business" && day === 2
            ? "Keep this period clear for meetings, work, or professional preparation."
            : `Explore ${firstAttraction} with enough time for entry, orientation, and photographs.`,
        locationName: morningTitle,
      }),
      item({
        day,
        sequence: sequence++,
        start: "12:30",
        duration: 75,
        type: "meal",
        title: "Local lunch",
        description:
          "Choose a convenient restaurant near the morning activity and allow time to rest.",
      }),
      item({
        day,
        sequence: sequence++,
        start: "14:15",
        duration: pace === "relaxed" ? 90 : 150,
        type: pace === "relaxed" ? "free-time" : "activity",
        title: pace === "relaxed" ? "Flexible afternoon" : secondAttraction,
        description:
          pace === "relaxed"
            ? `Rest, explore a nearby café, or make a short optional visit to ${secondAttraction}.`
            : `Continue to ${secondAttraction}, allowing realistic travel time between locations.`,
        locationName: secondAttraction,
        safetyNote:
          "Use mapped, licensed transport and keep valuables secure in busy visitor areas.",
      }),
      item({
        day,
        sequence: sequence++,
        start: purpose === "family" ? "18:00" : "18:30",
        duration: 75,
        type: "meal",
        title: "Dinner and evening review",
        description:
          "Choose a well-reviewed local dinner, then confirm the next day's transport and bookings.",
      }),
    );
  }

  return timeline;
}

export function timelineHasOverlaps(timeline) {
  const byDay = new Map();
  for (const entry of timeline) {
    const entries = byDay.get(entry.day) || [];
    entries.push(entry);
    byDay.set(entry.day, entries);
  }
  for (const entries of byDay.values()) {
    const ordered = entries.sort(
      (first, second) =>
        minutesFromTime(first.startTime) - minutesFromTime(second.startTime),
    );
    for (let index = 1; index < ordered.length; index += 1) {
      if (
        minutesFromTime(ordered[index].startTime) <
        minutesFromTime(ordered[index - 1].endTime)
      ) {
        return true;
      }
    }
  }
  return false;
}
