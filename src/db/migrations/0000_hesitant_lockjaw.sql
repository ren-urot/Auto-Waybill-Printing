CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"company_logo_url" text,
	"company_address" text,
	"tax_info" text,
	"default_paper_size" text DEFAULT '4x6' NOT NULL,
	"default_courier" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"platform_order_id" text NOT NULL,
	"order_number" text NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text,
	"address" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"courier" text,
	"tracking_number" text,
	"shipping_fee" numeric,
	"payment_method" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"raw_payload" jsonb,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_ids" jsonb NOT NULL,
	"printed_by" text NOT NULL,
	"paper_size" text NOT NULL,
	"document_type" text NOT NULL,
	"printed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"platform" text DEFAULT 'shopify' NOT NULL,
	"shop_domain" text NOT NULL,
	"access_token" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_store_platform_order_idx" ON "orders" USING btree ("store_id","platform_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_shop_domain_idx" ON "stores" USING btree ("shop_domain");