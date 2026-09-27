import { z } from 'zod';
import { InfraiClient } from './infrai_client';

export const orderHandoffRequestSchema = z.object({
  buyerId: z.string().min(1),
  buyerName: z.string().min(1),
  orderId: z.string().min(1),
  assetId: z.string().min(1),
  subject: z.string().min(1),
  priceCents: z.number().int().positive(),
  availableSellers: z.array(
    z.object({
      sellerId: z.string().min(1),
      sellerName: z.string().min(1),
      assetId: z.string().min(1),
      subject: z.string().min(1),
      seatsOpen: z.number().int().nonnegative(),
      roomChannel: z.string().min(1)
    })
  ).min(1)
});

export type OrderHandoffRequest = z.infer<typeof orderHandoffRequestSchema>;

export type MatchDecision = {
  sellerId: string;
  sellerName: string;
  roomChannel: string;
  seatsRemaining: number;
  status: 'matched';
};

export function chooseSellerForOrder(input: OrderHandoffRequest): MatchDecision {
  const exactMatches = input.availableSellers
    .filter((seller) => seller.assetId === input.assetId && seller.subject === input.subject && seller.seatsOpen > 0)
    .sort((a, b) => b.seatsOpen - a.seatsOpen || a.sellerId.localeCompare(b.sellerId));

  if (exactMatches.length === 0) {
    throw new Error(`No seller has open seats for asset ${input.assetId} in ${input.subject}.`);
  }

  const seller = exactMatches[0];

  return {
    sellerId: seller.sellerId,
    sellerName: seller.sellerName,
    roomChannel: seller.roomChannel,
    seatsRemaining: seller.seatsOpen - 1,
    status: 'matched'
  };
}

export async function handOffMarketplaceOrder(
  infrai: InfraiClient,
  rawInput: unknown
): Promise<{
  orderId: string;
  buyerId: string;
  sellerId: string;
  roomChannel: string;
  buyerRealtimeToken: Record<string, unknown>;
}> {
  const input = orderHandoffRequestSchema.parse(rawInput);
  const decision = chooseSellerForOrder(input);

  await infrai.realtime.channel.create({
    channel: decision.roomChannel,
    type: 'presence',
    vendor: 'ably'
  });

  await infrai.realtime.publish({
    channel: decision.roomChannel,
    event: 'order.handoff',
    data: {
      handoff_id: `${input.orderId}:${input.buyerId}`,
      order_id: input.orderId,
      buyer_id: input.buyerId,
      buyer_name: input.buyerName,
      seller_id: decision.sellerId,
      seller_name: decision.sellerName,
      asset_id: input.assetId,
      subject: input.subject,
      price_cents: input.priceCents,
      seats_remaining: decision.seatsRemaining,
      state: decision.status
    },
    account_id: input.buyerId
  });

  const buyerRealtimeToken = await infrai.realtime.token.issue({
    client_id: input.buyerId,
    channels: [decision.roomChannel],
    capabilities: ['subscribe', 'presence'],
    ttl_seconds: 1800
  });

  return {
    orderId: input.orderId,
    buyerId: input.buyerId,
    sellerId: decision.sellerId,
    roomChannel: decision.roomChannel,
    buyerRealtimeToken
  };
}
