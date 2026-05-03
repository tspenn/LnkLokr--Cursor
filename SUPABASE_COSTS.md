# Supabase Cloud Storage Costs

## How It Works

Your app uses **Supabase** (not Bolt) for cloud storage. You pay Supabase directly for hosting costs.

## Pricing Tiers

### Free Tier
- 500 MB database storage
- 1 GB file storage
- Good for testing and initial launch

### Pro Plan - $25/month
- 8 GB database storage
- 100 GB file storage
- Automatic daily backups
- Point-in-time recovery

### Pay-As-You-Go (Beyond Pro limits)
- **Database storage**: ~$0.125/GB/month
- **File storage**: ~$0.021/GB/month
- **Bandwidth**: ~$0.09/GB

## Example Cost Scenarios

### 1,000 Users (Average 5MB each)
- Total storage: ~5 GB
- Cost: **Free tier or $25/month Pro plan**

### 10,000 Users (Average 5MB each)
- Total storage: ~50 GB
- Database: ~1 GB ($0.125/GB beyond Pro) = ~$0
- Files: ~49 GB (beyond Pro 100GB limit if files) = ~$0
- **Cost: $25/month Pro plan** (covers 100GB file storage)

### 50,000 Users (Average 5MB each)
- Total storage: ~250 GB
- Beyond Pro 100GB: 150 GB × $0.021 = ~$3.15/month extra
- **Cost: ~$28-30/month**

## Revenue Model

With freemium pricing:
- Free users (500 MB limit): No revenue but low cost
- Premium users ($4.99/month): Unlimited storage

**Break-even**:
- At $25/month Supabase cost, you need ~5 premium subscribers ($4.99 × 5 = $24.95)
- Additional storage costs are minimal compared to premium revenue

## Cost Optimization Tips

1. **Image compression**: Compress images before storing (can reduce by 50-70%)
2. **Cleanup policies**: Delete unused/old data after X months
3. **Storage limits**: Enforce 500MB for free, warn at 80% capacity
4. **Premium incentives**: Offer unlimited at $4.99 to cover storage costs

## Where to Pay

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → Billing
4. Choose Pro plan or add payment method for pay-as-you-go

## Summary

- **Bolt**: Doesn't charge for storage (they just host the dev environment)
- **Supabase**: You pay them directly based on usage
- **Your users**: Pay YOU for premium features
- **Goal**: Premium revenue > Supabase costs
