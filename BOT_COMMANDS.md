# Telegram bot commands for website questions

All management commands are only handled inside your Telegram bot webhook. Use them by replying to a bot question message that contains an `ID:` line.

## Normal answer

Reply to the bot question message with normal text:

```text
Your answer here
```

That saves the text as the answer on the website.

## Delete question

Reply to the bot question message with:

```text
/delete
```

This permanently deletes the question from Firestore. On the website admin popup, tap `Load questions` again to refresh the list.

## Dismiss question

Reply to the bot question message with:

```text
/dismiss
```

This dismisses the question.

## Edit question text

Reply to the bot question message with:

```text
/edit
```

The bot asks you to send the edited question text. Send the new text as your next Telegram message.

## Refresh question list

Send this directly to the bot:

```text
/refresh
```

The bot sends you all currently `UNANSWERED` and `DISMISSED` questions with their IDs.

## Website change

The visitor-side `Your questions` box below the website question field is hidden/disabled now.
