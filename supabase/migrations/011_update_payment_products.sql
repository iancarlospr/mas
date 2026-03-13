-- Expand allowed product values for scan credit bundles and chat top-ups
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_product_check;
ALTER TABLE payments ADD CONSTRAINT payments_product_check
  CHECK (product IN ('alpha_brief', 'alpha_brief_plus', 'chat_credits', 'chat_credits_15'));
