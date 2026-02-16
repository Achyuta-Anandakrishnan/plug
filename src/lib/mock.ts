export const categories = [
  {
    name: "Pokemon",
    description: "Graded singles, sealed boxes, premium pulls.",
  },
  {
    name: "Electronics",
    description: "Verified devices, new-in-box, insured.",
  },
  {
    name: "Sneakers",
    description: "Authentication-first drops and rare pairs.",
  },
  {
    name: "Luxury",
    description: "Handbags, watches, and provenance docs.",
  },
  {
    name: "Collectibles",
    description: "Comics, vinyl, and limited editions.",
  },
];

type MockAuction = {
  id: string;
  title: string;
  sellerName: string;
  category: string;
  currentBid: number;
  timeLeft: number;
  watchers: number;
  badge: string;
  imageUrl: string;
  listingType: "AUCTION" | "BUY_NOW" | "BOTH";
  buyNowPrice?: number;
  currency: string;
};

export const auctions: MockAuction[] = [
  {
    id: "vx-001",
    title: "Charizard Holo PSA 10 Stream",
    sellerName: "Lumen Cards",
    category: "Pokemon",
    currentBid: 128000,
    timeLeft: 96,
    watchers: 218,
    badge: "Verified Vault",
    imageUrl: "/streams/stream-1.svg",
    listingType: "BOTH",
    buyNowPrice: 240000,
    currency: "USD",
  },
  {
    id: "vx-002",
    title: "MacBook Pro M3 Max Live Drop",
    sellerName: "Northbridge Tech",
    category: "Electronics",
    currentBid: 329000,
    timeLeft: 164,
    watchers: 91,
    badge: "Factory Sealed",
    imageUrl: "/streams/stream-2.svg",
    listingType: "AUCTION",
    currency: "USD",
  },
  {
    id: "vx-003",
    title: "Air Jordan 1 Chicago 1994",
    sellerName: "Prime Archive",
    category: "Sneakers",
    currentBid: 211000,
    timeLeft: 74,
    watchers: 153,
    badge: "Authenticated",
    imageUrl: "/streams/stream-3.svg",
    listingType: "AUCTION",
    currency: "USD",
  },
  {
    id: "vx-004",
    title: "Rolex Submariner 16610",
    sellerName: "Meridian Watches",
    category: "Luxury",
    currentBid: 894000,
    timeLeft: 132,
    watchers: 67,
    badge: "Escrow Ready",
    imageUrl: "/streams/stream-4.svg",
    listingType: "BUY_NOW",
    buyNowPrice: 950000,
    currency: "USD",
  },
  {
    id: "vx-005",
    title: "First Pressing Blonde Vinyl",
    sellerName: "Studio 7",
    category: "Collectibles",
    currentBid: 52000,
    timeLeft: 58,
    watchers: 44,
    badge: "Archive Grade",
    imageUrl: "/streams/stream-5.svg",
    listingType: "AUCTION",
    currency: "USD",
  },
  {
    id: "vx-006",
    title: "Base Set Booster Box (WOTC)",
    sellerName: "Cobalt Labs",
    category: "Pokemon",
    currentBid: 1180000,
    timeLeft: 188,
    watchers: 302,
    badge: "Chain-of-Custody",
    imageUrl: "/streams/stream-6.svg",
    listingType: "BOTH",
    buyNowPrice: 1450000,
    currency: "USD",
  },
];

export const sellerSteps = [
  {
    title: "Identity & business verification",
    detail: "Government ID + proof of inventory ownership.",
  },
  {
    title: "Inventory intake review",
    detail: "Manual inspection, authenticity checks, provenance logs.",
  },
  {
    title: "Seller interview",
    detail: "Live video walkthrough of storage, packing, fulfillment.",
  },
  {
    title: "Escrow + payout controls",
    detail: "Funds held until delivery confirmation and buyer approval.",
  },
];

export const inbox = [
  {
    id: "c1",
    name: "Cobalt Labs",
    preview: "We can go live in 5. Need another angle?",
    time: "2m",
    unread: 2,
  },
  {
    id: "c2",
    name: "Meridian Watches",
    preview: "Uploading the serial verification now.",
    time: "34m",
    unread: 0,
  },
  {
    id: "c3",
    name: "Lumen Cards",
    preview: "Reserve is set. Want a 60s buffer?",
    time: "1h",
    unread: 0,
  },
];

export const messages = [
  {
    id: "m1",
    sender: "Cobalt Labs",
    text: "Lot is ready. We added a second camera for seals.",
    time: "10:14",
  },
  {
    id: "m2",
    sender: "You",
    text: "Perfect. Start with the UPC close-up, then zoom out.",
    time: "10:15",
  },
  {
    id: "m3",
    sender: "Cobalt Labs",
    text: "Copy. Triggering countdown at :30.",
    time: "10:16",
  },
];
