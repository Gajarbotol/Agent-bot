const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const express = require('express');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Firebase setup
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://your-database-name.firebaseio.com'  // Replace with your Firebase database URL
});

const db = admin.database();

// Telegram Bot setup
const BOT_TOKEN = process.env.BOT_TOKEN;
const API_ENDPOINT = 'https://api-gajarxbotol.onrender.com/send_sms';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const ADDITIONAL_ADMIN_CHAT_ID = process.env.ADDITIONAL_ADMIN_CHAT_ID;
const CHANNEL_URL = process.env.CHANNEL_URL;
const ADDITIONAL_CHANNEL_URL = process.env.ADDITIONAL_CHANNEL_URL;
const WATERMARK = " ";

if (!BOT_TOKEN || !ADMIN_CHAT_ID || !ADDITIONAL_ADMIN_CHAT_ID || !CHANNEL_URL || !ADDITIONAL_CHANNEL_URL) {
    console.error('Error: Missing one or more environment variables.');
    process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const WAITING_FOR_NUMBER = 'waiting_for_number';
const WAITING_FOR_MESSAGE = 'waiting_for_message';
const WAITING_FOR_JOIN_CONFIRMATION = 'waiting_for_join_confirmation';

const userStates = {};
const userNumbers = {};
const userStats = {};

// Firebase functions
const saveUser = (userId, userData) => {
    const userRef = db.ref(`users/${userId}`);
    return userRef.set(userData);
};

const isUserBanned = async (userId) => {
    const bannedUsersRef = db.ref('banned_users');
    const snapshot = await bannedUsersRef.child(userId).once('value');
    return snapshot.exists();
};

const banUser = async (userId) => {
    const bannedUsersRef = db.ref('banned_users');
    await bannedUsersRef.child(userId).set(true);
};

const unbanUser = async (userId) => {
    const bannedUsersRef = db.ref('banned_users');
    await bannedUsersRef.child(userId).remove();
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

    const users = fs.existsSync('user.txt') ? fs.readFileSync('user.txt', 'utf-8').split('\n') : [];
    if (!users.includes(`${userId} ${username}`)) {
        fs.appendFileSync('user.txt', `${userId} ${username}\n`);
        await saveUser(userId, { username: username, fullName: msg.from.first_name });
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

    if (await isUserBanned(userId)) {
        bot.sendMessage(userId, 'আপনি এই বট ব্যবহার করার অনুমতি নেই।');
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
            console.error(`[ERROR] Failed to send SMS for user ${userId} to ${phoneNumber}:`, error);
            bot.sendMessage(userId, 'বার্তাটি পাঠানো সম্ভব হয়নি। 😢 দয়া করে এডমিনের সাথে যোগাযোগ করুন @gajarbotol1_bot');
            sendAdminLog(userId, username, fullName, phoneNumber, text, null, error);
        }

        delete userStates[userId];
        delete userNumbers[userId];
    } else {
        // Increment message count
        if (!userStats[userId]) {
            userStats[userId] = { messagesSent: 0 };
        }
        userStats[userId].messagesSent += 1;
    }
});

// Handle /ban command
bot.onText(/\/ban (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (chatId == ADMIN_CHAT_ID || chatId == ADDITIONAL_ADMIN_CHAT_ID) {
        const identifier = match[1].trim();
        const bannedUsersRef = db.ref('banned_users');
        let userId;

        if (identifier.startsWith('@')) {
            const username = identifier.slice(1);
            const user = await bot.getUserProfilePhotos({ user_id: username });
            userId = user.user_id;
        } else if (identifier.match(/^\d+$/)) {
            userId = parseInt(identifier, 10);
        }

        if (userId) {
            await banUser(userId);
            bot.sendMessage(chatId, `ব্যবহারকারী ${identifier} নিষিদ্ধ করা হয়েছে।`);
        } else {
            bot.sendMessage(chatId, 'ব্যান করার জন্য সঠিক ব্যবহারকারী নাম বা আইডি দিন।');
        }
    }
});

