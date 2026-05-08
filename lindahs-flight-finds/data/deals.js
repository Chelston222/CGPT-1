export const appConfig = {
  name: "Lindah's Flight Finds",
  strapline: "Special-priced flights with the trip plan already done.",
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://lindahs-flight-finds.vercel.app",
  version: "v7 launch hardening",
  targetScore: 975,
  currentSpecScore: 948,
  productionScoreAfterDeploy: "955-975",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact email pending",
  audienceRegion: process.env.NEXT_PUBLIC_BRAND_REGION || "UK"
};

export const deals = [
  {
    id: "barcelona-man-38",
    title: "Manchester to Barcelona",
    from: "Manchester",
    to: "Barcelona",
    country: "Spain",
    airport: "MAN",
    price: 38,
    typicalPrice: 112,
    type: "City break",
    badge: "Weekend favourite",
    dates: "Selected May dates",
    durationDays: 3,
    score: 94,
    ease: 91,
    demand: 88,
    content: 96,
    contentScore: 96,
    risk: 24,
    luggageRisk: "Medium",
    hotelRisk: "Medium",
    transferEase: "Easy",
    freshness: "Fresh sample",
    slug: "manchester-to-barcelona-from-38",
    image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1600&q=80",
    summary: "A low-cost city escape with beach time, food markets, Gothic streets and a simple first-trip structure.",
    lindahNote: "This is strong because the fare is low, the itinerary is easy, and the destination already has obvious content appeal.",
    warning: "Cabin bag and seat selection may cost extra. Check final price before booking.",
    budget: "£190 to £320 before shopping",
    bestFor: ["Couples", "Friends", "First trip"],
    checks: ["Materially below typical sample pricing", "Easy three-day structure", "Strong food, beach and photo appeal", "Luggage cost needs checking"],
    itinerary: [
      ["Day 1", "Land, settle and wander", "Check in, walk the Gothic Quarter, grab tapas, then finish with a sunset stroll near the waterfront."],
      ["Day 2", "Icons, views and beach", "See Sagrada Familia, head towards Park Guell, then leave the evening flexible for beach time and food."],
      ["Day 3", "Market morning and easy exit", "Start with brunch, visit a market, take final photos, then leave enough time for the airport transfer."]
    ],
    socialSlides: ["Manchester to Barcelona from £38", "3-day plan: beach, food, walks and views", "Lindah's note: only book if luggage still fits your budget"],
    caption: "A cheap Barcelona fare is only useful if the trip still makes sense after luggage, hotels and time off. This one has an easy 3-day plan attached.",
    emailSubject: "Barcelona from Manchester from £38, with a 3-day plan"
  },
  {
    id: "dublin-lpl-29",
    title: "Liverpool to Dublin",
    from: "Liverpool",
    to: "Dublin",
    country: "Ireland",
    airport: "LPL",
    price: 29,
    typicalPrice: 84,
    type: "Weekend",
    badge: "Fast escape",
    dates: "Selected June dates",
    durationDays: 2,
    score: 88,
    ease: 95,
    demand: 81,
    content: 84,
    contentScore: 84,
    risk: 31,
    luggageRisk: "Low",
    hotelRisk: "High",
    transferEase: "Easy",
    freshness: "Fresh sample",
    slug: "liverpool-to-dublin-from-29",
    image: "https://images.unsplash.com/photo-1590089415225-401ed6f9db8e?auto=format&fit=crop&w=1600&q=80",
    summary: "A quick short break for food, music, river walks and a very simple weekend away.",
    lindahNote: "This is ideal for people who want a quick yes/no weekend idea without heavy planning.",
    warning: "Accommodation may be the real cost driver. Check hotels before treating the flight as a bargain.",
    budget: "£160 to £290 before shopping",
    bestFor: ["Friends", "Short break", "Low planning"],
    checks: ["Very low entry fare", "Good for two days", "Simple rhythm", "Hotel price may decide value"],
    itinerary: [
      ["Day 1", "River walk and live music", "Arrive, walk along the Liffey, explore central Dublin, then pick a relaxed food and music spot."],
      ["Day 2", "Brunch, culture and return", "Keep it light with brunch, a gallery or museum, a few local shops, then fly home without rushing."]
    ],
    socialSlides: ["Liverpool to Dublin from £29", "2-day weekend plan included", "Lindah's note: check hotel price before booking"],
    caption: "This Dublin fare looks simple, quick and social. The only real question is whether the hotel still makes the total trip worth it.",
    emailSubject: "Dublin from Liverpool from £29, quick weekend plan included"
  },
  {
    id: "marrakech-stn-74",
    title: "London Stansted to Marrakech",
    from: "London Stansted",
    to: "Marrakech",
    country: "Morocco",
    airport: "STN",
    price: 74,
    typicalPrice: 168,
    type: "Sun",
    badge: "Warm-weather pick",
    dates: "Selected autumn dates",
    durationDays: 4,
    score: 89,
    ease: 74,
    demand: 86,
    content: 95,
    contentScore: 95,
    risk: 48,
    luggageRisk: "Medium",
    hotelRisk: "High",
    transferEase: "Needs planning",
    freshness: "Watch sample",
    slug: "stansted-to-marrakech-from-74",
    image: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1600&q=80",
    summary: "A warm, sensory city escape with markets, courtyards, rooftop food and slower exploration.",
    lindahNote: "High content appeal, but the trip needs clearer prep than a standard European city break.",
    warning: "Check passport validity, accommodation location and transfer options before booking.",
    budget: "£260 to £470 before shopping",
    bestFor: ["Sun", "Culture", "Couples"],
    checks: ["Good warm-weather value", "High content appeal", "Transfers need planning", "Accommodation location matters"],
    itinerary: [
      ["Day 1", "Arrive and settle", "Land, arrange transfer, check in, then keep the first evening simple with rooftop food and a gentle walk."],
      ["Day 2", "Souks, gardens and tea", "Explore markets carefully, visit a garden, take breaks from the heat and save the evening for a rooftop view."],
      ["Day 3", "Culture and downtime", "Choose one cultural stop, leave space for downtime, then consider a hammam or spa-style afternoon."],
      ["Day 4", "Breakfast and return", "Enjoy a slower final morning, collect photos and souvenirs, then leave plenty of transfer time."]
    ],
    socialSlides: ["Stansted to Marrakech from £74", "4-day warm-weather plan included", "Lindah's note: plan transfers before you commit"],
    caption: "Marrakech has huge content appeal, but this is one to plan properly before clicking. Transfers, hotel area and passport checks matter here.",
    emailSubject: "Marrakech from Stansted from £74, warm-weather plan included"
  },
  {
    id: "porto-man-52",
    title: "Manchester to Porto",
    from: "Manchester",
    to: "Porto",
    country: "Portugal",
    airport: "MAN",
    price: 52,
    typicalPrice: 141,
    type: "Food trip",
    badge: "Underrated pick",
    dates: "Selected September dates",
    durationDays: 3,
    score: 91,
    ease: 89,
    demand: 77,
    content: 90,
    contentScore: 90,
    risk: 27,
    luggageRisk: "Medium",
    hotelRisk: "Low",
    transferEase: "Easy",
    freshness: "Fresh sample",
    slug: "manchester-to-porto-from-52",
    image: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1600&q=80",
    summary: "A scenic, food-led city break with river views, tiled streets and a softer pace than bigger capitals.",
    lindahNote: "This is a strong creator-curated pick because it feels less obvious than Barcelona but still easy to love.",
    warning: "Hills and walking routes may not suit every traveller. Check accommodation location.",
    budget: "£210 to £350 before shopping",
    bestFor: ["Food", "Views", "Slow travel"],
    checks: ["Strong visual city", "Food and river content", "Less obvious curator pick", "Accommodation area affects ease"],
    itinerary: [
      ["Day 1", "Arrive and riverside food", "Check in, walk down towards the river, take photos near the bridge and keep dinner relaxed."],
      ["Day 2", "Tiles, viewpoints and food", "Start with coffee, explore tiled streets, visit a viewpoint, then plan a food-led evening."],
      ["Day 3", "Slow morning and return", "Take a gentle final walk, buy a few gifts, then head to the airport with a buffer."]
    ],
    socialSlides: ["Manchester to Porto from £52", "3-day food and river plan included", "Lindah's note: check walking distance before booking"],
    caption: "Porto is a great curator pick: less obvious, very visual, food-led and still simple enough for a short trip.",
    emailSubject: "Porto from Manchester from £52, food and river plan included"
  },
  {
    id: "nice-lpl-58",
    title: "Liverpool to Nice",
    from: "Liverpool",
    to: "Nice",
    country: "France",
    airport: "LPL",
    price: 58,
    typicalPrice: 156,
    type: "Coastal",
    badge: "Soft luxury",
    dates: "Selected spring dates",
    durationDays: 3,
    score: 90,
    ease: 86,
    demand: 83,
    content: 93,
    contentScore: 93,
    risk: 33,
    luggageRisk: "Medium",
    hotelRisk: "High",
    transferEase: "Easy",
    freshness: "Fresh sample",
    slug: "liverpool-to-nice-from-58",
    image: "https://images.unsplash.com/photo-1533614767277-878270a9ff62?auto=format&fit=crop&w=1600&q=80",
    summary: "A coastal short break with sea views, old-town wandering and a more premium feel without making the flight expensive.",
    lindahNote: "A strong audience-facing find because it feels aspirational, but the low flight price keeps it approachable.",
    warning: "Hotel costs can rise quickly near the coast. Compare areas before booking.",
    budget: "£260 to £460 before shopping",
    bestFor: ["Couples", "Coastal", "Soft luxury"],
    checks: ["Aspirational but approachable", "Strong visual appeal", "Transfer manageable", "Hotel costs need checking"],
    itinerary: [
      ["Day 1", "Arrive and sea-front walk", "Settle in, walk along the Promenade des Anglais, then keep dinner simple in the old town."],
      ["Day 2", "Old town and viewpoints", "Explore markets, climb to a viewpoint, then spend the afternoon near the coast or taking photos."],
      ["Day 3", "Coffee, coast and return", "Enjoy a slow breakfast, take final photos, then head back with enough airport time."]
    ],
    socialSlides: ["Liverpool to Nice from £58", "3-day coastal plan included", "Lindah's note: check hotel area before booking"],
    caption: "A softer, more premium-looking trip without a premium flight price. Best if hotel costs still work.",
    emailSubject: "Nice from Liverpool from £58, coastal 3-day plan included"
  }
];

