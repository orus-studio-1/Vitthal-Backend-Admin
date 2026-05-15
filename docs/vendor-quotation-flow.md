# Vendor Quotation Flow

Base route: `/api/quotations`

## Admin creates and emails a quotation

Endpoint:

```http
POST /api/quotations/admin
Cookie: refreshToken/accessToken
Content-Type: application/json
```

Payload:

```json
{
  "vendorId": "vendor-uuid",
  "title": "Copper wire rod quotation",
  "quantity": 1000,
  "unit": "kg",
  "targetPrice": 720,
  "requestedMoq": 500,
  "requestNotes": "Need commercial quote, lead time, and packaging details.",
  "validityDate": "2026-05-30T00:00:00.000Z"
}
```

Optional:

```json
{
  "adminSignatureData": "data:image/png;base64,..."
}
```

Response:

```json
{
  "message": "Quotation created and emailed to vendor successfully.",
  "data": {
    "quotation": {
      "id": "quotation-uuid",
      "quotation_number": "VQ-1747370000000",
      "vendor_id": "vendor-uuid",
      "created_by_admin_id": "admin-uuid",
      "sent_to_email": "vendor@example.com",
      "title": "Copper wire rod quotation",
      "quantity": 1000,
      "unit": "kg",
      "target_price": 720,
      "requested_moq": 500,
      "request_notes": "Need commercial quote, lead time, and packaging details.",
      "validity_date": "2026-05-30T00:00:00.000Z",
      "status": "sent"
    },
    "vendorLink": "http://localhost:4000/vendor-quotation?token=..."
  }
}
```

## Admin list/detail/review

Endpoints:

```http
GET /api/quotations/admin
GET /api/quotations/admin/:id
GET /api/quotations/admin/:id/pdf
PUT /api/quotations/admin/:id/review
```

Review payload:

```json
{
  "decision": "approved",
  "adminReviewNotes": "Accepted vendor pricing and delivery conditions."
}
```

Allowed decisions:

- `approved`
- `rejected`

Final statuses:

- `admin_approved`
- `admin_rejected`

## Vendor secure page

Load quotation:

```http
GET /api/quotations/vendor/:token
GET /api/quotations/vendor/:token/pdf
```

The frontend should read `token` from the query string and call:

```ts
const token = new URLSearchParams(window.location.search).get("token");
fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/quotations/vendor/${token}`);
```

Approve payload:

```json
{
  "decision": "approved",
  "vendorPrice": 735,
  "vendorMoq": 600,
  "vendorNotes": "Dispatch in 7 working days. Packed in coils.",
  "vendorSignatureData": "data:image/png;base64,..."
}
```

Reject payload:

```json
{
  "decision": "rejected",
  "rejectionReason": "Unable to meet the requested timeline."
}
```

## Suggested frontend states

Admin button states:

- `idle`
- `sending`
- `sent`
- `failed`

Vendor page states:

- `loading`
- `ready`
- `submitting`
- `submitted`
- `expired`
- `error`

## Required environment variables

```env
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
VENDOR_QUOTATION_APP_URL=
ADMIN_QUOTATION_APP_URL=
ADMIN_SIGNATURE_DATA_URL=
QUOTATION_TOKEN_TTL_HOURS=
```
