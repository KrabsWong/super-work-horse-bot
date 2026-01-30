# GitHub to Telegram Push Notification

This GitHub Action automatically sends a Telegram notification when code is pushed to the repository.

## Setup Instructions

### 1. Get Your Telegram Chat ID

Send `/start` to your Telegram bot and visit:
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
```

Look for the `chat.id` field in the response.

### 2. Configure GitHub Secrets

Go to your repository settings:
```
Settings → Secrets and variables → Actions → New repository secret
```

Add two secrets:
- **Name**: `TELEGRAM_BOT_TOKEN`  
  **Value**: Your Telegram bot token (from @BotFather)

- **Name**: `TELEGRAM_CHAT_ID`  
  **Value**: Your chat ID (from step 1)

### 3. Test the Workflow

Push a commit to the `main` or `master` branch:
```bash
git add .
git commit -m "Test telegram notification"
git push
```

You should receive a Telegram message within 10-30 seconds.

## Notification Format

```
✅ Task Completed - GitHub Push Notification

📦 Repository: user/repo-name
🌿 Branch: main
📝 Commits: 1

💬 Latest Commit:
  SHA: abc123d
  Message: Your commit message
  Author: Your Name <your@email.com>

🔗 View: https://github.com/user/repo/commit/abc123...
```

## Customization

Edit `.github/workflows/telegram-notify.yml` to:
- Change monitored branches
- Customize message format
- Add filters (e.g., only notify on certain paths)

## Troubleshooting

**No notification received:**
- Check GitHub Actions tab for workflow execution logs
- Verify secrets are correctly set
- Ensure bot has permission to send messages to the chat

**Getting errors:**
- Test your bot token: `https://api.telegram.org/bot<TOKEN>/getMe`
- Test sending a message manually with curl to verify credentials
