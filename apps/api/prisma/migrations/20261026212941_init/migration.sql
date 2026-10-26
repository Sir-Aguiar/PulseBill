-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'BRL', 'EUR');

-- CreateEnum
CREATE TYPE "Metric" AS ENUM ('API_CALLS', 'TOKENS', 'STORAGE_GB');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('METERING', 'CLOSING', 'INVOICED', 'PAID', 'PAST_DUE', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "taxId" TEXT,
    "billingAddress" TEXT,
    "currency" "Currency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "basePriceUsd" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricPrice" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "metric" "Metric" NOT NULL,
    "unitPriceUsd" DECIMAL(18,8) NOT NULL,
    "includedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "invoiceId" UUID,
    "metric" "Metric" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageDailyRollup" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "metric" "Metric" NOT NULL,
    "day" DATE NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageDailyRollup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "number" TEXT,
    "customerId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "currency" "Currency" NOT NULL,
    "planName" TEXT,
    "baseFeeUsd" DECIMAL(12,4),
    "usageSubtotalUsd" DECIMAL(12,4),
    "subtotalUsd" DECIMAL(12,4),
    "taxJurisdiction" TEXT,
    "taxRate" DECIMAL(8,6),
    "taxAmountUsd" DECIMAL(12,4),
    "taxAmountLocal" DECIMAL(12,4),
    "exchangeRate" DECIMAL(18,8),
    "exchangeRateQuotedAt" TIMESTAMP(3),
    "exchangeRateSource" TEXT,
    "exchangeRateFallback" BOOLEAN NOT NULL DEFAULT false,
    "totalLocal" DECIMAL(12,4),
    "pdfStorageUrl" TEXT,
    "pdfHash" TEXT,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "metric" "Metric" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "includedQuantity" DECIMAL(18,4) NOT NULL,
    "billableQuantity" DECIMAL(18,4) NOT NULL,
    "unitPriceUsd" DECIMAL(18,8) NOT NULL,
    "amountUsd" DECIMAL(12,4) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceStatusHistory" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "fromStatus" "InvoiceStatus",
    "toStatus" "InvoiceStatus" NOT NULL,
    "reason" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalPaymentId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookLog" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "invoiceId" UUID,
    "paymentId" UUID,
    "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "rawPayload" JSONB NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "MetricPrice_planId_metric_effectiveFrom_idx" ON "MetricPrice"("planId", "metric", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Subscription_customerId_startsAt_idx" ON "Subscription"("customerId", "startsAt");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "UsageLog_customerId_recordedAt_idx" ON "UsageLog"("customerId", "recordedAt");

-- CreateIndex
CREATE INDEX "UsageLog_invoiceId_idx" ON "UsageLog"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageLog_customerId_idempotencyKey_key" ON "UsageLog"("customerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "UsageDailyRollup_customerId_day_idx" ON "UsageDailyRollup"("customerId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "UsageDailyRollup_customerId_metric_day_key" ON "UsageDailyRollup"("customerId", "metric", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_status_dueAt_idx" ON "Invoice"("status", "dueAt");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_customerId_periodStart_key" ON "Invoice"("customerId", "periodStart");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceStatusHistory_invoiceId_createdAt_idx" ON "InvoiceStatusHistory"("invoiceId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_externalPaymentId_key" ON "Payment"("provider", "externalPaymentId");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_invoiceId_idx" ON "PaymentWebhookLog"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_paymentId_idx" ON "PaymentWebhookLog"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookLog_provider_externalEventId_key" ON "PaymentWebhookLog"("provider", "externalEventId");

-- AddForeignKey
ALTER TABLE "MetricPrice" ADD CONSTRAINT "MetricPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageDailyRollup" ADD CONSTRAINT "UsageDailyRollup_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceStatusHistory" ADD CONSTRAINT "InvoiceStatusHistory_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookLog" ADD CONSTRAINT "PaymentWebhookLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookLog" ADD CONSTRAINT "PaymentWebhookLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
