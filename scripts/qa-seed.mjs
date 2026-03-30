import { PrismaClient, ListingType, AuctionStatus, TradePostStatus, WantRequestStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const seller = await prisma.user.upsert({
    where: { email: "qa-seller@dalow.local" },
    update: {
      displayName: "QA Seller",
      role: "SELLER",
    },
    create: {
      email: "qa-seller@dalow.local",
      displayName: "QA Seller",
      role: "SELLER",
      sellerProfile: {
        create: {
          status: "APPROVED",
          manualNotes: "QA seed seller",
        },
      },
    },
    include: { sellerProfile: true },
  });

  const buyer = await prisma.user.upsert({
    where: { email: "qa-buyer@dalow.local" },
    update: {
      displayName: "QA Buyer",
    },
    create: {
      email: "qa-buyer@dalow.local",
      displayName: "QA Buyer",
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

  if (!seller.sellerProfile) {
    throw new Error("QA seller profile is missing.");
  }

  let item = await prisma.item.findFirst({
    where: {
      sellerId: seller.sellerProfile.id,
      title: "QA Seed Blastoise EX",
    },
    select: { id: true },
  });
  if (!item) {
    item = await prisma.item.create({
      data: {
        sellerId: seller.sellerProfile.id,
        categoryId: category.id,
        title: "QA Seed Blastoise EX",
        description: "QA seed item for launch verification",
        condition: "PSA 9",
        images: {
          create: [
            {
              url: "https://images.pokemontcg.io/xy5/142_hires.png",
              isPrimary: true,
              storageProvider: "DATABASE",
            },
          ],
        },
      },
      select: { id: true },
    });
  }

  let listing = await prisma.auction.findFirst({
    where: {
      sellerId: seller.sellerProfile.id,
      title: "QA Buy Now Listing",
    },
    select: { id: true },
  });
  if (!listing) {
    listing = await prisma.auction.create({
      data: {
        sellerId: seller.sellerProfile.id,
        itemId: item.id,
        categoryId: category.id,
        title: "QA Buy Now Listing",
        description: "QA seed listing for buy now and bidding checks",
        listingType: ListingType.BOTH,
        status: AuctionStatus.LIVE,
        startingBid: 10000,
        currentBid: 10000,
        minBidIncrement: 500,
        buyNowPrice: 15000,
        currency: "usd",
        endTime: new Date(Date.now() + 1000 * 60 * 30),
        antiSnipeSeconds: 12,
      },
      select: { id: true },
    });
  }

  let trade = await prisma.tradePost.findFirst({
    where: {
      ownerId: seller.id,
      title: "QA Trade Post",
    },
    select: { id: true },
  });
  if (!trade) {
    trade = await prisma.tradePost.create({
      data: {
        ownerId: seller.id,
        title: "QA Trade Post",
        description: "QA seed trade post",
        category: "Pokemon",
        cardSet: "XY Phantom Forces",
        cardNumber: "61",
        condition: "NM-MT",
        gradeCompany: "PSA",
        gradeLabel: "9",
        lookingFor: "Alternate arts or cash",
        valueMin: 12000,
        valueMax: 18000,
        status: TradePostStatus.OPEN,
        images: {
          create: [
            {
              url: "https://images.pokemontcg.io/xy4/61_hires.png",
              isPrimary: true,
            },
          ],
        },
      },
      select: { id: true },
    });
  }

  let bounty = await prisma.wantRequest.findFirst({
    where: {
      userId: buyer.id,
      title: "QA Bounty Charizard",
    },
    select: { id: true },
  });
  if (!bounty) {
    bounty = await prisma.wantRequest.create({
      data: {
        userId: buyer.id,
        title: "QA Bounty Charizard",
        itemName: "Charizard EX",
        player: "Charizard EX",
        setName: "Flashfire",
        category: "Pokemon",
        gradeCompany: "PSA",
        gradeTarget: "10",
        priceMin: 50000,
        priceMax: 65000,
        bountyAmount: 5000,
        notes: "QA seed bounty",
        status: WantRequestStatus.OPEN,
      },
      select: { id: true },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      subject: "QA Conversation",
      participants: {
        every: { userId: { in: [seller.id, buyer.id] } },
      },
      AND: [
        { participants: { some: { userId: seller.id } } },
        { participants: { some: { userId: buyer.id } } },
      ],
    },
    select: { id: true },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        subject: "QA Conversation",
        participants: {
          create: [
            { userId: seller.id },
            { userId: buyer.id },
          ],
        },
        messages: {
          create: {
            senderId: buyer.id,
            body: "QA seed message",
          },
        },
      },
      select: { id: true },
    });
  }

  console.log(JSON.stringify({
    sellerEmail: seller.email,
    buyerEmail: buyer.email,
    listingId: listing.id,
    tradeId: trade.id,
    bountyId: bounty.id,
    conversationId: conversation.id,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
