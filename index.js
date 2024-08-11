const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const express = require('express');
const http = require('http');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Path to your service account key

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://your-database-name.firebaseio.com' // Replace with your Firebase database URL
});

const db = admin.database();

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_ENDPOINT = 'https://api-gajarxbotol.onrender.com/send_sms';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const ADDITIONAL_ADMIN_CHAT_ID = process.env.ADDITIONAL_ADMIN_CHAT_ID;
const CHANNEL_URL = process.env.CHANNEL_URL;
const ADDITIONAL_CHANNEL_URL = process.env.ADDITIONAL_CHANNEL_URL;
const WATERMARK = " ";

if (!BOT_TOKEN || !ADMIN_CHAT_ID || !ADDITIONAL_ADMIN_CHAT_ID || !CHANNEL_URL || !ADDITIONAL_CHANNEL_URL) {
    console.error('Error: Missing one or more environment variables: BOT_TOKEN, ADMIN_CHAT_ID, ADDITIONAL_ADMIN_CHAT_ID, CHANNEL_URL, ADDITIONAL_CHANNEL_URL.');
    process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const WAITING_FOR_NUMBER = 'waiting_for_number';
const WAITING_FOR_MESSAGE = 'waiting_for_message';
const WAITING_FOR_JOIN_CONFIRMATION = 'waiting_for_join_confirmation';

const userStates = {};
const userNumbers = {};
const userStats = {};
const bannedUsers = {};

// Load banned users from Firebase
db.ref('banned').once('value', (snapshot) => {
    bannedUsers = snapshot.val() || {};
});

// Check if a user is banned
const isUserBanned = (userId) => {
    return bannedUsers[userId] === true;
};

// Check if a user is a member of a specific channel
const checkUserMembership = async (userId, channel) => {
    try {
        const chatMember = await bot.getChatMember(`@${channel}`, userId);
        return ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (error) {
        console.error(`Error checking membership for user ${userId} in channel ${channel}:`, error);
        return false;
    }
};

// Send log to admin
const sendAdminLog = (userId, username, fullName, phoneNumber, text, response = null, error = null) => {
    const userLink = username ? `https://t.me/${username}` : `tg://user?id=${userId}`;
    const logMessage = `প্রেরকের ব্যবহারকারীর নাম - ${username}\nব্যবহারকারীর পূর্ণ নাম - ${fullName}\nব্যবহারকারী আইডি লিঙ্ক - ${userLink}\nপ্রাপকের ফোন নম্বর - ${phoneNumber}\nবার্তা - ${text}\nAPI প্রতিক্রিয়া - ${response ? JSON.stringify(response.data) : 'N/A'}\nত্রুটি - ${error ? error.message : 'N/A'}`;
    bot.sendMessage(ADMIN_CHAT_ID, logMessage);
    bot.sendMessage(ADDITIONAL_ADMIN_CHAT_ID, logMessage);
};

// Send main menu to user
const sendMainMenu = (userId) => {
    bot.sendMessage(userId, '✅', {
        reply_markup: {
            keyboard: [
                [{ text: 'মেসেজ পাঠান' }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
};

// Handle the /start command
bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    const username = msg.from.username;

    if (isUserBanned(userId)) {
        bot.sendMessage(userId, 'আপনি এই বট ব্যবহার করতে পারছেন না।');
        return;
    }

    const users = fs.existsSync('user.txt') ? fs.readFileSync('user.txt', 'utf-8').split('\n') : [];
    if (!users.includes(`${userId} ${username}`)) {
        fs.appendFileSync('user.txt', `${userId} ${username}\n`);
        sendAdminLog(userId, username, msg.from.first_name, '', 'নতুন ব্যবহারকারী শুরু করেছে।');
    }

    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'চ্যানেল ১-এ যোগ দিন', url: `https://t.me/${CHANNEL_URL}` }],
                [{ text: 'চ্যানেল ২-এ যোগ দিন', url: `https://t.me/${ADDITIONAL_CHANNEL_URL}` }],
                [{ text: 'যোগ দিয়েছি', callback_data: 'joined' }]
            ]
        }
    };
    bot.sendMessage(userId, 'বট ব্যবহার করার জন্য আমাদের চ্যানেলে যোগ দিন।', opts);
    userStates[userId] = WAITING_FOR_JOIN_CONFIRMATION;
});

