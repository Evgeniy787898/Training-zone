-- Add missing columns to profiles table
-- Run this in Supabase SQL Editor

-- 1. Add custom_instructions column for personal AI instructions (PERS-INS-001)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS custom_instructions JSONB DEFAULT NULL;

-- 2. Add AI summary columns if missing
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS ai_summary JSONB DEFAULT NULL;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS ai_summary_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Done!
SELECT 'Missing columns added to profiles table!' as result;
