# ED-Backend — Proxy Bidding

Ye poora backend code hai proxy bidding ke saath.
`node_modules`, `.git` aur `.env` zip me nahi hain — apna purana `.env` use karna
(`.env.example` reference ke liye rakh diya hai).

---

## Setup

```bash
npm install
npm run dev      # ya npm start
```

Koi naya npm package nahi chahiye — `package.json` bilkul pehle jaisa hai.

---

## Deploy ke baad EK BAAR ye chalana hai

```bash
node scripts/migrateBidsToProxy.js
```

⚠️ **Sirf tab chalao jab koi bidding LIVE na ho** — winner cron ke baad aur agle
din ke bidding start se pehle. Script khud bhi check karti hai; koi live bidding
mili to rok deti hai.

Idempotent hai — kitni baar bhi chalao, dobara migrate nahi karegi.

---

## Kya badla — ek line me

Supplier ab **price** nahi bhejta. Supplier **join** karta hai (uski catalog rate
uski opening bid ban jaati hai) aur optionally apni **max bid** deta hai — yaani
"is se neeche main nahi jaunga". Ye number **private** hai. System uske behalf pe
khud bid karta rehta hai, sirf utna neeche jaata hai jitna doosre ko harane ke
liye chahiye.

---

## Core rule

```
sort: maxBid ascending → phir joinedAt ascending

0 participants → currentBid = null
1 participant  → currentBid = uski openBid (catalog rate)
                 ← uski maxBid NAHI. Muqabla hi nahi to margin kyun de?
2+             → leader   = sorted[0]
                 runnerUp = sorted[1]
                 currentBid = max( leader.maxBid, runnerUp.maxBid − 0.01 )
                 phir clamp: min( currentBid, leader.openBid )
```

Do clamps zaroori hain:

- `max(...)` → leader kabhi apni floor se neeche nahi jaata
- `min(...)` → bid kabhi leader ki opening se upar nahi jaati

Tie pe **jo pehle join hua** wo jeetta hai. `joinedAt` freeze rehta hai — max
lower karne pe nahi badalta.

---

## NAYI FILES

| File | Kya hai |
|---|---|
| `src/services/biddingEngine.js` | `recompute()` + per-bidding lock. `currentBid` sirf yahan se likhi jaati hai |
| `src/models/BidHistory.js` | Append-only audit log — har join / har max change |
| `scripts/migrateBidsToProxy.js` | Purani bids ko naye shape me (ek baar chalana hai) |
| `.env.example` | Env template |

## BADLI HUI FILES

| File | Kya badla |
|---|---|
| `src/models/Bid.js` | `pricePerUnit` → `openBid` + `maxBid` + `joinedAt`. Status `active/won/lost/missed`. 2 naye index |
| `src/models/BulkOrder.js` | `currentBid`, `currentLeaderId`, `recomputing`, `reminderSentAt` + 2 index |
| `src/models/supplier/supplierCatalog.js` | Eligibility index add — pehle wala index use hi nahi ho raha tha |
| `src/controllers/supplier/bids.js` | Poora rewrite — `join` / `max` / `active` / `my-bids` |
| `src/routes/supplier/bids.js` | Naye routes; purane `/place` aur `/ignore` ab 410 dete hain saaf message ke saath |
| `src/cron/biddingCron.js` | Winner select rewrite, reminder cron, `recordMissedBids` fix, `biddingEndsAt` filter |
| `src/cron/settingService.js` | `BIDDING_REMINDER_MINUTES` (default 10) + `getWindowMinutes()` |
| `src/notification/notificationService.js` | 2 naye triggers — `notifyOutbid`, `notifyBiddingClosingSoon` |
| `src/routes/admin/timeSetting.js` | **SECURITY** — chaaron routes pe auth (pehle bilkul open the) |
| `src/controllers/admin/adminBulkOrderController.js` | maxBid sirf bidding band hone ke baad dikhti hai |
| `src/controllers/buyer/buyerOrder.js` | Live rate ab `BulkOrder.currentBid` se |
| `src/controllers/supplier/SupplierOrder.js` | `myPrice` ab `maxBid` |
| `src/controllers/admin/supplierProfile.js` | Naya `active` counter |
| `index.js` | Cron scheduling ab retry karti hai — Mongo slow ho to server nahi marta |

---

## NAYE API ENDPOINTS

```
POST /api/supplier/bids/join    { bulkOrderId, maxBid? }   ← maxBid optional
POST /api/supplier/bids/max     { bulkOrderId, maxBid }    ← sirf NEECHE
GET  /api/supplier/bids/active
GET  /api/supplier/bids/my-bids

POST /api/supplier/bids/place   → 410 Gone (purana app build ke liye)
POST /api/supplier/bids/ignore  → 410 Gone
```

Har response me:

```json
{
  "currentBid": 4.99,
  "youAreLeading": true,
  "yourMaxBid": 4.80,
  "yourOpenBid": 7.00,
  "participantCount": 3,
  "minutesRemaining": 24
}
```

> ⚠️ **Kisi DOOSRE supplier ki `maxBid` kabhi kisi response, email, ya export me
> nahi jaati.** Poore mechanism ki jaan yahi hai. Naya code likhte waqt ye rule
> tornaa nahi.

