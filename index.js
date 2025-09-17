const login = require("facebook-chat-api");
const fs = require("fs");
const prompt = require("prompt-sync")({ sigint: true });

const appStateFile = "appstate.json";
let apiGlobal; // Global API reference for your commands
let replyLoops = {}; // { userID: { lines, index, delay, interval } }

// 🔹 Start bot after login
function startBot(api) {
  apiGlobal = api;

  console.log("✅ Bot started!");

  // -------------------------
  // 🔹 Command: #reply
  // -------------------------
  api.listenMqtt((err, message) => {
    if (err) return console.error(err);

    const msg = message.body ? message.body.trim() : "";

    // ----- #reply command -----
    if (msg.toLowerCase().startsWith("#reply")) {
      try {
        const replyText = fs.readFileSync("message.txt", "utf8");
        const lines = replyText
          .split("\n")
          .map(l => l.trim())
          .filter(l => l.length > 0);

        if (lines.length === 0) {
          api.sendMessage("⚠️ message.txt is empty!", message.threadID);
          return;
        }

        const parts = msg.split(" ");
        if (parts.length < 3) {
          api.sendMessage(
            "⚠️ Format: #reply @username <delay in sec>",
            message.threadID
          );
          return;
        }

        const delay = parseInt(parts[2]);
        if (isNaN(delay) || delay < 1) {
          api.sendMessage(
            "⚠️ Invalid delay. Example: #reply @username 5",
            message.threadID
          );
          return;
        }

        if (message.mentions && Object.keys(message.mentions).length > 0) {
          const mentionIDs = Object.keys(message.mentions);

          mentionIDs.forEach(id => {
            if (replyLoops[id]) clearInterval(replyLoops[id].interval);

            replyLoops[id] = { lines, index: 0, delay };

            api.sendMessage(
              {
                body: "ACTIVATED ✅",
                mentions: [{ tag: message.mentions[id], id }]
              },
              message.threadID
            );

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
          api.sendMessage(
            "⚠️ Please tag someone with the command!",
            message.threadID
          );
        }
      } catch (err) {
        api.sendMessage("❌ Error: message.txt not found!", message.threadID);
      }
      return;
    }

    // ----- #stop command -----
    if (msg.toLowerCase().startsWith("#stop")) {
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

    // ----- Auto-reply when targeted user sends message -----
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
  });
}

// -------------------------
// 🔹 Login logic (AppState + manual fallback)
// -------------------------
function manualLogin() {
  const email = prompt("Enter Facebook email/phone: ");
  const password = prompt("Enter password: ", { echo: "*" });

  login({ email, password }, (err, api) => {
    if (err) return console.error("❌ Manual login failed:", err);
    console.log("✅ Logged in manually!");
    fs.writeFileSync(appStateFile, JSON.stringify(api.getAppState()));
    startBot(api);
  });
}

// Try AppState login first
if (fs.existsSync(appStateFile)) {
  const appState = JSON.parse(fs.readFileSync(appStateFile, "utf8"));
  login({ appState }, (err, api) => {
    if (err) {
      console.log("⚠️ AppState login failed. Switching to manual login...");
      manualLogin();
      return;
    }
    console.log("✅ Logged in with AppState!");
    startBot(api);
  });
} else {
  manualLogin();
}
