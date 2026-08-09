# ED-Backend — Changes Summary

Ye poora backend code hai, saari nayi changes ke saath.
`node_modules`, `.git` aur `.env` zip me nahi hain — apna purana `.env` use karna.

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
node scripts/backfillBills.js
```

Purane invoices ke liye bill invoices bana dega.
Idempotent hai — kitni baar bhi chalao, duplicate nahi banenge.

---

## NAYI FILES

| File | Kya hai |
|---|---|
| `src/models/BillInvoice.js` | Bill invoice model (BILL-B / BILL-S) |
| `src/services/billService.js` | Roz ke bills generate karne ki service |
| `src/controllers/admin/adminSupplierOutstanding.js` | Supplier outstanding — day/supplier/invoice drill-down + export |
| `src/controllers/admin/adminBuyerOutstanding.js` | Buyer outstanding — wahi flow, mirror |
| `src/routes/admin/buyerOutstanding.route.js` | Buyer outstanding routes |
| `src/config/uploadRules.js` | Upload size + extensions — single source of truth |
| `scripts/backfillBills.js` | Purane data ke liye bills (ek baar chalana hai) |

## BADLI HUI FILES

| File | Kya badla |
|---|---|
| `index.js` | Buyer outstanding router mount, `GET /api/upload-rules`, multer errors ka saaf message |
| `src/cron/biddingCron.js` | Emails se pehle daily bills generate, won email ko bill number pass |
| `src/utils/sendEmail.js` | Won email me Bill No. header + har row me item invoice number |
| `src/models/invoice.js` | 2 naye optional fields: `billInvoiceId`, `billNumber` |
| `src/middleware/multer.js` | Shared rules se chalta hai, ab `uploadDocument` bhi export (PDF allowed) |
| `src/controllers/admin/adminSupplierPayment.js` | `pay` endpoint ab optional `branchId` leta hai (single supplier release) |
| `src/routes/admin/supplierPayments.js` | 3 naye routes add |
| `src/routes/company.js` | Documents ab PDF accept karte hain (bug fix) |
| `src/routes/branchRoutes.js` | Contract/PDC ab shared rules use karte hain |
| `src/routes/payment.js` | Receipt upload shared rules pe |
| `src/routes/returnRoutes.js` | Return photos shared rules pe |

---

## Bill Invoice System

| | Item Invoice (pehle se tha) | Bill Invoice (naya) |
|---|---|---|
| Buyer | `INV-B-20260806-0004` | `BILL-B-20260806-0001` |
| Supplier | `INV-S-20260806-0004` | `BILL-S-20260806-0001` |
| Kya hai | per buyer-order | us din ke saare invoices ka header |
| Kab banta | bidding won hone pe | bidding cron ke END me, roz |

- **Buyer bill** = buyer se paisa LENA. Outstanding statement isi number pe print hota hai.
- **Supplier bill** = supplier ko paisa DENA. Payment Advice isi number pe print hota hai.
- Sequence har din reset hoti hai (`-0001` se shuru).
- Purane invoices pe `billNumber` null rahega — koi migration nahi chahiye.

> **Safety:** `generateDailyBills()` kabhi throw nahi karti. Bill banna fail bhi ho jaye
> to bidding, invoices aur emails pehle jaise hi chalte rahenge.

---

## NAYE API ENDPOINTS

```
GET  /api/admin/supplier-payments/days/:date/suppliers
GET  /api/admin/supplier-payments/days/:date/suppliers/:branchId
GET  /api/admin/supplier-payments/outstanding/export
POST /api/admin/supplier-payments/pay          ← ab optional { branchId } bhi leta hai

GET  /api/admin/buyer-outstanding/days
GET  /api/admin/buyer-outstanding/days/:date/buyers
GET  /api/admin/buyer-outstanding/days/:date/buyers/:branchId
GET  /api/admin/buyer-outstanding/export

GET  /api/upload-rules                          ← public
```

---

## UPLOAD RULES

| Kind | Extensions | Max |
|---|---|---|
| `image` | JPG, JPEG, PNG, WEBP | 5 MB |
| `document` | **PDF**, JPG, JPEG, PNG, WEBP | 10 MB |

Change karna ho to sirf `src/config/uploadRules.js` edit karna
(aur admin panel ka `src/config/uploadRules.js` bhi same rakhna).

**Bug jo fix hua:** company documents (trade license / QID) aur branch contract
sirf image accept karte the — PDF pe error aata tha. Ab PDF chalega.

---

## KYA NAHI TOOTA

Ye sab bilkul untouched hain:

- `GET /api/admin/buyer-payments` aur `/:branchId`
- `GET /api/admin/supplier-payments/days/:date/bulk-orders`
- `GET /api/admin/supplier-payments/suppliers`
- `POST /api/admin/supplier-payments/pay` — bina `branchId` ke behaviour same

Naye endpoints alag paths pe hain, purane waise ke waise chal rahe hain.

**Verification:** saari files `node --check` pass, saare relative `require()` paths resolve verify kiye.
