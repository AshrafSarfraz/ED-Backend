# Inventory Module — v2

## Kya badla

| Pehle | Ab |
|---|---|
| Ingredient har menu item me manually type | `Ingredient` master collection — ek dafa banao, list se select karo |
| Logic routes ke andar | `controllers/` alag, routes sirf mapping |
| Usage `item.name` se match | `menuItem` ObjectId se match |
| Recipe badla → purani report bhi badal gayi | Invoice me recipe ka **snapshot** |
| Client `price`/`subtotal` bhejta tha | Server DB se price uthata hai |
| `invoiceNumber` random (collision) | Atomic counter, per-branch per-day |
| `new Date(y, m, 1)` (UTC server) | Qatar timezone (UTC+3) aware |
| `g` aur `kg` alag rows | Base unit me normalize |
| Hard delete | Soft delete + reference check |

---

## Install

```bash
npm i multer          # sirf CSV file upload ke liye
```

`multer` na ho to bhi chalega — bas JSON body me `{ csv: "..." }` bhejna hoga.

## Mount

```js
// server.js
app.use(express.json({ limit: '256kb' }));
app.use('/api', require('./inventory'));
```

Routes ban jayenge:
- `/api/ingredients`
- `/api/menu-items`
- `/api/invoices`
- `/api/usage`

## .env

```
BUSINESS_TZ_OFFSET=3     # Qatar UTC+3
NODE_ENV=production
```

---

## ⚠️ Migration — pehle ye chalao

Purana `invoiceNumber` index **global unique** tha. Naya per-branch hai. Mongo shell / Compass me:

```js
db.invoices.dropIndex('invoiceNumber_1')
```

Purani `menuitems` me `ingredients` (free text) tha, ab `recipe` (ObjectId) hai. Do options:

**A. Fresh start** — `db.menuitems.deleteMany({})`, phir CSV se ingredients upload kar ke menu dobara banao.

**B. Migrate script** — purane naam se Ingredient banao, phir link karo. Bolo to likh deta hoon.

Purani invoices safe hain — usage controller unke liye current recipe se fallback karta hai.

---

## API

### Ingredients

```
GET    /api/ingredients?search=chic&category=Meat&page=1&limit=50
GET    /api/ingredients/template          → sample CSV download
POST   /api/ingredients                   { name, unit, category, costPerUnit }
PUT    /api/ingredients/:id               { name, unit, category, costPerUnit }
DELETE /api/ingredients/:id[?force=true]
POST   /api/ingredients/bulk[?force=true]
```

**Units:** `mg` `g` `kg` `ml` `litre` `pcs`

**Bulk CSV format:**

```csv
name,unit,category,costPerUnit
Chicken Breast,kg,Meat,18.5
Mozzarella Cheese,kg,Dairy,26
Fresh Milk,litre,Dairy,4.25
Burger Bun,pcs,Bakery,0.75
```

Bulk ke teen tareeke:
```js
// 1. multipart
const fd = new FormData(); fd.append('file', file);
axios.post('/api/ingredients/bulk', fd)

// 2. raw text
axios.post('/api/ingredients/bulk', { csv: csvString })

// 3. already parsed
axios.post('/api/ingredients/bulk', { rows: [{ name, unit, category, costPerUnit }] })
```

**Bulk = REPLACE mode.** CSV me jo nahi hai wo DB se delete ho jayega.

Lekin: matching **naam se** hoti hai, isliye jo ingredient CSV me dobara aata hai uska `_id` wahi rehta hai → menu recipes nahi tootti.

Agar upload kisi recipe ko torne wala ho to **409** aata hai:

```json
{
  "message": "Ye upload kuch menu recipes tod dega. Confirm karne ke liye ?force=true bhejo",
  "details": {
    "menuItemsAffected": [{ "name": "Chicken Burger", "ingredients": ["Lettuce"] }],
    "willDelete": ["Lettuce", "Pickle"],
    "unitFamilyChanged": []
  }
}
```

Frontend pe ye modal me dikhao → user "Confirm" kare → dobara `?force=true` ke saath bhejo. **Ye hi flow use karo, blindly force mat bhejna.**

### Menu Items

```
GET    /api/menu-items?search=&category=&active=true
GET    /api/menu-items/:id      → recipe + live cost + margin%
POST   /api/menu-items
PUT    /api/menu-items/:id
DELETE /api/menu-items/:id[?hard=true]
```

```json
POST /api/menu-items
{
  "name": "Chicken Burger",
  "price": 25,
  "category": "Burgers",
  "recipe": [
    { "ingredient": "66f1a...", "quantity": 150, "unit": "g" },
    { "ingredient": "66f1b...", "quantity": 1,   "unit": "pcs" }
  ]
}
```

- `ingredient` = Ingredient ka `_id` (dropdown se)
- `unit` optional — na do to ingredient ki apni unit
- unit family match honi chahiye (`g` track hai to `kg`/`mg` chalega, `ml` nahi)

`GET /:id` response me:
```json
{ "ingredientCost": 8.42, "margin": 16.58, "marginPercent": 66.3 }
```

### Invoices

```
GET  /api/invoices?page=1&limit=50&month=2026-03&search=ahmed
GET  /api/invoices/:id
POST /api/invoices
```

**Naya body — sirf id + qty:**

```json
{
  "customerName": "Ahmed",
  "tax": 0,
  "items": [
    { "menuItem": "66f2a...", "quantity": 2 },
    { "menuItem": "66f2b...", "quantity": 1 }
  ]
}
```

`price` / `subtotal` bhejne ki zaroorat nahi — server DB se uthata hai. Bhej bhi do to ignore honge.

Response me `ingredientCost` (COGS) bhi milta hai.

### Usage

```
GET /api/usage?month=2026-03
GET /api/usage?from=2026-03-01&to=2026-03-31
```

```json
{
  "ingredients": [
    {
      "name": "Chicken Breast",
      "category": "Meat",
      "quantity": 12.5,
      "unit": "kg",
      "baseQuantity": 12500,
      "baseUnit": "g",
      "estimatedCost": 231.25,
      "deleted": false,
      "usedInItems": [{ "menuItem": "Chicken Burger", "qtySold": 60 }]
    }
  ],
  "totalInvoices": 143,
  "totalIngredientCost": 4180.5,
  "unmatchedItems": 0
}
```

`unmatchedItems > 0` = kuch bechi hui dishes ki recipe nahi mili.

---

## Security fixes

- **Branch isolation** — har route pe `protectBranch`, har query me `branch: req.branch._id`. Cross-branch id bhejo to 404/400.
- **NoSQL injection** — sab input `sanitize.js` se guzarta hai. `?month[$ne]=null` object aaye to reject.
- **Mass assignment** — controllers sirf whitelisted fields lete hain, `req.body` seedha model me nahi jata.
- **Price tampering** — server-side pricing.
- **Regex DoS** — search input escape hota hai.
- **Payload limits** — CSV 2MB, 5000 rows, 200 line items, 100 recipe lines, pagination max 200.
- **Stack traces** — production me leak nahi hote.

Bacha hua kaam (module ke bahar): `express-rate-limit`, `helmet`, aur `protectBranch` me JWT expiry check.

---

## Abhi bhi missing: stock balance

Ye system sirf **consumption** batata hai. Freezer me kitna bacha hai — wo nahi.

Uske liye chahiye `Purchase` model + `StockCount` model:

```
Opening + Purchases − Usage = Expected
Expected − Physical count   = Wastage / chori
```

Bolo to next me bana deta hoon.
