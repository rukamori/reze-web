# Telegram bot commands for website questions

Use these commands by replying to a bot question message that contains an `ID:` line.

## Answer normally

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

This permanently deletes the question from Firestore.

## Dismiss question

Reply to the bot question message with:

```text
/dismiss
```

This dismisses the question so it stays hidden from the public answered list.

## Edit question text

Reply to the bot question message with:

```text
/edit
```

The bot will ask you to send the edited question text. Send the new text as your next Telegram message. The website question text will be updated.

## Duplicate notification fix

`script.js` now prevents overlapping queue flushes, which was the reason the same website question could be sent to Telegram twice with the same ID.