---

## NOTIFICATIONS — 2 naye

**1. `notifyOutbid` — real-time.** Jab bhi lead badalti hai, purane leader ko
turant push. Ye reminder se **zyada ahem** hai: supplier apni max set kar ke
chala jaata hai, agar usay pata hi na chale ke wo peeche ho gaya to poora
mechanism bekaar hai.

**2. `notifyBiddingClosingSoon` — bidding band hone se 10 min pehle.** Teen
audience, har supplier ko **ek** hi push chahe uski 5 biddings chal rahi hon:

| Audience | Message |
|---|---|
| Joined, peeche | "You're behind on N biddings — lower your max bid" |
| Eligible, join nahi kiya | "N biddings open — last chance to join" |
| Joined, leading | "You're leading on N — nothing to do" |

`reminderSentAt` se idempotent hai — cron retry ya restart pe dobara nahi jaayegi.

---

## ⚠️ WINDOW KA MASLA

Abhi window **13 minute** ka hai (15:45 → 15:58). Reminder 15:48 pe chalega —
yaani bidding khulne ke sirf **3 minute** baad. Supplier ke paas react karne ka
waqt nahi hoga.

Code ye handle karta hai:

- Window `reminderMinutes` se chhota ho → reminder schedule hi nahi hoti, console pe warning
- Window `reminderMinutes + 15` se chhota ho → schedule hoti hai lekin warning aati hai

Testing ke liye theek hai. Production me window **45–60 minute** karna hoga,
warna sniping (aakhri lamhe pe lead cheenna) rozana hoga.

Change karne ke liye: `PUT /api/admin/bidding-settings` ya `settingService.js`
ke `DEFAULTS`.

---

## SAATH ME JO FIX HUA

| Masla | Ab |
|---|---|
| `/api/admin/settings/*` pe **koi auth nahi thi** — koi bhi bidding timings badal sakta tha | `protectAdmin` + `adminOnly` |
| `placeBid` negative price accept karta tha (`-5` har bidding jeet jaata) | `Number.isFinite` + `> 0` + upper bound |
| Tie pe winner **random** tha (`sort({pricePerUnit:1})` bina secondary sort) | `sort({ maxBid, joinedAt })` — deterministic |
| `getMyRank` price se match karta tha, `_id` se nahi — tied bidders sab ko rank 1 | Function hata diya; `youAreLeading` kaafi hai |
| Eligibility ki **3 alag definitions** — `placeBid` sirf `isListed`, baaki dono | Ek helper, sab jagah `isListed` **aur** `isAvailableToday` |
| `recordMissedBids` unavailable supplier ko bhi "missed" mark karta tha | Join gate wala filter; N+1 bhi khatam (2N → 3 query) |
| `runWinnerSelect` me `biddingEndsAt` filter **nahi** tha — live bidding award ho sakti thi | Filter add |
| `supplierCatalog` ka index `branchId` se shuru — bidding queries me use hi nahi hota tha | Naya index `{platformItemId, countryId, isListed, isAvailableToday}` |
| `getActiveBiddings` me ~6 query per bulk order (main supplier screen) | 3 query total |
| Buyer email me `1.03` hardcoded tha — commission % badle to galat rate jaata | Actual settings se |
| Mongo boot pe slow ho to `scheduleCrons()` unhandled rejection → **poora server mar jaata** | Retry with backoff, API chalti rehti hai |

---

## ABHI BHI BAAKI HAI

Ye zip me **nahi** hai — alag se karna hoga:

1. **Cron lock (multi-instance).** Do server instance chalein to dono ka winner
   cron fire karega. In-memory `_invoiceCounter` alag hoga → duplicate invoice
   number → bulk order aadha process. Per-day lock document chahiye.
   `InventoryManagement/models/Counter.js` wala atomic pattern already aapka
   likha hua hai — wahi use kar lein.

2. **Window barhana** (upar dekhein).

3. **App side confirmation.** Max bid sirf neeche ja sakti hai, undo nahi hai.
   Koi `4.50` ki jagah `0.45` type kar de to wo phansa hua hai. Join screen pe
   warning chahiye jab entered max catalog rate se bohat neeche ho.

4. **`isAvailableToday` reset.** Naam "today" hai lekin koi daily cron isay reset
   nahi karta. Supplier ne ek din unavailable kiya to hamesha ke liye hai.

---

## VERIFICATION

- Saari 143 files `node --check` pass
- Saare relative `require()` paths resolve verify kiye
- Server boot test pass (Express start hota hai, saare routes mount hote hain)
- **`recompute()` algorithm 14/14 walk-through steps pe exact match** — including
  dono tie cases (15:40, 17:10, 17:58) aur float safety (`4.90 − 0.01` → `4.89`,
  raw JS `4.890000000000001` deta hai)

Live DB ke saath integration test **nahi** ho saka (is environment me Mongo
binary available nahi tha). Mongoose-level behaviour — indexes actually build
hona, `findOneAndUpdate` lock ka concurrent behaviour — apne staging pe verify
kar lena, khaas taur pe **do supplier ek saath max bid** wala case.