// Handle callback queries for channel join confirmation
bot.on('callback_query', async (callbackQuery) => {
    const userId = callbackQuery.from.id;

    if (isUserBanned(userId)) {
        bot.answerCallbackQuery(callbackQuery.id, { text: 'আপনি এই বট ব্যবহার করতে পারছেন না।' });
        return;
    }

    if (userStates[userId] === WAITING_FOR_JOIN_CONFIRMATION) {
        const isMemberChannel1 = await checkUserMembership(userId, CHANNEL_URL);
        const isMemberChannel2 = await checkUserMembership(userId, ADDITIONAL_CHANNEL_URL);

        if (isMemberChannel1 && isMemberChannel2) {
            bot.answerCallbackQuery(callbackQuery.id, { text: 'আমাদের চ্যানেলে যোগদানের জন্য ধন্যবাদ! 😻' });
            bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id);
            sendMainMenu(userId);

            userStates[userId] = null;
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: 'দয়া করে আমাদের দুটি চ্যানেলে যোগ দিন।' });
        }
    }
});

// Handle messages
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const username = msg.from.username;
    const fullName = `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();

    if (isUserBanned(userId)) {
        bot.sendMessage(userId, 'আপনি এই বট ব্যবহার করতে পারছেন না।');
        return;
    }

    if (msg.text === 'মেসেজ পাঠান') {
        const isMemberChannel1 = await checkUserMembership(userId, CHANNEL_URL);
        const isMemberChannel2 = await checkUserMembership(userId, ADDITIONAL_CHANNEL_URL);

        if (isMemberChannel1 && isMemberChannel2) {
            userStates[userId] = WAITING_FOR_NUMBER;
            bot.sendMessage(userId, "যে নম্বরে মেসেজ পাঠাতে চান সেই নম্বরটি লিখুন 😊");
        } else {
            const opts = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'চ্যানেল ১-এ যোগ দিন', url: `https://t.me/${CHANNEL_URL}` }],
                        [{ text: 'চ্যানেল ২-এ যোগ দিন', url: `https://t.me/${ADDITIONAL_CHANNEL_URL}` }],
                        [{ text: 'যোগ দিয়েছি', callback_data: 'joined' }]
                    ]
                }
            };
            bot.sendMessage(userId, 'বট ব্যবহার করার জন্য আমাদের চ্যানেলে জয়েন করুন।', opts);
            userStates[userId] = WAITING_FOR_JOIN_CONFIRMATION;
        }
    } else if (userStates[userId] === WAITING_FOR_NUMBER) {
        if (msg.text.startsWith('01')) {
            userStates[userId] = WAITING_FOR_MESSAGE;
            userNumbers[userId] = msg.text;
            bot.sendMessage(userId, 'মেসেজটি লিখুন 🖤');
        } else {
            bot.sendMessage(userId, 'দয়া করে একটি সঠিক নাম্বার ব্যাবহার করুন। 😊');
        }
    } else if (userStates[userId] === WAITING_FOR_MESSAGE) {
        const phoneNumber = userNumbers[userId];
        const text = `${msg.text} ${WATERMARK}`;

        try {
            const response = await axios.get(API_ENDPOINT, { params: { receiver: phoneNumber, text } });
            if (response.status === 200) {
                bot.sendMessage(userId, 'বার্তাটি সফলভাবে পাঠানো হয়েছে ✅');
                sendAdminLog(userId, username, fullName, phoneNumber, text, response);
                sendMainMenu(userId);
            } else {
                bot.sendMessage(userId, 'বার্তাটি পাঠানো সম্ভব হয়নি। 😢 দয়া করে এডমিনের সাথে যোগাযোগ করুন @gajarbotol1_bot');
                sendAdminLog(userId, username, fullName, phoneNumber, text, response);
            }
        } catch (error) {
            console.error(`[ERROR] Failed to send SMS for user ${userId}: ${error}`);
            bot.sendMessage(userId, 'বার্তাটি পাঠানোর সময় ত্রুটি ঘটেছে। 😢');
            sendAdminLog(userId, username, fullName, phoneNumber, text, null, error);
        }

        userStates[userId] = null;
    }
});

// Admin commands
bot.onText(/\/admin/, async (msg) => {
    const userId = msg.from.id;
    const username = msg.from.username;

    if (userId !== ADMIN_CHAT_ID && userId !== ADDITIONAL_ADMIN_CHAT_ID) {
        bot.sendMessage(userId, 'আপনার এই কমান্ড ব্যবহারের অনুমতি নেই।');
        return;
    }

    if (isUserBanned(userId)) {
        bot.sendMessage(userId, 'আপনি এই বট ব্যবহার করতে পারছেন না।');
        return;
    }

    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val() || {};

    if (Object.keys(users).length === 0) {
        bot.sendMessage(userId, 'কোনো ব্যবহারকারী পাওয়া যায়নি।');
        return;
    }

    let message = 'ব্যবহারকারীদের তালিকা:\n';
    for (const [id, details] of Object.entries(users)) {
        message += `${id} ${details.username}\n`;
    }

    bot.sendMessage(userId, message);
});

