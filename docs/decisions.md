# Architecture Decision Records

## ADR-1: Two-service architecture

**Context:** The product has wardrobe CRUD and usage/analytics concerns.

**Decision:** Keep clothing CRUD and persistence in the wardrobe service. Keep wear history and derived wear statistics in the outfit service.

**Alternatives:** A single application and database would be simpler, but it would not meet the required split and would make partial failure less observable.

**Consequences:** Services communicate over HTTP and can be deployed independently. The outfit service stores item IDs, not duplicated item data.

## ADR-2: Partial failure

**Context:** The outfit service needs wardrobe item data for cost-per-wear and unworn calculations.

**Decision:** Calls from the outfit service use a 3-second timeout. Network, timeout, and wardrobe HTTP failures return HTTP 503 with `wardrobe unavailable, try again later`.

**Alternatives:** Long synchronous calls could hang requests. Caching may hide stale data but would complicate ownership and invalidation.

**Consequences:** Wear logging remains independent because it stores only item IDs. The wardrobe service's CRUD remains usable while outfit statistics are unavailable.
