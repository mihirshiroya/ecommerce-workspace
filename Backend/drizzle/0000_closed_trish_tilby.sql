CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"firstName" text,
	"lastName" text,
	"isEmailVerified" boolean DEFAULT false,
	"isActive" boolean DEFAULT true,
	"role" text DEFAULT 'USER',
	"provider" text DEFAULT 'LOCAL',
	"googleId" text,
	"avatar" text,
	"lastLoginAt" timestamp,
	"emailVerifiedAt" timestamp,
	"passwordResetToken" text,
	"passwordResetExpires" timestamp,
	"emailVerificationToken" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text,
	"userId" text,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now(),
	"isRevoked" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "seller_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"marketplace" text,
	"name" text,
	"seller_id" text,
	"business_name" text,
	"contact_email" text,
	"address" text,
	"notes" text,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "global_skus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"sku" text,
	"name" text,
	"category" text,
	"description" text,
	"notes" text,
	"attributes" jsonb,
	"images" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "account_sku_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"global_sku_id" uuid,
	"account_id" uuid,
	"account_sku" text,
	"marketplace_ref" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "listing_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"template_key" text,
	"data" jsonb,
	"revision" integer DEFAULT 1,
	"status" text DEFAULT 'draft',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "listing_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"draft_id" uuid,
	"account_id" uuid,
	"batch_id" uuid,
	"filename" text,
	"template_key" text,
	"template_hash" text,
	"snapshot" jsonb,
	"file_base64" text,
	"checksum" text,
	"row_count" integer,
	"size" integer,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"action" text,
	"entity_type" text,
	"entity_id" text,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now()
);
