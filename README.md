# Discord Imaginary Money Bot

A Discord bot for collecting and managing imaginary coins with friends. Supports a one-server economy with transfers, duels, a shop, and a poll-based betting system.

## Setup

1. Clone the repo and install dependencies:
   ```
   npm install
   ```
2. Create a `.env` file with your bot token and command prefix:
   ```
   TOKEN=your_discord_bot_token
   BOTCOMMAND=!
   ```
3. Run the bot:
   ```
   npx ts-node src/index.ts
   ```

## Commands

Replace `!` with whatever you set as `BOTCOMMAND`.

| Command | Description |
|---|---|
| `! help` | List available commands |
| `! reward` | Collect your free daily coins |
| `! balance <user>` | Check a user's balance |
| `! top <x>` | See the top x users by coins |
| `! transfer <user> <x>` | Transfer x coins to a user |
| `! duel <user> <x>` | Challenge a user to a duel, betting x coins |
| `! check shop` | View the shop |

### Poll & Betting Commands

| Command | Description |
|---|---|
| `! add poll <name> <opt1> <opt2> ...` | Create a poll |
| `! view polls` | View all polls |
| `! bet poll<id> opt<n> <x>` | Bet x coins on an option |
| `! view bets poll<id>` | View all bets for a poll |
| `! locksin poll<id>` | Check when a poll will be locked |

### Admin Only

| Command | Description |
|---|---|
| `! resolve poll<id> opt<n>` | Resolve a poll with a winning option |
| `! undo poll<id>` | Undo a resolved poll |
| `! lock poll<id>` | Lock a poll immediately |
| `! lock poll<id> <days> <hours> <minutes>` | Schedule a poll lock |
