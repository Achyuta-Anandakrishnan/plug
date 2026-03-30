import {
  PrismaClient,
  ListingType,
  AuctionStatus,
  TradePostStatus,
  WantRequestStatus,
  StreamStatus,
  PaymentProvider,
  PaymentStatus,
  OrderStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sellerUser = await prisma.user.upsert({
    where: { email: "qa-seller@dalow.local" },
    update: {
      displayName: "QA Seller (Payouts Disabled)",
      role: "SELLER",
    },
    create: {
      email: "qa-seller@dalow.local",
      displayName: "QA Seller (Payouts Disabled)",
      role: "SELLER",
      sellerProfile: {
        create: {
          status: "APPROVED",
          manualNotes: "QA seed seller",
        },
      },
    },
  });
  await prisma.sellerProfile.upsert({
    where: { userId: sellerUser.id },
    update: {
      status: "APPROVED",
      stripeAccountId: null,
      payoutsEnabled: false,
      manualNotes: "QA seed seller",
    },
    create: {
      userId: sellerUser.id,
      status: "APPROVED",
      manualNotes: "QA seed seller",
    },
  });
  const seller = await prisma.user.findUnique({
    where: { id: sellerUser.id },
    include: { sellerProfile: true },
  });

  const activeSellerUser = await prisma.user.upsert({
    where: { email: "qa-live-seller@dalow.local" },
    update: {
      displayName: "QA Live Seller",
      role: "SELLER",
    },
    create: {
      email: "qa-live-seller@dalow.local",
      displayName: "QA Live Seller",
      role: "SELLER",
      sellerProfile: {
        create: {
          status: "APPROVED",
          stripeAccountId: "acct_qa_seed_active",
          payoutsEnabled: true,
          manualNotes: "QA seed active seller",
        },
      },
    },
  });
  await prisma.sellerProfile.upsert({
    where: { userId: activeSellerUser.id },
    update: {
      status: "APPROVED",
      stripeAccountId: "acct_qa_seed_active",
      payoutsEnabled: true,
      manualNotes: "QA seed active seller",
    },
    create: {
      userId: activeSellerUser.id,
      status: "APPROVED",
      stripeAccountId: "acct_qa_seed_active",
      payoutsEnabled: true,
      manualNotes: "QA seed active seller",
    },
  });
  const activeSeller = await prisma.user.findUnique({
    where: { id: activeSellerUser.id },
    include: { sellerProfile: true },
  });

  const onboardingSellerUser = await prisma.user.upsert({
    where: { email: "qa-seller-onboarding@dalow.local" },
    update: {
      displayName: "QA Seller (Onboarding)",
      role: "SELLER",
    },
    create: {
      email: "qa-seller-onboarding@dalow.local",
      displayName: "QA Seller (Onboarding)",
      role: "SELLER",
      sellerProfile: {
        create: {
          status: "APPLIED",
          manualNotes: "QA seed onboarding seller",
        },
      },
    },
  });
  await prisma.sellerProfile.upsert({
    where: { userId: onboardingSellerUser.id },
    update: {
      status: "APPLIED",
      stripeAccountId: null,
      payoutsEnabled: false,
      manualNotes: "QA seed onboarding seller",
    },
    create: {
      userId: onboardingSellerUser.id,
      status: "APPLIED",
      manualNotes: "QA seed onboarding seller",
    },
  });
  const onboardingSeller = await prisma.user.findUnique({
    where: { id: onboardingSellerUser.id },
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

  if (!seller?.sellerProfile) {
    throw new Error("QA seller profile is missing.");
  }
  if (!activeSeller?.sellerProfile) {
    throw new Error("QA active seller profile is missing.");
  }
  if (!onboardingSeller?.sellerProfile) {
    throw new Error("QA onboarding seller profile is missing.");
  }

  let item = await prisma.item.findFirst({
    where: {
      sellerId: activeSeller.sellerProfile.id,
      title: "QA Seed Blastoise EX",
    },
    select: { id: true },
  });
  if (!item) {
    item = await prisma.item.create({
      data: {
        sellerId: activeSeller.sellerProfile.id,
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
      sellerId: activeSeller.sellerProfile.id,
      title: "QA Live Listing",
    },
    select: { id: true },
  });
  if (!listing) {
    listing = await prisma.auction.create({
      data: {
        sellerId: activeSeller.sellerProfile.id,
        itemId: item.id,
        categoryId: category.id,
        title: "QA Live Listing",
        description: "QA seed listing for buy now, bids, and live room checks",
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

  let streamSession = await prisma.streamSession.findFirst({
    where: { auctionId: listing.id },
    select: { id: true },
  });
  if (!streamSession) {
    streamSession = await prisma.streamSession.create({
      data: {
        auctionId: listing.id,
        provider: "LIVEKIT",
        status: StreamStatus.LIVE,
        roomName: `qa-room-${listing.id}`,
      },
      select: { id: true },
    });
  }

  const existingTopBid = await prisma.bid.findFirst({
    where: {
      auctionId: listing.id,
      bidderId: buyer.id,
      amount: 11000,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!existingTopBid) {
    await prisma.bid.create({
      data: {
        auctionId: listing.id,
        bidderId: buyer.id,
        amount: 11000,
        status: "ACTIVE",
      },
    });

    await prisma.auction.update({
      where: { id: listing.id },
      data: {
        currentBid: 11000,
      },
    });
  }

  const existingChat = await prisma.auctionChatMessage.findFirst({
    where: {
      auctionId: listing.id,
      senderId: buyer.id,
      body: "QA live chat message",
    },
    select: { id: true },
  });
  if (!existingChat) {
    await prisma.auctionChatMessage.create({
      data: {
        auctionId: listing.id,
        senderId: buyer.id,
        body: "QA live chat message",
      },
    });
  }

  let trade = await prisma.tradePost.findFirst({
    where: {
      ownerId: activeSeller.id,
      title: "QA Trade Post",
    },
    select: { id: true },
  });
  if (!trade) {
    trade = await prisma.tradePost.create({
      data: {
        ownerId: activeSeller.id,
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
        every: { userId: { in: [activeSeller.id, buyer.id] } },
      },
      AND: [
        { participants: { some: { userId: activeSeller.id } } },
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
            { userId: activeSeller.id },
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

  let order = await prisma.order.findFirst({
    where: {
      auctionId: listing.id,
      buyerId: buyer.id,
      amount: 15000,
      status: OrderStatus.PENDING_PAYMENT,
    },
    select: { id: true },
  });
  if (!order) {
    order = await prisma.order.create({
      data: {
        auctionId: listing.id,
        buyerId: buyer.id,
        sellerId: activeSeller.sellerProfile.id,
        amount: 15000,
        currency: "usd",
        platformFee: 1500,
        processingFee: 450,
        status: OrderStatus.PENDING_PAYMENT,
        payment: {
          create: {
            provider: PaymentProvider.STRIPE,
            status: PaymentStatus.REQUIRES_PAYMENT_METHOD,
            amount: 15000,
            currency: "usd",
          },
        },
      },
      select: { id: true },
    });
  }

  console.log(JSON.stringify({
    sellerEmail: seller.email,
    activeSellerEmail: activeSeller.email,
    onboardingSellerEmail: onboardingSeller.email,
    buyerEmail: buyer.email,
    listingId: listing.id,
    streamSessionId: streamSession.id,
    tradeId: trade.id,
    bountyId: bounty.id,
    conversationId: conversation.id,
    pendingOrderId: order.id,
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