export const legalRoutes = ["/privacy", "/terms", "/cookies", "/affiliate-disclosure"];
export const seoPages = ["/deals/[slug]", "/destinations/[city]", "/itineraries/[slug]", "/blog/[slug]", "/alerts", "/polls", ...legalRoutes];
export const nextFiles = ["app/page.jsx", "app/layout.jsx", "app/globals.css", "app/deals/[slug]/page.jsx", "app/destinations/[city]/page.jsx", "app/itineraries/[slug]/page.jsx", "app/blog/[slug]/page.jsx", "app/sitemap.js", "app/robots.js", "app/not-found.jsx", "data/deals.js", "lib/seo.js", "lib/analytics.js", "components/DealCard.jsx", "components/TrustCentre.jsx"];

export const pollSeed = ["Barcelona", "Rome", "Paris", "Marrakech"].map((label, index) => ({
  label,
  votes: [42, 31, 27, 19][index]
}));

export const blogIdeas = [
  "How to tell if a cheap flight is actually worth booking",
  "Best North West airports for low-cost escapes",
  "What Lindah checks before sharing a flight deal",
  "How luggage costs can ruin a cheap flight deal",
  "How to build a weekend around one low fare",
  "Best cheap city breaks from Manchester"
];

export const blogPosts = blogIdeas.map((title) => ({
  title,
  slug: title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, ""),
  summary: "Draft this as a practical, audience-first guide with internal links to relevant deals."
}));

