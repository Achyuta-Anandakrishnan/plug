import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return jsonError("Not available in production.", 404);
  }

  const sellerUser = await prisma.user.upsert({
    where: { email: "dev-seller@vyre.local" },
    update: {},
    create: {
      email: "dev-seller@vyre.local",
      displayName: "Dev Seller",
      role: "SELLER",
      sellerProfile: {
        create: {
          status: "APPROVED",
          manualNotes: "Dev seed seller",
        },
      },
    },
    include: { sellerProfile: true },
  });

  const buyerUser = await prisma.user.upsert({
    where: { email: "dev-buyer@vyre.local" },
    update: {},
    create: {
      email: "dev-buyer@vyre.local",
      displayName: "Dev Buyer",
      role: "BUYER",
    },
  });

  const category = await prisma.category.upsert({
    where: { slug: "pokemon" },
    update: {},
    create: {
      name: "Pokemon",
      slug: "pokemon",
    },
  });

  const existingAuction = await prisma.auction.findFirst({
    where: { title: "Dev Seed Charizard Holo" },
  });

  let auctionId = existingAuction?.id ?? null;
  if (!existingAuction && sellerUser.sellerProfile) {
    const item = await prisma.item.create({
      data: {
        sellerId: sellerUser.sellerProfile.id,
        categoryId: category.id,
        title: "Charizard Holo PSA 10",
        description: "Dev seed item. Mint condition.",
        condition: "PSA 10",
        images: {
          create: [
            {
              url: "/streams/stream-1.svg",
              isPrimary: true,
              storageProvider: "DATABASE",
            },
          ],
        },
      },
    });

    const auction = await prisma.auction.create({
      data: {
        sellerId: sellerUser.sellerProfile.id,
        itemId: item.id,
        categoryId: category.id,
        title: "Dev Seed Charizard Holo",
        description: "Live auction demo listing.",
        listingType: "BOTH",
        status: "LIVE",
        startingBid: 120000,
        currentBid: 120000,
        minBidIncrement: 2000,
        buyNowPrice: 240000,
        currency: "usd",
        endTime: new Date(Date.now() + 1000 * 60 * 30),
        antiSnipeSeconds: 12,
      },
    });

    auctionId = auction.id;
  }

  return jsonOk({
    sellerProfileId: sellerUser.sellerProfile?.id ?? null,
    buyerId: buyerUser.id,
    auctionId,
  });
}
