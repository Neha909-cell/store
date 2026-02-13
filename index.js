// Create a file named index.js and paste this code. 
// This script will receive the Shopify "Order Paid" notification and create a record in your Airtable Subscriptions table.
const express = require("express");
const Airtable = require("airtable");
const crypto = require("crypto");

const app = express();

// IMPORTANT: use raw body for Shopify HMAC verification
app.use(express.raw({ type: "application/json" }));

// Airtable setup
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

/* =====================================================
   1️⃣ VERIFY SHOPIFY WEBHOOK (HMAC SECURITY)
===================================================== */
function verifyShopifyWebhook(req) {
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];
  const generatedHash = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(req.body, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(generatedHash),
    Buffer.from(hmacHeader)
  );
}

/* =====================================================
   2️⃣ WEBHOOK ENDPOINT
===================================================== */
app.post("/webhooks/subscription-paid", async (req, res) => {
  try {
    // 🔐 Step 1: Verify HMAC
    if (!verifyShopifyWebhook(req)) {
      console.log("❌ HMAC Verification Failed");
      return res.status(401).send("Unauthorized");
    }

    // Convert raw body to JSON AFTER verification
    const orderData = JSON.parse(req.body.toString());

    const customerEmail = orderData.customer.email;
    const customerName = `${orderData.customer.first_name} ${orderData.customer.last_name}`;
    const shopifyOrderId = orderData.id.toString();

    console.log("Processing:", customerEmail);

    /* =====================================================
       3️⃣ SEARCH CUSTOMER BY EMAIL
    ===================================================== */
    const existingCustomers = await base("Customers")
      .select({
        filterByFormula: `{Email} = "${customerEmail}"`,
        maxRecords: 1,
      })
      .firstPage();

    let customerRecordId;

    if (existingCustomers.length > 0) {
      // ✅ Customer Exists
      customerRecordId = existingCustomers[0].id;
      console.log("Customer found:", customerRecordId);
    } else {
      // ➕ Create New Customer
      const newCustomer = await base("Customers").create({
        Name: customerName,
        Email: customerEmail,
      });

      customerRecordId = newCustomer.id;
      console.log("New customer created:", customerRecordId);
    }

    /* =====================================================
       4️⃣ CREATE SUBSCRIPTION (LINKED RECORD)
    ===================================================== */

    const today = new Date();
    const nextBilling = new Date(
      today.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    await base("Subscriptions").create({
      Customer: [customerRecordId], // 🔥 MUST be array of record IDs
      Status: "Active",
      "Start Date": today.toISOString().split("T")[0],
      "Next Billing Date": nextBilling.toISOString().split("T")[0],
      "Shopify Subscription ID": shopifyOrderId,
    });

    console.log("✅ Subscription created");

    res.status(200).send("Success");
  } catch (error) {
    console.error("❌ ERROR:", error);
    res.status(500).send("Server Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
