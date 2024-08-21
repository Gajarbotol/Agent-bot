const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const http = require('http');
const app = express();

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminChatIds = [process.env.ADMIN_CHAT_ID_1, process.env.ADMIN_CHAT_ID_2];

const bot = new TelegramBot(token, { polling: true });

const welcomeMessage = `👇👇 আমাদের সার্ভিস 👇👇
🌹আমাদের সার্ভিস রাত দিন ২৪ঘন্টা
🌹সর্বনিম্ম ডিপোজিট = ৫০টাকা
🌹সর্বনিম্ন উইথড্র = ১৫০ টাকা
📢 চার্জ 0%, আপনি যত টাকা দিবেন তত পাবেন 📢
📢 আমরা 1xbet এর Verified এজেন্ট । অন্যদের কাছে প্রতারিত না হয়ে আমাদের সাথে লেনদেন করেন। 👇👇`;

const users = {};

const saveUser = (chatId, userFullName) => {
  users[chatId] = {
    name: userFullName,
  };
};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userFullName = `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();

  saveUser(chatId, userFullName);

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'ডিপোজিট করার নিয়ম', callback_data: 'deposit' }],
        [{ text: 'উইথড্র করতে চাই', callback_data: 'withdraw' }],
        [{ text: 'একাউন্ট খুলতে চাই', callback_data: 'open_account' }],
        [{ text: 'আমাদের গ্রুপ', url: 'https://t.me/+oEELDaKLmzkxNDY1' }]
      ]
    }
  };

  bot.sendMessage(chatId, `*${welcomeMessage}*`, { parse_mode: 'Markdown', ...options });
});

bot.on('callback_query', (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;

  switch (callbackQuery.data) {
    case 'deposit':
      const depositText = `👇আমাদের থেকে ডিপোজিট করার নিয়ম👇
🙋‍♀️শুনেন ভাই,
আমরা বিকাশ নগদ Personal সিমে টাকা রিসিব করি।
📢১. Player id দিবেন। (৯ ডিজিটের)
📢২. Full নাম্বার দিবেন।
(যেই নাম্বার থেকে টাকা পাঠিয়েছেন।
📢৩. স্কিনশর্ট (sendmoney এর) বাদ্যতামূলক
📢 চার্জ 0%, সেন্ডমানি যত দিবেন তত পাবেন।
👇ডিপোজিট উইথড্র নিতে মেসেজ দিন 👇
** এগুলো দিলে ৫মিনিটের ভিতর টাকা আপনার প্লেয়ার একাউন্টে এড হয়ে যাবে ।`;
      const imageUrl = 'https://raw.githubusercontent.com/Gajarbotol/Agent-bot/main/IMG_20240804_010336_063.jpg';
      const depositOptions = {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'আমাদের গ্রুপের লিংক', url: 'https://t.me/+oEELDaKLmzkxNDY1' }]
          ]
        }
      };
      bot.sendMessage(chatId, `*${depositText}*`, depositOptions);
      bot.sendPhoto(chatId, imageUrl);
      break;
    case 'withdraw':
      bot.sendMessage(chatId, '*🚫 আমাদের এজেন্ট যে Address দিবে এটাতে দিবেন, জিজ্ঞাসা করা ছাড়া উইথড্র দিবেন না।\n\nউইথড্র করতে চাইলে আমাদের বলবেন আমি ১৫০ টাকা বা এর বেশি টাকা বিকাশ নগদ বা রকেটের মাধ্যমে উইথড্র নিতে চাই।*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'আমাদের গ্রুপের লিংক', url: 'https://t.me/+oEELDaKLmzkxNDY1' }]
          ]
        }
      });
      break;
    case 'open_account':
      bot.sendMessage(chatId, 'একাউন্ট তৈরি করতে এডমিনের সাথে যোগাযোগ করুন', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'এডমিনের সাথে যোগাযোগ', url: 'https://t.me/+oEELDaKLmzkxNDY1' }]
          ]
        }
      });
      break;
  }
});

const lastSentTimes = {};
const bannedUsers = {};

bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (adminChatIds.includes(chatId.toString())) {
    return;
  }

  if (bannedUsers[chatId]) {
    bot.sendMessage(chatId, '*You are banned from using this bot.*', { parse_mode: 'Markdown' });
    return;
  }

  if (msg.text && !msg.text.startsWith('/')) {
    const userFullName = `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;

    if (!lastSentTimes[chatId] || (now - lastSentTimes[chatId]) > fifteenMinutes) {
      adminChatIds.forEach(adminChatId => {
        bot.forwardMessage(adminChatId, chatId, msg.message_id);
      });

      bot.sendMessage(chatId, `*${userFullName} শীঘ্রই এজেন্ট রিপ্লাই দেবে, একটু অপেক্ষা করুন 😊*`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'আমাদের গ্রুপের লিংক', url: 'https://t.me/+oEELDaKLmzkxNDY1' }]
          ]
        }
      });

      lastSentTimes[chatId] = now;
    }
  }
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (!adminChatIds.includes(chatId.toString())) {
    return;
  }

  if (msg.reply_to_message) {
    const forwardedMessageId = msg.reply_to_message.message_id;
    const originalMessageId = forwardedMessageId;
    const originalChatId = Object.keys(users).find(id => lastSentTimes[id] && msg.reply_to_message.forward_from_message_id === lastSentTimes[id]);

    if (originalChatId) {
      bot.sendMessage(originalChatId, `*${msg.text}*`, { parse_mode: 'Markdown' });
    }
  }
});