// Handle /ban command
bot.onText(/\/ban (.+)/, (msg, match) => {
    const userId = msg.from.id;
    const target = match[1].trim();
    if (userId !== ADMIN_CHAT_ID && userId !== ADDITIONAL_ADMIN_CHAT_ID) {
        bot.sendMessage(userId, 'আপনার এই কমান্ড ব্যবহারের অনুমতি নেই।');
        return;
    }

    if (isUserBanned(userId)) {
        bot.sendMessage(userId, 'আপনি এই বট ব্যবহার করতে পারছেন না।');
        return;
    }

    const isUserId = /^\d+$/.test(target);
    if (isUserId) {
        db.ref(`users/${target}`).once('value').then(snapshot => {
            if (snapshot.exists()) {
                bannedUsers[target] = true;
                db.ref('banned').set(bannedUsers);
                bot.sendMessage(userId, `ব্যবহারকারী ${target} কে নিষিদ্ধ করা হয়েছে।`);
            } else {
                bot.sendMessage(userId, 'ব্যবহারকারী পাওয়া যায়নি।');
            }
        });
    } else {
        db.ref('users').orderByChild('username').equalTo(target).once('value').then(snapshot => {
            const users = snapshot.val();
            if (users) {
                for (const user in users) {
                    bannedUsers[user] = true;
                }
                db.ref('banned').set(bannedUsers);
                bot.sendMessage(userId, `ব্যবহারকারী ${target} কে নিষিদ্ধ করা হয়েছে।`);
            } else {
                bot.sendMessage(userId, 'ব্যবহারকারী পাওয়া যায়নি।');
            }
        });
    }
});

// Handle /unban command
bot.onText(/\/unban (.+)/, (msg, match) => {
    const userId = msg.from.id;
    const target = match[1].trim();

    if (userId !== ADMIN_CHAT_ID && userId !== ADDITIONAL_ADMIN_CHAT_ID) {
        bot.sendMessage(userId, 'আপনার এই কমান্ড ব্যবহারের অনুমতি নেই।');
        return;
    }

    if (isUserBanned(userId)) {
        bot.sendMessage(userId, 'আপনি এই বট ব্যবহার করতে পারছেন না।');
        return;
    }

    const isUserId = /^\d+$/.test(target);
    if (isUserId) {
        if (bannedUsers[target]) {
            delete bannedUsers[target];
            db.ref('banned').set(bannedUsers);
            bot.sendMessage(userId, `ব্যবহারকারী ${target} কে আনব্যান করা হয়েছে।`);
        } else {
            bot.sendMessage(userId, 'ব্যবহারকারী নিষিদ্ধ নয়।');
        }
    } else {
        db.ref('users').orderByChild('username').equalTo(target).once('value').then(snapshot => {
            const users = snapshot.val();
            if (users) {
                for (const user in users) {
                    delete bannedUsers[user];
                }
                db.ref('banned').set(bannedUsers);
                bot.sendMessage(userId, `ব্যবহারকারী ${target} কে আনব্যান করা হয়েছে।`);
            } else {
                bot.sendMessage(userId, 'ব্যবহারকারী পাওয়া যায়নি।');
            }
        });
    }
});

// Handle /banned command
bot.onText(/\/banned/, (msg) => {
    const userId = msg.from.id;
    if (userId !== ADMIN_CHAT_ID && userId !== ADDITIONAL_ADMIN_CHAT_ID) {
        bot.sendMessage(userId, 'আপনার এই কমান্ড ব্যবহারের অনুমতি নেই।');
        return;
    }

    if (isUserBanned(userId)) {
        bot.sendMessage(userId, 'আপনি এই বট ব্যবহার করতে পারছেন না।');
        return;
    }

    if (Object.keys(bannedUsers).length === 0) {
        bot.sendMessage(userId, 'কোনো নিষিদ্ধ ব্যবহারকারী নেই।');
        return;
    }

    let message = 'নিষিদ্ধ ব্যবহারকারীদের তালিকা:\n';
    for (const userId in bannedUsers) {
        message += `${userId}\n`;
    }

    bot.sendMessage(userId, message);
});

// Handle errors
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Express server for health check
const app = express();
const server = http.createServer(app);

app.get('/', (req, res) => {
    res.send('Bot is running');
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Server started');
});
