-- AI Self-Learning System Tables Migration
-- Run this manually in Supabase SQL Editor or via psql

-- 1. AI Interactions - stores all AI conversations for learning
CREATE TABLE IF NOT EXISTS "ai_interactions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "user_message" TEXT NOT NULL,
    "ai_response" TEXT NOT NULL,
    "intent" VARCHAR(64),
    "rating" VARCHAR(16),
    "reaction_emoji" VARCHAR(10),
    "feedback_comment" TEXT,
    "latency_ms" INTEGER,
    "tokens_used" INTEGER,
    "model" VARCHAR(64),
    "prompt_version" VARCHAR(32),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ai_interactions_profile_id_idx" ON "ai_interactions" ("profile_id");
CREATE INDEX IF NOT EXISTS "ai_interactions_rating_idx" ON "ai_interactions" ("rating");
CREATE INDEX IF NOT EXISTS "ai_interactions_intent_idx" ON "ai_interactions" ("intent");
CREATE INDEX IF NOT EXISTS "ai_interactions_created_at_idx" ON "ai_interactions" ("created_at");

-- 2. AI Learned Instructions - auto-generated instructions from feedback
CREATE TABLE IF NOT EXISTS "ai_learned_instructions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "profile_id" UUID,
    "content" TEXT NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "confidence" FLOAT DEFAULT 0.5,
    "success_rate" FLOAT DEFAULT 0.5,
    "usage_count" INTEGER DEFAULT 0,
    "source" VARCHAR(32) NOT NULL,
    "is_active" BOOLEAN DEFAULT TRUE,
    "parent_instruction_id" UUID,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ai_learned_instructions_profile_id_idx" ON "ai_learned_instructions" ("profile_id");
CREATE INDEX IF NOT EXISTS "ai_learned_instructions_active_confidence_idx" ON "ai_learned_instructions" ("is_active", "confidence");
CREATE INDEX IF NOT EXISTS "ai_learned_instructions_category_idx" ON "ai_learned_instructions" ("category");

-- 3. AI Experience Buffer - few-shot learning buffer
CREATE TABLE IF NOT EXISTS "ai_experience_buffers" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "profile_id" UUID UNIQUE NOT NULL,
    "interactions" JSONB DEFAULT '[]',
    "max_size" INTEGER DEFAULT 1000,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "last_cleanup" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AI User Learning Profile - personalization data
CREATE TABLE IF NOT EXISTS "ai_user_learning_profiles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "profile_id" UUID UNIQUE NOT NULL,
    "communication_style" JSONB DEFAULT '{}',
    "topics" JSONB DEFAULT '{}',
    "patterns" JSONB DEFAULT '{}',
    "emotional_patterns" JSONB DEFAULT '{}',
    "last_updated" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AI Failure Patterns - for corrective instruction generation
CREATE TABLE IF NOT EXISTS "ai_failure_patterns" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "confidence" FLOAT DEFAULT 0.5,
    "user_message" VARCHAR(500) NOT NULL,
    "ai_response" VARCHAR(500) NOT NULL,
    "comment" VARCHAR(500),
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ai_failure_patterns_profile_category_idx" ON "ai_failure_patterns" ("profile_id", "category");
CREATE INDEX IF NOT EXISTS "ai_failure_patterns_created_at_idx" ON "ai_failure_patterns" ("created_at");

-- Done!
SELECT 'AI Self-Learning tables created successfully!' as result;
