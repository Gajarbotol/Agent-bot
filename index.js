const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json'); // Path to your Firebase service account JSON
const express = require('express');
const app = express();

const token = process.env.TELEGRAM_BOT_TOKEN; // Use environment variable for bot token
const adminChatIds = [process.env.ADMIN_CHAT_ID_1, process.env.ADMIN_CHAT_ID_2]; // Use environment variables for admin chat IDs

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://user-storage-74dd4-default-rtdb.firebaseio.com/' // Your database URL
});

const db = admin.database();
const bot = new TelegramBot(token, { polling: true });

const welcomeMessage = `👇👇 আমাদের সার্ভিস 👇👇

🌹আমাদের সার্ভিস রাত দিন ২৪ঘন্টা

🌹সর্বনিম্ম ডিপোজিট = ৫০টাকা

🌹সর্বনিম্ন উইথড্র = ১৫০ টাকা

📢 চার্জ 0%, আপনি যত টাকা দিবেন তত পাবেন 📢

📢 আমরা 1xbet এর Verified এজেন্ট । অন্যদের কাছে প্রতারিত না হয়ে আমাদের সাথে লেনদেন করেন। 👇👇`;

// Save user to Firebase
const saveUser = (chatId, userFullName) => {
  db.ref(`users/${chatId}`).set({
    name: userFullName
  }, (error) => {
    if (error) {
      console.error('Error saving user to Firebase:', error);
    }
  });
};

// Handle start command
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

// Handle callback queries
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
      const imageUrl = 'https://raw.githubusercontent.com/Gajarbotol/Agent-bot/main/IMG_20240804_010336_063.jpg'; // Replace with your image URL
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
            [{ text: 'এডমিনের সাথে যোগাযোগ', url: 'https://sahariyerefty.t.me' }]
          ]
        }
      });
      break;
  }
});

// Handle user messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  // Ignore messages from admin chat IDs
  if (adminChatIds.includes(chatId.toString())) {
    return;
  }

  if (msg.text && !msg.text.startsWith('/')) {
    const userFullName = `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();

    // Forward the user message to admin chat IDs and store metadata
    adminChatIds.forEach(adminChatId => {
      bot.forwardMessage(adminChatId, chatId, msg.message_id).then((forwardedMsg) => {
        // Store metadata in Firebase
        db.ref(`messages/${forwardedMsg.message_id}`).set({
          originalChatId: chatId,
          originalMessageId: msg.message_id,
          userFullName: userFullName,
          text: msg.text,
          timestamp: Date.now()
        });
      });
    });

    bot.sendMessage(chatId, `*${userFullName} শীঘ্রই এজেন্ট রিপ্লাই দেবে, একটু অপেক্ষা করুন 😊*`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'আমাদের গ্রুপের লিংক', url: 'https://t.me/+oEELDaKLmzkxNDY1' }] // Replace with your admin contact link
        ]
      }
    });
  }
});

// Handle admin replies to forwarded messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  // Ignore messages from non-admin chat IDs
  if (!adminChatIds.includes(chatId.toString())) {
    return;
  }

  // Check if the message is a reply to a forwarded message
  if (msg.reply_to_message) {
    const forwardedMessageId = msg.reply_to_message.message_id;

    // Retrieve metadata from Firebase
    db.ref(`messages/${forwardedMessageId}`).once('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const originalChatId = data.originalChatId;
        const originalMessageId = data.originalMessageId;

        // Send the admin's reply to the original sender
        bot.sendMessage(originalChatId, `*${msg.text}*`, { parse_mode: 'Markdown' });
      }
    });
  }
});

// Broadcast message to all users
bot.onText(/\/broadcast (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1];

  if (adminChatIds.includes(chatId.toString())) {
    db.ref('users').once('value', (snapshot) => {
      snapshot.forEach((childSnapshot) => {
        const userId = childSnapshot.key;
        bot.sendMessage(userId, `*${text}*`, { parse_mode: 'Markdown' });
      });
    });
  } else {
    bot.sendMessage(chatId, '*You are not authorized to use this command.*', { parse_mode: 'Markdown' });
  }
});

// List all users
bot.onText(/\/admin/, (msg) => {
  const chatId = msg.chat.id;

  if (adminChatIds.includes(chatId.toString())) {
    db.ref('users').once('value', (snapshot) => {
      let response = '*Users:*\n\n';
      snapshot.forEach((childSnapshot) => {
        const user = childSnapshot.val();
        response += `*${user.name} (ID: ${childSnapshot.key})*\n`;
      });

      bot.sendMessage(chatId, response || '*No users found.*', { parse_mode: 'Markdown' });
    });
  } else {
    bot.sendMessage(chatId, '*You are not authorized to use this command.*', { parse_mode: 'Markdown' });
  }
});

const port = process.env.PORT || 3000; // Default to 3000 if PORT is not set

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
