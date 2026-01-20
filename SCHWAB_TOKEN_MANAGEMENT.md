# SCHWAB REFRESH TOKEN MANAGEMENT GUIDE 🔑

## Important: Your Token Expires Every 7 Days

**If you generated your refresh token this morning, it will expire 7 days from now at the same time.**

## Current Status (Based on Your Error)

You're getting **401 errors** which means one of these:

1. ❌ Your refresh token already expired
2. ❌ The refresh token doesn't match your app key/secret
3. ❌ Schwab returned a new token and you need to save it
4. ❌ Environment variables aren't set correctly in Vercel

## Quick Fix for Tomorrow

### Option 1: Check Vercel Logs for New Token (EASIEST)

If Schwab gave you a new refresh token during today's authentication, it's in your Vercel logs:

1. **Go to Vercel Dashboard** → Your Project → Deployments → Latest
2. **Click "View Function Logs"**
3. **Search for**: `NEW REFRESH TOKEN`
4. **Look for this box**:
   ```
   ╔═══════════════════════════════════════════════════════════════╗
   ║ 🔑 SCHWAB RETURNED A NEW REFRESH TOKEN - SAVE THIS NOW!     ║
   ╠═══════════════════════════════════════════════════════════════╣
   ║ New Token: [YOUR NEW TOKEN HERE]
   ║ ⚠️  Update SCHWAB_REFRESH_TOKEN in Vercel env vars           ║
   ╚═══════════════════════════════════════════════════════════════╝
   ```
5. **Copy that token** and update it in Vercel (see below)

### Option 2: Generate Fresh Token (IF NEEDED)

If you don't see a new token in logs, generate a fresh one:

#### Step 1: Get Authorization Code
1. Go to: `https://api.schwabapi.com/v1/oauth/authorize?client_id=YOUR_APP_KEY&redirect_uri=https://127.0.0.1`
2. Replace `YOUR_APP_KEY` with your actual app key
3. Log in with your Schwab credentials
4. You'll be redirected to a URL like: `https://127.0.0.1/?code=CODE_HERE&session=...`
5. Copy everything starting from `https://` - this is your authorization code

#### Step 2: Exchange for Refresh Token

Run this in your terminal (replace placeholders):

```bash
curl -X POST https://api.schwabapi.com/v1/oauth/token \
  -H "Authorization: Basic $(echo -n 'YOUR_APP_KEY:YOUR_APP_SECRET' | base64)" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=YOUR_AUTH_CODE&redirect_uri=https://127.0.0.1"
```

**Or use this Node.js script:**

```javascript
const fetch = require('node-fetch');

const APP_KEY = 'your_app_key';
const APP_SECRET = 'your_app_secret';
const AUTH_CODE = 'paste_full_https_url_here';

const credentials = Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString('base64');

fetch('https://api.schwabapi.com/v1/oauth/token', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: AUTH_CODE,
    redirect_uri: 'https://127.0.0.1'
  })
})
.then(res => res.json())
.then(data => {
  console.log('\n🔑 YOUR NEW REFRESH TOKEN:');
  console.log(data.refresh_token);
  console.log('\n⏰ Valid for 7 days from now');
  console.log('💾 Save this in Vercel env vars immediately!');
})
.catch(err => console.error('Error:', err));
```

#### Step 3: Update Vercel Environment Variables

1. **Go to Vercel Dashboard** → Your Project → Settings → Environment Variables
2. **Find** `SCHWAB_REFRESH_TOKEN`
3. **Click Edit** (pencil icon)
4. **Paste new token**
5. **Select all environments**: Production, Preview, Development
6. **Save**

#### Step 4: Redeploy

**CRITICAL**: After updating env vars, you MUST redeploy!

```bash
# In your terminal:
git commit --allow-empty -m "Trigger redeploy for new token"
git push
```

Or in Vercel Dashboard:
- Go to Deployments tab
- Click "..." on latest deployment
- Click "Redeploy"

## Set Up Daily Monitoring

### Create a Reminder Script

Save this as `check-token-expiry.sh`:

