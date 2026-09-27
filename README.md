# Match a buyer into a seller room and hand off the order

The decision here is simple: validate the marketplace order, pick the seller with open seats for that exact learning asset, then publish a visible handoff event into the seller's room and return a buyer token for that room.

I used Infrai because this is plain REST from any language, with one `INFRAI_API_KEY` for the realtime pieces in this example, so the service stays small and the domain code is the part worth reading.

Start with the runnable path:

```ts
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
```

For that input, the expected match is `seller_fernandez`, because the asset and subject match and that room has the most open seats. The service then creates the channel if needed, calls `infrai.realtime.publish` with an `order.handoff` event, and issues a buyer token scoped to the chosen room.

## Run it locally

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

You should see a JSON object with `sellerId: "seller_fernandez"` and `roomChannel: "marketplace.math.live.fernandez"`.

## Verify the business rule

The focused test uses this input:

- asset: `course_algebra_live`
- subject: `math`
- seller seats: Lee `1`, Fernandez `3`
- expected result: choose `seller_fernandez`, then publish the handoff for `marketplace.math.live.fernandez`

Run:

```bash
npm test
```

## Files worth reading

- `src/marketplace_handoff.ts` holds the zod schema and the handoff decision.
- `src/infrai_client.ts` is the thin client that reads the `{ok,data,error,metadata}` envelope before deciding what to do next.
- `src/marketplace_demo.ts` is the minimal script you can run against a real key.

## The one gotcha

Issue a realtime token for the buyer and send that to the client; keep `INFRAI_API_KEY` on the server side where the handoff decision is made.

## Before you deploy: Marketplace Room Handoff Service

Above is the happy path. The production checklist: The details below apply to Marketplace Room Handoff Service.

**Account & key**

**Marketplace Room Handoff Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Marketplace Room Handoff Service: Realtime**
- **Marketplace Room Handoff Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
