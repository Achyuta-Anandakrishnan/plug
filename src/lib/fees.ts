const PLATFORM_FEE_BPS = 500;
const PROCESSING_FEE_BPS = 300;
const PROCESSING_FEE_FLAT_CENTS = 29;

export function computeFees(amountCents: number) {
  const platformFee = Math.round((amountCents * PLATFORM_FEE_BPS) / 10000);
  const processingFee =
    Math.round((amountCents * PROCESSING_FEE_BPS) / 10000) +
    PROCESSING_FEE_FLAT_CENTS;

  return {
    platformFee,
    processingFee,
    totalFees: platformFee + processingFee,
  };
}