```bash
#!/bin/bash
# Run this daily to check if your token needs renewal

TOKEN_DATE_FILE="$HOME/.schwab_token_date"

if [ ! -f "$TOKEN_DATE_FILE" ]; then
    echo "$(date +%s)" > "$TOKEN_DATE_FILE"
    echo "✅ Token date file created. Refresh token valid for 7 days."
    exit 0
fi

TOKEN_CREATED=$(cat "$TOKEN_DATE_FILE")
CURRENT=$(date +%s)
DAYS_OLD=$(( ($CURRENT - $TOKEN_CREATED) / 86400 ))
DAYS_LEFT=$(( 7 - $DAYS_OLD ))

if [ $DAYS_LEFT -le 0 ]; then
    echo "🔴 URGENT: Refresh token EXPIRED! Generate new token NOW!"
    exit 1
elif [ $DAYS_LEFT -le 1 ]; then
    echo "🟡 WARNING: Refresh token expires in $DAYS_LEFT day(s). Generate new token ASAP!"
    exit 1
else
    echo "✅ Token valid for $DAYS_LEFT more day(s)."
fi
```

### Schedule It

**On Mac/Linux:**
```bash
# Add to crontab to run daily at 9 AM
crontab -e

# Add this line:
0 9 * * * /path/to/check-token-expiry.sh
```

**On Windows (PowerShell):**
Create scheduled task or use Windows Task Scheduler

## What to Watch in Vercel Logs

When your app successfully authenticates, you'll see:

```
✅ GOOD:
[Schwab] Got new access token, expires in 1800s
[Schwab] Using cached access token, age: 123 s

❌ BAD (needs new refresh token):
[Schwab] OAuth failed (401): invalid_grant
Market data API rejected the access token (401)
```

## Troubleshooting 401 Errors

### Check #1: Verify Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

- ✅ `SCHWAB_APP_KEY` is set
- ✅ `SCHWAB_APP_SECRET` is set
- ✅ `SCHWAB_REFRESH_TOKEN` is set
- ✅ All are set for **Production** environment (not just Preview)

### Check #2: Verify Token Matches App

The refresh token MUST be generated for the SAME app key/secret. If you:
- Created a new Schwab app
- Changed app keys
- Used a token from a different app

→ Generate a fresh refresh token

### Check #3: Check Schwab App Status

1. Go to https://developer.schwab.com
2. Dashboard → My Apps → Your App
3. Status MUST be: **"Ready for Use"**
4. NOT "Approved - Pending"

### Check #4: ThinkorSwim Enabled

1. Log into your Schwab brokerage account
2. Verify ThinkorSwim (TOS) is enabled
3. Required for API access

## Pro Tips

### 1. Save Tokens Securely

```bash
# Create a secure local backup
mkdir -p ~/.schwab
echo "SCHWAB_REFRESH_TOKEN=$(date): YOUR_TOKEN_HERE" >> ~/.schwab/tokens_backup.txt
chmod 600 ~/.schwab/tokens_backup.txt
```

### 2. Set Calendar Reminder

Set a recurring calendar event for every 6 days to generate a new token BEFORE it expires.

### 3. Monitor Vercel Logs Daily

Check logs each morning for new token warnings.

### 4. Keep Multiple Tokens

You can generate multiple refresh tokens from the same app - keep a backup!

## Emergency Recovery

If your app is down with 401 errors RIGHT NOW:

1. **Generate new token** (use Option 2 above)
2. **Update in Vercel** (all environments)
3. **Force redeploy** (don't wait for auto-deploy)
4. **Test immediately** with a simple ticker

Time required: ~5 minutes

## Summary

**For Tomorrow:**
1. ✅ Check Vercel logs for new token (Option 1)
2. ✅ If found, update `SCHWAB_REFRESH_TOKEN` in Vercel
3. ✅ Redeploy
4. ✅ If no new token, you have 6 more days before current token expires

**Best Practice:**
- Generate new token every 6 days (before 7-day expiry)
- Always check Vercel logs after authentication
- Keep backup tokens in secure location
- Set calendar reminders

---

**Next Action Required**: Check your Vercel logs NOW for any new tokens Schwab may have sent you today!
