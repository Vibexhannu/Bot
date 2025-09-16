// Active reply loops
let replyLoops = {}; // { userID: { lines, index, delay, interval } }

// 🔹 Command: #reply (custom delay + infinite loop + auto reply)
if (message.body && message.body.toLowerCase().startsWith("#reply")) {
  try {
    const replyText = fs.readFileSync("message.txt", "utf8");
    const lines = replyText.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length === 0) {
      api.sendMessage("⚠️ message.txt is empty!", message.threadID);
      return;
    }

    const parts = message.body.split(" ");
    if (parts.length < 3) {
      api.sendMessage("⚠️ Format: #reply @username <delay in sec>", message.threadID);
      return;
    }

    const delay = parseInt(parts[2]);
    if (isNaN(delay) || delay < 1) {
      api.sendMessage("⚠️ Invalid delay. Example: #reply @username 5", message.threadID);
      return;
    }

    if (message.mentions && Object.keys(message.mentions).length > 0) {
      const mentionIDs = Object.keys(message.mentions);

      mentionIDs.forEach(id => {
        // Agar pehle se chal raha hai to band karo
        if (replyLoops[id]) {
          clearInterval(replyLoops[id].interval);
        }

        replyLoops[id] = { lines, index: 0, delay };

        api.sendMessage(
          {
            body: "ACTIVATED ✅",
            mentions: [{ tag: message.mentions[id], id }]
          },
          message.threadID
        );

        // Infinite loop start
        replyLoops[id].interval = setInterval(() => {
          const loop = replyLoops[id];
          if (!loop) return;
          const line = loop.lines[loop.index];
          api.sendMessage(
            {
              body: line,
              mentions: [{ tag: message.mentions[id], id }]
            },
            message.threadID
          );
          loop.index = (loop.index + 1) % loop.lines.length;
        }, delay * 1000);
      });
    } else {
      api.sendMessage("⚠️ Please tag someone with the command!", message.threadID);
    }
  } catch (err) {
    api.sendMessage("❌ Error: message.txt not found!", message.threadID);
  }
  return;
}

// 🔹 Command: #stop (stop spamming a user)
if (message.body && message.body.toLowerCase().startsWith("#stop")) {
  if (message.mentions && Object.keys(message.mentions).length > 0) {
    const mentionIDs = Object.keys(message.mentions);

    mentionIDs.forEach(id => {
      if (replyLoops[id]) {
        clearInterval(replyLoops[id].interval);
        delete replyLoops[id];
        api.sendMessage(
          {
            body: "❌ Deactivated for this user.",
            mentions: [{ tag: message.mentions[id], id }]
          },
          message.threadID
        );
      } else {
        api.sendMessage(
          {
            body: "⚠️ This user is not in active loop.",
            mentions: [{ tag: message.mentions[id], id }]
          },
          message.threadID
        );
      }
    });
  } else {
    api.sendMessage("⚠️ Please tag someone to stop!", message.threadID);
  }
  return;
}

// 🔹 Auto-reply jab targeted user msg bheje
if (replyLoops[message.senderID]) {
  const loop = replyLoops[message.senderID];
  const line = loop.lines[loop.index];
  api.sendMessage(
    {
      body: line,
      mentions: [{ tag: message.senderName, id: message.senderID }]
    },
    message.threadID
  );
  loop.index = (loop.index + 1) % loop.lines.length;
}