bot.onText(/\/broadcast (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1];

  if (adminChatIds.includes(chatId.toString())) {
    for (const userId in users) {
      bot.sendMessage(userId, `*${text}*`, { parse_mode: 'Markdown' });
    }
  } else {
    bot.sendMessage(chatId, '*You are not authorized to use this command.*', { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/admin/, (msg) => {
  const chatId = msg.chat.id;

  if (adminChatIds.includes(chatId.toString())) {
    let response = '*Users:*\n\n';
    for (const userId in users) {
      const user = users[userId];
      response += `*${user.name} (ID: ${userId})*\n`;
    }

    bot.sendMessage(chatId, response || '*No users found.*', { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, '*You are not authorized to use this command.*', { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/ban (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const target = match[1];

  if (adminChatIds.includes(chatId.toString())) {
    let targetChatId = target;
    if (isNaN(target)) {
      const user = Object.values(users).find(u => u.name === target);
      if (user) {
        targetChatId = Object.keys(users).find(id => users[id] === user);
        bannedUsers[targetChatId] = true;
        bot.sendMessage(chatId, `*User ${target} (ID: ${targetChatId}) has been banned.*`, { parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(chatId, '*User not found.*', { parse_mode: 'Markdown' });
      }
    } else {
      bannedUsers[targetChatId] = true;
      bot.sendMessage(chatId, `*User with ID ${targetChatId} has been banned.*`, { parse_mode: 'Markdown' });
    }
  } else {
    bot.sendMessage(chatId, '*You are not authorized to use this command.*', { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/unban (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const target = match[1];

  if (adminChatIds.includes(chatId.toString())) {
    let targetChatId = target;
    if (isNaN(target)) {
      const user = Object.values(users).find(u => u.name === target);
      if (user) {
        targetChatId = Object.keys(users).find(id => users[id] === user);
        delete bannedUsers[targetChatId];
        bot.sendMessage(chatId, `*User ${target} (ID: ${targetChatId}) has been unbanned.*`, { parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(chatId, '*User not found.*', { parse_mode: 'Markdown' });
      }
    } else {
      delete bannedUsers[targetChatId];
      bot.sendMessage(chatId, `*User with ID ${targetChatId} has been unbanned.*`, { parse_mode: 'Markdown' });
    }
  } else {
    bot.sendMessage(chatId, '*You are not authorized to use this command.*', { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/banned/, (msg) => {
  const chatId = msg.chat.id;

  if (adminChatIds.includes(chatId.toString())) {
    let response = '*Banned Users:*\n\n';
    for (const userId in bannedUsers) {
      const user = users[userId];
      response += `*${user.name} (ID: ${userId})*\n`;
    }

    bot.sendMessage(chatId, response || '*No users are currently banned.*', { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, '*You are not authorized to use this command.*', { parse_mode: 'Markdown' });
  }
});

app.get('/', (req, res) => {
  res.send('Bot is running...');
});

app.get('/keepalive', (req, res) => {
  res.send('Bot is alive');
});

const keepAlive = () => {
  setInterval(() => {
    http.get(`https://agent-bot.onrender.com/keepalive`, (res) => {
      res.on('data', (chunk) => {
        console.log(`KEEP-ALIVE RESPONSE: ${chunk}`);
      });
    }).on('error', (err) => {
      console.error(`KEEP-ALIVE ERROR: ${err.message}`);
    });
  }, 5 * 60 * 1000); // Ping every 5 minutes
};

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  keepAlive();
});