// Handle /unban command
bot.onText(/\/unban (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (chatId == ADMIN_CHAT_ID || chatId == ADDITIONAL_ADMIN_CHAT_ID) {
        const identifier = match[1].trim();
        const bannedUsersRef = db.ref('banned_users');
        let userId;

        if (identifier.startsWith('@')) {
            const username = identifier.slice(1);
            const user = await bot.getUserProfilePhotos({ user_id: username });
            userId = user.user_id;
        } else if (identifier.match(/^\d+$/)) {
            userId = parseInt(identifier, 10);
        }

        if (userId) {
            await unbanUser(userId);
            bot.sendMessage(chatId, `ব্যবহারকারী ${identifier} আনব্যান করা হয়েছে।`);
        } else {
            bot.sendMessage(chatId, 'আনব্যান করার জন্য সঠিক ব্যবহারকারী নাম বা আইডি দিন।');
        }
    }
});

// Handle /banned command
bot.onText(/\/banned/, async (msg) => {
    const chatId = msg.chat.id;
    if (chatId == ADMIN_CHAT_ID || chatId == ADDITIONAL_ADMIN_CHAT_ID) {
        const bannedUsersRef = db.ref('banned_users');
        const snapshot = await bannedUsersRef.once('value');
        const bannedUsers = snapshot.val();

        if (bannedUsers) {
            const bannedList = Object.keys(bannedUsers).join('\n');
            bot.sendMessage(chatId, `নিষিদ্ধ ব্যবহারকারীরা:\n${bannedList}`);
        } else {
            bot.sendMessage(chatId, 'কোনো নিষিদ্ধ ব্যবহারকারী নেই।');
        }
    }
});

// Broadcast a message to all users
bot.onText(/\/broadcast (.+)/, (msg, match) => {
    if (msg.chat.id == ADMIN_CHAT_ID || msg.chat.id == ADDITIONAL_ADMIN_CHAT_ID) {
        const broadcastMessage = match[1];
        db.ref('users').once('value', (snapshot) => {
            snapshot.forEach((childSnapshot) => {
                const userId = childSnapshot.key;
                bot.sendMessage(userId, broadcastMessage);
            });
        });
    }
});

// Show user list to admins
bot.onText(/\/admin/, async (msg) => {
    if (msg.chat.id == ADMIN_CHAT_ID || msg.chat.id == ADDITIONAL_ADMIN_CHAT_ID) {
        const snapshot = await db.ref('users').once('value');
        const users = snapshot.val();
        if (users) {
            const userList = Object.entries(users).map(([userId, data]) => `${userId} - ${data.username || 'N/A'}`).join('\n');
            bot.sendMessage(msg.chat.id, `ব্যবহারকারীর তালিকা:\n${userList}`);
        } else {
            bot.sendMessage(msg.chat.id, 'কোনো ব্যবহারকারী পাওয়া যায়নি।');
        }
    }
});

// Show user statistics to admins
bot.onText(/\/stats/, (msg) => {
    if (msg.chat.id == ADMIN_CHAT_ID || msg.chat.id == ADDITIONAL_ADMIN_CHAT_ID) {
        let statsMessage = 'ব্যবহারকারী পরিসংখ্যান:\n';
        Object.keys(userStats).forEach(userId => {
            statsMessage += `ব্যবহারকারী আইডি: ${userId}, পাঠানো মেসেজের সংখ্যা: ${userStats[userId].messagesSent}\n`;
        });
        bot.sendMessage(msg.chat.id, statsMessage);
    }
});

// Keep Heroku dyno alive by listening on the provided port
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running.'));
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Keep alive with an HTTP GET request
const keepAlive = () => {
    http.get(`http://localhost:${PORT}/`, (res) => {
        console.log(`Keep-alive response status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error(`Error in keep-alive request: ${err.message}`);
    });
};

// Schedule keep-alive requests every 5 minutes
setInterval(keepAlive, 5 * 60 * 1000);
