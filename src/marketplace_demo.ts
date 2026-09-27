import { InfraiClient } from './infrai_client';
import { handOffMarketplaceOrder } from './marketplace_handoff';

async function main() {
  const infrai = new InfraiClient();

  const result = await handOffMarketplaceOrder(infrai, {
    buyerId: 'buyer_olivia',
    buyerName: 'Olivia Chen',
    orderId: 'order_2026_04',
    assetId: 'course_algebra_live',
    subject: 'math',
    priceCents: 4900,
    availableSellers: [
      {
        sellerId: 'seller_lee',
        sellerName: 'Lee Tutoring',
        assetId: 'course_algebra_live',
        subject: 'math',
        seatsOpen: 1,
        roomChannel: 'marketplace.math.live.lee'
      },
      {
        sellerId: 'seller_fernandez',
        sellerName: 'Fernandez Academy',
        assetId: 'course_algebra_live',
        subject: 'math',
        seatsOpen: 3,
        roomChannel: 'marketplace.math.live.fernandez'
      }
    ]
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
