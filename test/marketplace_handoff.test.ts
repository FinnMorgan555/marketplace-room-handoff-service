import { describe, expect, it, vi } from 'vitest';
import { chooseSellerForOrder, handOffMarketplaceOrder } from '../src/marketplace_handoff';
import { InfraiClient } from '../src/infrai_client';

describe('chooseSellerForOrder', () => {
  it('picks the seller with the most open seats for the requested asset and subject', () => {
    const decision = chooseSellerForOrder({
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
        },
        {
          sellerId: 'seller_history',
          sellerName: 'History Lab',
          assetId: 'course_world_history',
          subject: 'history',
          seatsOpen: 9,
          roomChannel: 'marketplace.history.live.lab'
        }
      ]
    });

    expect(decision).toEqual({
      sellerId: 'seller_fernandez',
      sellerName: 'Fernandez Academy',
      roomChannel: 'marketplace.math.live.fernandez',
      seatsRemaining: 2,
      status: 'matched'
    });
  });
});

describe('handOffMarketplaceOrder', () => {
  it('publishes the handoff and issues a buyer token for the chosen room', async () => {
    const infrai = {
      realtime: {
        channel: {
          create: vi.fn(async () => ({ channel: 'marketplace.math.live.fernandez' }))
        },
        publish: vi.fn(async () => ({ published: true })),
        token: {
          issue: vi.fn(async () => ({ token: 'demo-token' }))
        }
      }
    } as unknown as InfraiClient;

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

    expect(infrai.realtime.channel.create).toHaveBeenCalledWith({
      channel: 'marketplace.math.live.fernandez',
      type: 'presence',
      vendor: 'ably'
    });
    expect(infrai.realtime.publish).toHaveBeenCalledWith({
      channel: 'marketplace.math.live.fernandez',
      event: 'order.handoff',
      data: expect.objectContaining({
        handoff_id: 'order_2026_04:buyer_olivia',
        seller_id: 'seller_fernandez',
        seats_remaining: 2,
        state: 'matched'
      }),
      account_id: 'buyer_olivia'
    });
    expect(infrai.realtime.token.issue).toHaveBeenCalledWith({
      client_id: 'buyer_olivia',
      channels: ['marketplace.math.live.fernandez'],
      capabilities: ['subscribe', 'presence'],
      ttl_seconds: 1800
    });
    expect(result).toEqual({
      orderId: 'order_2026_04',
      buyerId: 'buyer_olivia',
      sellerId: 'seller_fernandez',
      roomChannel: 'marketplace.math.live.fernandez',
      buyerRealtimeToken: { token: 'demo-token' }
    });
  });
});
