// Create a file named index.js and paste this code. 
// This script will receive the Shopify "Order Paid" notification and create a record in your Airtable Subscriptions table.
const express = require('express');
const Airtable = require('airtable');
const app = express();

// 1. Setup Airtable Connection
// Get these from your Airtable account/base settings
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

app.use(express.json());

// 2. The Webhook Endpoint
app.post('/webhooks/subscription-paid', async (req, res) => {
    try {
        const orderData = req.body;

        // Extracting data from Shopify Webhook (Order Paid)
        const customerEmail = orderData.customer.email;
        const customerName = `${orderData.customer.first_name} ${orderData.customer.last_name}`;
        const shopifyOrderId = orderData.id.toString();
        
        // Logic to calculate next billing (30 days from now)
        const today = new Date();
        const nextBilling = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        console.log(`Processing subscription for: ${customerEmail}`);

        // 3. Create Record in Airtable "Subscriptions" Table
        await base('Subscriptions').create([
            {
                "fields": {
                    "Customer": customerName, // Note: Use Record IDs if linking tables
                    "Status": "Active",
                    "Start Date": today.toISOString().split('T')[0],
                    "Next Billing Date": nextBilling.toISOString().split('T')[0],
                    "Shopify Subscription ID": shopifyOrderId
                }
            }
        ]);

        res.status(200).send('Success');
    } catch (error) {
        console.error('Airtable Error:', error);
        res.status(500).send('Error updating Airtable');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));