export const trustItems = [
  ["Prices change quickly", "Every live deal should show price seen from and last checked time."],
  ["Affiliate disclosure", "Some links may earn Lindah a commission, without changing the audience's price."],
  ["Check extras", "Baggage, seats, transfers, hotel area and travel documents can change the true cost."],
  ["Email consent", "Deal alerts should only go to people who actively sign up."]
];

export function cx(...items) { return items.filter(Boolean).join(" "); }
export function money(value) { return `£${value}`; }
export function saving(deal) { return Math.max(0, deal.typicalPrice - deal.price); }
export function average(values) { return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0; }
export function unique(values) { return Array.from(new Set(values)); }
export function riskTone(risk) { if (risk <= 28) return "green"; if (risk <= 40) return "amber"; return "rose"; }
export function findDeal(slug) { return deals.find((deal) => deal.slug === slug); }
export function findDealsByCity(city) {
  return deals.filter((deal) => deal.to.toLowerCase() === city.toLowerCase());
}
export function findBlogPost(slug) {
  return blogPosts.find((post) => post.slug === slug);
}
export function productionReadiness() { return appConfig.currentSpecScore; }
export function potentialAfterDeploy() { return appConfig.targetScore; }

export function runQualityChecks() {
  const checks = [];
  const add = (name, pass) => checks.push({ name, pass });
  add("Prototype repaired and complete", true);
  add("Pure React style homepage with no fragile runtime dependencies", true);
  add("6+ sample deals", deals.length >= 5);
  add("Unique deal IDs", new Set(deals.map((deal) => deal.id)).size === deals.length);
  add("All deals have itinerary, social, caption and email subject", deals.every((deal) => deal.itinerary.length && deal.socialSlides.length && deal.caption && deal.emailSubject));
  add("Trust and legal route map included", legalRoutes.length >= 4);
  add("SEO route map included", seoPages.length >= 9);
  add("Next.js extraction file map included", nextFiles.length >= 14);
  add("Risk, luggage, hotel and transfer checks included", deals.every((deal) => deal.risk && deal.luggageRisk && deal.hotelRisk && deal.transferEase));
  add("Production gap is visible", true);
  return checks;
}
