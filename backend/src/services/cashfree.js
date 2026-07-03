import crypto from "node:crypto";
import { config } from "../config.js";

function getCashfreeBaseUrl() {
  return config.cashfree.env === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

function getCashfreeHeaders() {
  return {
    "Content-Type": "application/json",
    "x-client-id": config.cashfree.appId,
    "x-client-secret": config.cashfree.secretKey,
    "x-api-version": config.cashfree.apiVersion,
  };
}

/**
 * Create a Cashfree order for subscription payment.
 */
export async function createCashfreeOrder({
  orderId,
  orderAmount,
  orderCurrency = "INR",
  customerDetails,
  orderMeta,
  orderNote,
}) {
  const url = `${getCashfreeBaseUrl()}/orders`;

  const body = {
    order_id: orderId,
    order_amount: orderAmount,
    order_currency: orderCurrency,
    customer_details: {
      customer_id: customerDetails.customerId,
      customer_email: customerDetails.customerEmail || undefined,
      customer_phone: customerDetails.customerPhone || "9999999999",
      customer_name: customerDetails.customerName || undefined,
    },
    order_meta: {
      return_url: orderMeta?.returnUrl || `${config.appBaseUrl}/subscription?order_id={order_id}`,
      notify_url: orderMeta?.notifyUrl || `${config.appBaseUrl}/api/subscription/webhook`,
    },
    order_note: orderNote || "MediStock Subscription Payment",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: getCashfreeHeaders(),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Cashfree createOrder error:", JSON.stringify(data));
    throw new Error(data.message || "Failed to create Cashfree order");
  }

  return {
    orderId: data.order_id,
    paymentSessionId: data.payment_session_id,
    orderStatus: data.order_status,
    cfOrderId: data.cf_order_id,
  };
}

/**
 * Get order status from Cashfree.
 */
export async function getCashfreeOrderStatus(orderId) {
  const url = `${getCashfreeBaseUrl()}/orders/${orderId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getCashfreeHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Cashfree getOrderStatus error:", JSON.stringify(data));
    throw new Error(data.message || "Failed to get order status");
  }

  return data;
}

/**
 * Get payments for an order from Cashfree.
 */
export async function getCashfreeOrderPayments(orderId) {
  const url = `${getCashfreeBaseUrl()}/orders/${orderId}/payments`;

  const response = await fetch(url, {
    method: "GET",
    headers: getCashfreeHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Cashfree getOrderPayments error:", JSON.stringify(data));
    throw new Error(data.message || "Failed to get order payments");
  }

  return data;
}

/**
 * Verify Cashfree webhook signature.
 */
export function verifyCashfreeWebhookSignature(rawBody, timestamp, signature) {
  const secretKey = config.cashfree.secretKey;
  const payload = timestamp + rawBody;
  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(payload)
    .digest("base64");

  return expectedSignature === signature;
}
