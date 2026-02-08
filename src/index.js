require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

const TelegramApi = require('node-telegram-bot-api');
const admin = require('firebase-admin');
require('firebase/database');
const serviceAccount = require('../secrets/serviceAccountKey.json');
const token = process.env.BOT_TOKEN;
const bot = new TelegramApi(token, {polling: true});

const firebaseConfig = {
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://bolnoy-shop-uc1-default-rtdb.europe-west1.firebasedatabase.app",
};

admin.initializeApp(firebaseConfig);

const database = admin.database();

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

let admins = {};
database.ref('admins').once('value').then((snapshot) => {
  admins = snapshot.val() || {};
  if (!Object.keys(admins).length) {
    admins[ADMIN_CHAT_ID.toString()] = true;
    database.ref('admins').set(admins);
  }
});

const IMAGES = {
  welcome: 'https://ibb.co/PsHSN2VW',
  pack: 'https://ibb.co/nsRFz3Xy',
  amount: 'https://ibb.co/237dTmS1',
  receipt: 'https://ibb.co/KjXnBn5d'
}

function isAdmin(chatId) {
  const id = chatId.toString();
  if (admins[id] === true) {
    return true;
  }
  return false;
}

async function sendMessageToAllAdmins(message, inlineKeyboard = null) {
  Object.keys(admins).forEach(async adminId => {
    const options = {};

    if (inlineKeyboard) {
      options.reply_markup = {
        inline_keyboard: inlineKeyboard
      };
    }

    await bot.sendMessage(adminId, message, options)
  });
}

function forwardMessageToAllAdmins(chatId, messageId) {
  Object.keys(admins).forEach(async adminId => {
    await bot.forwardMessage(adminId, chatId, messageId)
  });
}

let paymentDetails = '';

database.ref('paymentDetails').once('value').then((snapshot) => {
  paymentDetails = snapshot.val() || `ТИНЬКОФФ
Получатель: ВАДИМ
Карта: 2200701726843458
СБП: +79397118869`;
});

let leaveFeedbackText = '';

database.ref('leaveFeedbackText').once('value').then((snapshot) => {
  leaveFeedbackText = snapshot.val() || 'Ваш заказ был выполнен! Спасибо за покупку. Пожалуйста, напишите отзыв в группе и помогите улучшить качество работы. https://t.me/Bolnojot'
});

let productsUc = [];

database.ref('productsUc').once('value').then((snapshot) => {
  productsUc = snapshot.val() || [  { label: '60', price: 88 },
    { label: '120', price: 176 },
    { label: '180', price: 264 },
    { label: '240', price: 352 },
    { label: '325', price: 470 },
    { label: '360', price: 525 },
    { label: '385', price: 558 },
    { label: '660', price: 960 },
    { label: '1320', price: 1900 },
    { label: '1800', price: 2600 },
    { label: '1920', price: 2700 },
    { label: '3850', price: 5000 },
    { label: '8100', price: 9000 },
    { label: '16200', price: 17800 },
  ];
});

let productsPopularity = [];

database.ref('productsPopularity').once('value').then((snapshot) => {
  productsPopularity = snapshot.val() || [];
})

let productsSubs = [];

database.ref('productsSubs').once('value').then((snapshot) => {
  productsSubs = snapshot.val() || [];
})

let userBalances = {};

database.ref('userBalances').once('value').then((snapshot) => {
  userBalances = snapshot.val() || {};
});

let bonusRate = 0.01

database.ref('bonusRate').once('value').then((snapshot) => {
  bonusRate = snapshot.val() || 0.01;
});

let referralCounts = {};

database.ref('referralCounts').once('value').then((snapshot) => {
  referralCounts = snapshot.val() || {};
})

let awaitingDeposit = {};
let awaitingReceipt = {};
let awaitingPubgId = {};
let pendingChecks = {};
let awaitingToChangeProduct = {};
let awaitingNewProductLabel = {};
let awaitingNewProductPrice = {};
let awaitingBonusRate = {};
let awaitingToChangeCredentials = {};
let awaitingToChangeFeedbackText = {};
let awaitingUserToChangeBalance = {};
let awaitingToChangeBalance = {};
let awaitingToCreateMailing = {};
let awaitingToAddAdmin = {};
let awaitingToRemoveAdmin = {};

database.ref('pendingChecks').once('value').then((snapshot) => {
  pendingChecks = snapshot.val() || {}
})

const commands = [
  { command: 'start', description: 'Главное меню' }
]

bot.setMyCommands(commands);

const mainMenu = {
  reply_markup: {
    keyboard: [
      [{ text: 'Каталог 💰' }],
      [{ text: 'Баланс 💳' }],
      [{ text: 'Реферальная система 🔗' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  },
};

const adminMenu = {
  reply_markup: {
    keyboard: [
      [{ text: 'Каталог 💰' }],
      [{ text: 'Баланс 💳' }],
      [{ text: 'Реферальная система 🔗' }],
      [{ text: 'Меню администратора ⚙️' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  },
};

const adminActionsMenu = {
  reply_markup: {
    keyboard: [
      [{text: 'Управление товарами 🛠️'}],
      [{ text: 'Редактировать реквизиты 💳' }, { text: 'Редактировать реферальный %' }],
      [{ text: 'Редактировать баланс 💳' }],
      [{ text: 'Сделать рассылку ✉️' }],
      [{ text: 'Добавить администратора 👤' }, { text: 'Удалить администратора 🗑️' }],
      [{ text: 'Редактировать прощальный текст 🔤' }],
      [{ text: 'Назад ↩️' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

const cancelMenu = {
  reply_markup: {
    keyboard: [
      [{ text: 'Отмена' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};

function capitalizeFirstLetter(string) {
return string.charAt(0).toUpperCase() + string.slice(1);
}

const getCurrentProducts = (type) => {
  switch (type) {
    case 'uc':
      return productsUc;
    case 'popularity':
      return productsPopularity;
    case 'subs':
      return productsSubs;
  }
}

const updateProducts = async (type, newProducts) => {
  switch (type) {
    case 'uc':
      productsUc = newProducts;
      break;
    case 'popularity':
      productsPopularity = newProducts;
      break;
    case 'subs':
      productsSubs = newProducts;
      break;
  }

  await database.ref(`products${capitalizeFirstLetter(type)}`).set(newProducts);
}

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referrerId = match[1];
  const menu = isAdmin(chatId) ? adminMenu : mainMenu;

  if (userBalances[chatId] || userBalances[chatId] === 0) {
    await bot.sendPhoto(chatId, IMAGES.welcome, {
      caption: 'Вы уже зарегистрированы. Что вы хотите сделать?',
      ...menu
    })
  } else {
    if (referrerId && referrerId !== chatId.toString() && (userBalances[referrerId] || userBalances[referrerId] === 0)) {
      await database.ref(`referrals/${chatId}`).set({
        referrerId: referrerId
      });

      if (referralCounts[referrerId]) {
        referralCounts[referrerId] += 1;
      } else {
        referralCounts[referrerId] = 1;
      }
    
      await database.ref('referralCounts').set(referralCounts)

      await bot.sendMessage(referrerId, `У вас новый реферал! ID: ${chatId}. Количество ваших рефералов: ${referralCounts[referrerId]}`);
    }
  
    if (!userBalances[chatId]) {
      userBalances[chatId] = 0;
  
      await database.ref(`userBalances/${chatId}`).set(userBalances[chatId])
        .catch((error) => {
          console.error(`Error adding user to database: ${error}`);
        });
    }
  
    await bot.sendPhoto(chatId, IMAGES.welcome, {
      caption: 'Добро пожаловать!. Что вы хотите сделать?',
      ...menu
    }).catch((error) => {
      console.error('error sending photo: ', error)
    })
  }
});

const getUserTag = (msg) => {
  const username = msg.from.username ? `@${msg.from.username}` : `${msg.from.first_name || 'Пользователь'}`;
  return username;
};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userTag = getUserTag(msg);

  const replyToMessage = msg.reply_to_message;
  
  const menu = isAdmin(chatId) ? adminMenu : mainMenu;
  
  if (isAdmin(chatId) && replyToMessage) {
    if (replyToMessage.forward_from) {
      const userId = replyToMessage.forward_from.id;
  
      await bot.sendMessage(userId, `Ответ от администратора: ${msg.text}`).then(() => {
        sendMessageToAllAdmins(`Ответ от ${userTag} пользователю с ID ${userId} был отправлен.`)
      });
    }
  }

  if (text === 'Отмена') {
    awaitingPubgId[chatId] = false;
    awaitingDeposit[chatId] = false;
    awaitingReceipt[chatId] = false;
    awaitingDeposit[chatId] = false;
    awaitingReceipt[chatId] = false;
    awaitingPubgId[chatId] = false;
    awaitingToChangeProduct[chatId] = false;
    awaitingNewProductLabel[chatId] = false;
    awaitingNewProductPrice[chatId] = false;
    awaitingBonusRate[chatId] = false;
    awaitingToChangeCredentials[chatId] = false;
    awaitingToChangeFeedbackText[chatId] = false;
    awaitingUserToChangeBalance[chatId] = false;
    awaitingToChangeBalance[chatId] = false;
    awaitingToCreateMailing[chatId] = false;
    awaitingToAddAdmin[chatId] = false;
    awaitingToRemoveAdmin[chatId] = false;
    await bot.sendMessage(chatId, 'Действие отменено. Вы вернулись в главное меню.', menu);
    return;
  }

  if (awaitingPubgId[chatId]) {
    const pubgId = text;
    const purchaseInfo = awaitingPubgId[chatId];
    const type = purchaseInfo.type;
    const itemPrice = purchaseInfo.price;
    const label = purchaseInfo.label;

    if (userBalances[chatId] >= itemPrice) {
      userBalances[chatId] -= itemPrice;

      await database.ref('userBalances').set(userBalances);

      sendMessageToAllAdmins(`Пользователь ${userTag} (ID: ${chatId}) ввел PUBG ID: ${pubgId} для товара ${label} (${type}) на сумму ${itemPrice}₽. Средства списаны с баланса.`, [
        [{ text: 'Заказ выполнен', callback_data: `order_completed_${chatId}` }],
      ])
      forwardMessageToAllAdmins(chatId, msg.message_id);

      await bot.sendMessage(chatId, `Спасибо! Ваш PUBG ID: ${pubgId} был отправлен администратору. С вашего баланса списано ${itemPrice}₽. Ожидайте обработки заказа.`, menu);
    } else {
      const missingAmount = itemPrice - userBalances[chatId];
      await bot.sendMessage(chatId, `Недостаточно средств на балансе для покупки этого товара. Вам не хватает ${missingAmount}₽.`);
      await bot.sendMessage(chatId, 'Пожалуйста, пополните баланс, чтобы продолжить покупку.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Пополнить баланс', callback_data: 'deposit' }],
          ]
        },
      });
    }

    awaitingPubgId[chatId] = false;
    
    return;
  } else if (awaitingDeposit[chatId]) {
    const amount = parseFloat(text);

    if (isNaN(amount) || amount < 100) {
      await bot.sendMessage(chatId, 'Минимальная сумма пополнения 100₽');
      return;
    }

    await bot.sendPhoto(chatId, IMAGES.receipt, {
      caption: `Совершите перевод на указанную вами сумму ⤵️

${paymentDetails}

Сумма: ${amount}₽

В ОТВЕТНОМ СООБЩЕНИИ ПРИШЛИТЕ ЧЕК ТРАНЗАКЦИИ
ЛЮБЛЮ ЧАЕВЫЕ 🥰`,
      ...cancelMenu
    })

    awaitingDeposit[chatId] = false;
    awaitingReceipt[chatId] = {
      amount: amount,
      userTag: userTag,
      userId: chatId
    };

    return;
  } else if (awaitingReceipt[chatId]) {
    forwardMessageToAllAdmins(chatId, msg.message_id)
    pendingChecks[chatId] = {
      amount: awaitingReceipt[chatId].amount,
      userTag: awaitingReceipt[chatId].userTag,
      userId: chatId,
    }

    database.ref('pendingChecks').set(pendingChecks);
    await bot.sendMessage(chatId, 'Чек получен и отправлен администратору на проверку. Ожидайте подтверждения.', menu);
    
    const userInfo = pendingChecks[chatId];
    sendMessageToAllAdmins(`${userTag} (ID: ${chatId}) отправил чек для пополнения на сумму ${userInfo.amount}₽. Пожалуйста, проверьте.`, [
      [{ text: 'Подтвердить', callback_data: `confirm_${chatId}` }],
      [{ text: 'Отменить', callback_data: `reject_${chatId}` }],
    ])

    awaitingReceipt[chatId] = false;

    return;
  } else if (awaitingToChangeProduct[chatId]) {
    const type = awaitingToChangeProduct[chatId].type;
    const currentProducts = getCurrentProducts(type);
    const product = awaitingToChangeProduct[chatId].product;

    const newPrice = parseFloat(msg.text);
    if (isNaN(newPrice)) {
        await bot.sendMessage(chatId, 'Пожалуйста, введите корректную цену.');
        return;
    }

    product.price = newPrice;

    updateProducts(type, currentProducts)
    .then(async () => {
        await bot.sendMessage(chatId, `Цена товара ${product.label} была изменена на ${newPrice}$.`, menu);
    })
    .catch(async (error) => {
        await bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.');
        console.error(error);
    });
    awaitingToChangeProduct[chatId] = false
    
      return;
  } else if (awaitingNewProductLabel[chatId]) {
    const type = awaitingNewProductLabel[chatId].type;
    const newLabel = msg.text;
    await bot.sendMessage(chatId, `Введите цену для нового товара (${newLabel}): `, cancelMenu);

    awaitingNewProductLabel[chatId] = false;
    awaitingNewProductPrice[chatId] = {type, newLabel};
    
    return;
  } else if (awaitingNewProductPrice[chatId]) {
    const type = awaitingNewProductPrice[chatId].type;
    const newLabel = awaitingNewProductPrice[chatId].newLabel
    const newPrice = parseFloat(msg.text);
    if (isNaN(newPrice)) {
      await bot.sendMessage(chatId, 'Пожалуйста, введите корректную цену');
      return;
    }

    const currentProducts = getCurrentProducts(type);

    currentProducts.push({label: newLabel, price: newPrice});

    currentProducts.sort((a, b) => {
      return parseInt(a.label, 10) - parseInt(b.label, 10);
    });

    updateProducts(type, currentProducts)
    .then(async () => {
        await bot.sendMessage(chatId, `Новый товар ${newLabel} был добавлен по цене ${newPrice}`, menu);
    })
    .catch(async (error) => {
        await bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.', menu);
        console.error(error);
    });

    awaitingNewProductPrice[chatId] = false;
    
    return;
  } else if (awaitingToChangeCredentials[chatId]) {
    paymentDetails = msg.text;
      database.ref('paymentDetails').set(paymentDetails)
        .then(async () => {
          await bot.sendMessage(chatId, `Реквизиты были успешно изменены на: ${paymentDetails}`, menu);
        })
        .catch(async (error) => {
          await bot.sendMessage(chatId, 'Ошибка сохранения реквизитов в Firebase.', menu);
          console.error(error);
    });

    awaitingToChangeCredentials[chatId] = false;
    
    return;
  } else if (awaitingToChangeFeedbackText[chatId]) {
    leaveFeedbackText = msg.text;
    database.ref('leaveFeedbackText').set(leaveFeedbackText)
      .then(async () => {
        await bot.sendMessage(chatId, 'Прощальный текст был успешно изменен.')
      })
      .catch(async (error) => {
        await bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.', menu);
        console.log(error);
      })

    awaitingToChangeFeedbackText[chatId] = false;
    return;
  } else if (awaitingBonusRate[chatId]) {
    const newBonusRate = parseFloat(msg.text) / 100;

    if (isNaN(newBonusRate)) {
      await bot.sendMessage(chatId, 'Пожалуйста, введите корректный процент.');
      return;
    }

    bonusRate = newBonusRate;
    const bonusRatePercentage = (bonusRate * 100).toFixed(1);
    database.ref('bonusRate').set(bonusRate)
      .then(async () => {
        await bot.sendMessage(chatId, `Реферальный бонус был изменен ${bonusRatePercentage}%`, menu)
      })
      .catch(async (error) => {
        await bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.', menu);
        console.error(error);
      });
    
    awaitingBonusRate[chatId] = false;
    
    return;
  } else if (awaitingUserToChangeBalance[chatId]) {
    const userId = msg.text;
    
    await bot.sendMessage(chatId, `Баланс пользователя ${userBalances[userId]}. Введите новую сумму для баланса:`);

    awaitingToChangeBalance[chatId] = {userId}
    awaitingUserToChangeBalance[chatId] = false
    
    return;
  } else if (awaitingToChangeBalance[chatId]) {
    const newBalance = parseFloat(msg.text);
    const userId = awaitingToChangeBalance[chatId].userId

    if (isNaN(newBalance)) {
      await bot.sendMessage(chatId, 'Пожалуйста, введите корректную сумму.');
      return;
    }

    if (userBalances[userId] || userBalances[userId] === 0) {
      userBalances[userId] = newBalance;
      database.ref('userBalances').set(userBalances)
        .then(async () => {
          await bot.sendMessage(chatId, `Баланс пользователя с ID ${userId} был изменен на ${newBalance}₽.`, menu);
        })
        .catch(async (error) => {
          await bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.', menu);
          console.error(error);
        });
    } else {
      await bot.sendMessage(chatId, 'Пользователя с таким id нет.', menu)
    }

    awaitingToChangeBalance[chatId] = false
    
    return;
  } else if (awaitingToCreateMailing[chatId]) {
      const broadcastMessage = msg.text;
      
      if (!broadcastMessage) {
        return await bot.sendMessage(chatId, 'Сообщение не может быть пустым.');
      }

      const sendBroadcastMessage = async () => {
        if (!userBalances) {
          return await bot.sendMessage(chatId, 'Нет пользователей для рассылки.');
        }

        const userIds = Object.keys(userBalances);
        for (const userId of userIds) {
          try {
            await bot.sendMessage(userId, broadcastMessage);
          } catch (error) {
            if (error.response && error.response.statusCode === 429) {
              const retryAfter = error.response.body.parameters.retry_after || 1;
              console.log(`Превышен лимит запросов, повтор через ${retryAfter} секунд...`);
              await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            }
          }
      
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        await bot.sendMessage(chatId, `Сообщение успешно отправлено ${userIds.length} пользователям.`, menu);
      };

      sendBroadcastMessage();

      awaitingToCreateMailing[chatId] = false;
      return;
  } else if (awaitingToAddAdmin[chatId]) {
    const newAdminId = msg.text;
    if (!userBalances.hasOwnProperty(newAdminId)) {
      await bot.sendMessage(chatId, `Пользователь с ID "${newAdminId}" не существует. Пожалуйста, проверьте введенный ID и попробуйте еще раз. Возможно пользователь не зарегистрирован в боте`);
      return;
    }
    if (!admins[newAdminId]) {
      admins[newAdminId] = true;
      database.ref('admins').set(admins)
        .then(async () => {
          await bot.sendMessage(chatId, `Пользователь с ID ${newAdminId} добавлен как администратор.`, menu);
          await bot.sendMessage(newAdminId, 'Вы были добавлены в качестве администратора.');
        })
        .catch(async (error) => {
          await bot.sendMessage(chatId, `Произошла ошибка: ${error.message}`);
        });
    } else {
      await bot.sendMessage(chatId, `Пользователь с ID ${newAdminId} уже является администратором.`, menu);
    }

    awaitingToAddAdmin[chatId] = false;
    
    return;
  } else if (awaitingToRemoveAdmin[chatId]) {
    const adminIdToRemove = msg.text;

    if (admins[adminIdToRemove]) {
      if (adminIdToRemove === ADMIN_CHAT_ID) {
        await bot.sendMessage(chatId, 'Нельзя удалить главного администратора', menu);
      } else {
        delete admins[adminIdToRemove];
        database.ref('admins').set(admins)
            .then(async () => {
                await bot.sendMessage(chatId, `Пользователь с ID ${adminIdToRemove} был удален из списка администраторов.`, menu);
                await bot.sendMessage(adminIdToRemove, 'Вы были удалены из списка администраторов.');
            })
            .catch(async (error) => {
                await bot.sendMessage(chatId, `Произошла ошибка: ${error.message}`);
            });
      }
    } else {
        await bot.sendMessage(chatId, `Пользователь с ID ${adminIdToRemove} не является администратором.`, menu);
    }

    awaitingToRemoveAdmin[chatId] = false;
    
    return;
  }

  if (text === 'Баланс 💳') {
    const balance = userBalances[chatId];
    bot.sendMessage(chatId, `Ваш текущий баланс: ${balance}₽`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Пополнить баланс', callback_data: 'deposit' }],
        ],
      },
    });
    
    return;
  } else if (text === 'Каталог 💰') {
    await bot.sendPhoto(chatId, IMAGES.welcome, {
      caption: '🛒 Выберите категорию товаров: ',
      reply_markup: {
        inline_keyboard: [
          [{text: 'UC', callback_data: 'open-catalog_uc'}],
          [{text: 'Популярность', callback_data: 'open-catalog_popularity'}],
          [{text: 'Подписки', callback_data: 'open-catalog_subs'}]
        ]
      }
    })
  } else if (text === 'Реферальная система 🔗') {
    const referralLink = `https://t.me/BoJlHoyUc_bot?start=${chatId}`;

    await bot.sendMessage(chatId, `Ваша реферальная ссылка: ${referralLink}. Количество ваших рефералов: ${referralCounts[chatId] || 0}. Пригласите друзей и получайте бонусы за их покупки! С каждого пополнения вашего друга вы получите ${bonusRate * 100}% на ваш баланс`);
    
    return;
  } else if (text === 'Меню администратора ⚙️') {
    if (!isAdmin(chatId)) {
      return; 
    }
    await bot.sendMessage(chatId, 'Выберите действие:', adminActionsMenu);
    
    return;
  } else if (text === 'Назад ↩️') {
    if (!isAdmin(chatId)) {
      return; 
    }
    await bot.sendMessage(chatId, 'Вы вернулись в главное меню:', adminMenu);
    
    return;
  } else if (text === 'Управление товарами 🛠️') {
    if (!isAdmin(chatId)) return;

    await bot.sendPhoto(chatId, IMAGES.welcome, {
      caption: 'Выберите категорию товаров для изменения:',
      reply_markup: {
        inline_keyboard: [
          [{text: 'UC', callback_data: 'manage-products_uc'}],
          [{text: 'Популярность', callback_data: 'manage-products_popularity'}],
          [{text: 'Подписки', callback_data: 'manage-products_subs'}]
        ]
      }
    })
  } else if (text === 'Редактировать реквизиты 💳') {
    if (!isAdmin(chatId)) {
      return; 
    }
  
    await bot.sendMessage(chatId, 'Введите новые реквизиты для пополнения:', cancelMenu);

    awaitingToChangeCredentials[chatId] = true;
    
    return;
  } else if (text === 'Редактировать прощальный текст 🔤') {
    if (!isAdmin(chatId)) {
      return; 
    }
  
    await bot.sendMessage(chatId, 'Введите новый прощальный текст:', cancelMenu);

    awaitingToChangeFeedbackText[chatId] = true;
    
    return;
  } else if (text === 'Редактировать реферальный %') {
    if (!isAdmin(chatId)) {
      return; 
    }

    await bot.sendMessage(chatId, 'Введите новый бонус для рефералов в процентах:', cancelMenu)

    awaitingBonusRate[chatId] = true;
    
    return;
  } else if (text === 'Редактировать баланс 💳') {
    if (!isAdmin(chatId)) {
      return; 
    }
  
    await bot.sendMessage(chatId, 'Введите ID пользователя, чей баланс вы хотите изменить:', cancelMenu);

    awaitingUserToChangeBalance[chatId] = true;
    
    return;
  }  else if (text === 'Сделать рассылку ✉️') {
    if (!isAdmin(chatId)) {
      return; 
    }
  
    await bot.sendMessage(chatId, 'Отправьте текст сообщения, которое хотите разослать всем пользователям:', cancelMenu);
    
    awaitingToCreateMailing[chatId] = true;
    
    return;
  } else if (text === 'Добавить администратора 👤') {
    if (!isAdmin(chatId)) {
      return; 
    }

    await bot.sendMessage(chatId, 'Введить Id пользователя, которого хотите сделать администратором: ', cancelMenu)
    
    awaitingToAddAdmin[chatId] = true;
    
    return;
  } else if (text === 'Удалить администратора 🗑️') {
    if (!isAdmin(chatId)) {
      return; 
    }

    await bot.sendMessage(chatId, 'Введите ID администратора, которого хотите удалить: ', cancelMenu);
    
    awaitingToRemoveAdmin[chatId] = true;
    
    return;
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const messageId = query.message.message_id;
  const menu = isAdmin(chatId) ? adminMenu : mainMenu;

  try {
    if (userBalances[chatId] === undefined) {
      userBalances[chatId] = 0;
    }
  
    if (data.startsWith('confirm_')) {
      const userId = data.split('_')[1];
      const userInfo = pendingChecks[userId];
  
      if (!isAdmin(query.from.id)) {
        return
      }
  
      if (userInfo) {
        const depositAmount = userInfo.amount;
  
        userBalances[userId] = (userBalances[userId] || 0) + depositAmount;
  
        await database.ref('userBalances').set(userBalances);
  
        await database.ref(`referrals/${userId}`).once('value', async (snapshot) => {
          if (snapshot.exists()) {
            const referralData = snapshot.val();
            const referrerId = referralData[Object.keys(referralData)[0]];
            const bonus = parseFloat((depositAmount * bonusRate).toFixed(3));
  
            userBalances[referrerId] = (userBalances[referrerId] || 0) + bonus;
            await database.ref('userBalances').set(userBalances);
  
            await bot.sendMessage(referrerId, `Ваш реферал пополнил баланс на ${depositAmount}₽. Вам начислено ${bonus}₽ в качестве бонуса.`);
          }
        });
  
        await sendMessageToAllAdmins(`Пополнение на ${depositAmount}₽ для ${userInfo.userTag} (ID: ${userId}) подтверждено.`);
        await bot.sendMessage(userId, `Ваш баланс был пополнен на ${depositAmount}₽. Текущий баланс: ${userBalances[userId]}₽.`);
  
        delete pendingChecks[userId];
        await database.ref('pendingChecks').set(pendingChecks);
      }
      
      return;
    } else if (data.startsWith('reject_')) {
      const userId = data.split('_')[1];
      const userInfo = pendingChecks[userId];
  
      if (!isAdmin(query.from.id)) {
        return
      }
  
      if (userInfo) {
        await sendMessageToAllAdmins(`Пополнение на ${userInfo.amount}₽ для ${userInfo.userTag} (ID: ${userId}) отменено.`);
        await bot.sendMessage(userId, `Ваше пополнение на сумму ${userInfo.amount}₽ было отклонено. Пожалуйста, попробуйте снова.`);
  
        delete pendingChecks[userId];
        await database.ref('pendingChecks').set(pendingChecks);
      }
      
      return;
    } else if (data.startsWith('open-catalog_')) {
      const type = data.split('_')[1];
  
      const currentProducts = getCurrentProducts(type);

      if (!currentProducts || currentProducts.length === 0) {
        await bot.answerCallbackQuery(query.id, {
          text: '📭 В этой категории пока нет товаров',
          show_alert: true
        });
        return;
      }
  
      const keyboard = [];
      for (let i = 0; i < currentProducts.length; i += 2) {
        const row = currentProducts.slice(i, i + 2).map(item => ({
          text: `${item.label} - ${item.price}₽`,
          callback_data: `buy_${type}_${item.label}`,
        }));
        keyboard.push(row);
      }

      keyboard.push([{ text: '🔙 Назад', callback_data: 'back-to-catalog' }])
  
      await bot.editMessageMedia({
        type: 'photo',
        media: IMAGES.pack,
        caption: '🛒 Выберите пак:'
      }, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: keyboard
        }
      })
      
      return;
    } else if (data === 'back-to-catalog') {
      await bot.editMessageMedia({
        type: 'photo',
        media: IMAGES.welcome,
        caption: '🛒 Выберите категорию товаров:'
      }, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: 'UC', callback_data: 'open-catalog_uc'}],
            [{text: 'Популярность', callback_data: 'open-catalog_popularity'}],
            [{text: 'Подписки', callback_data: 'open-catalog_subs'}]
          ]
        }
      });
      return;
    } else if (data.startsWith('buy_')) {
      const [_, type, label] = data.split('_');
      const currentProducts = getCurrentProducts(type);
      const product = currentProducts.find(p => p.label === label);
          
      if (!product) {
          await bot.sendMessage(chatId, '⚠️ Товар временно недоступен.');
          return;
      }
      
      const actualPrice = product.price;
          
      const numericPrice = Number(actualPrice);
      
      await bot.sendMessage(chatId, `Вы выбрали товар: ${label} за ${numericPrice}₽. Пожалуйста, введите ваш ID в PUBG:`, cancelMenu);
      
      awaitingPubgId[chatId] = { type, label, price: numericPrice };
      awaitingDeposit[chatId] = false;
      
      return;
    } else if (data.startsWith('manage-products_')) {
      if (!isAdmin(chatId)) return;
      const type = data.split('_')[1];
      const currentProducts = getCurrentProducts(type);
  
      const productsManagementKeyboard = (currentProducts) => {
        const buttons = currentProducts.map(p => ({
          text: `${p.label} - ${p.price}$`,
          callback_data: `edit-product_${type}_${p.label}`
        }));
        
        const chunks = [];
        while (buttons.length) chunks.push(buttons.splice(0, 2));
        
        chunks.push(
          [{text: '➕ Добавить товар', callback_data: `add-product_${type}`}, {text: '➖ Удалить товар', callback_data: `delete-product-list_${type}`}],
          [{text: '🔙 Назад', callback_data: 'admin-panel'}]
        );
        
        return chunks;
      };
  
      await bot.editMessageCaption(`🛠 Управление товарами (Категория: ${type}):`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {inline_keyboard: productsManagementKeyboard(currentProducts)}
      });
  
      return;
    } else if (data.startsWith('edit-product_')) {
      if (!isAdmin(chatId)) return;
      const [, type, label] = data.split('_');
  
      const currentProducts = getCurrentProducts(type);
      const product = currentProducts.find(p => p.label === label);
  
      if (!product) {
          await bot.sendMessage(chatId, `Товар с меткой ${label} не найден.`);
          return;
      }
  
      await bot.sendMessage(chatId, `Введите новую цену для товара ${label}:`);
  
      awaitingToChangeProduct[chatId] = {type, product}
  
      return;
    } else if (data.startsWith('delete-product-list_')) {
      if (!isAdmin(chatId)) return;
  
      const type = data.split('_')[1];
  
      const productButtons = getCurrentProducts(type).map(product => ({
        text: `${product.label} - ${product.price}$`,
        callback_data: `delete-product_${type}_${product.label}`
      }));
  
      const deleteProductsKeyboard = [];
      for (let i = 0; i < productButtons.length; i += 2) {
        deleteProductsKeyboard.push(productButtons.slice(i, i + 2));
      }
      deleteProductsKeyboard.push([{text: '❌ Отмена', callback_data: 'admin-panel'}])
  
      await bot.editMessageCaption('Выберите товар, который хотите удалить:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: deleteProductsKeyboard
        }
      });
  
      return;
    } else if (data.startsWith('add-product_')) {
      if (!isAdmin(chatId)) return;
  
      const type = data.split('_')[1];
      awaitingNewProductLabel[chatId] = {type};
  
      await bot.editMessageCaption('Введите название нового товара:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'admin-panel'}]]}
      })
  
      return;
    } else if (data.startsWith('delete-product_')) {
      if (!isAdmin(chatId)) return;
  
      const [, type, labelToDelete] = data.split('_');
  
      const currentProducts = getCurrentProducts(type);
  
      const product = currentProducts.find(p => p.label === labelToDelete);
      if (!product) {
          await bot.sendMessage(chatId, `Товар с меткой ${labelToDelete} не найден.`);
          return;
      }
  
      const index = currentProducts.findIndex(product => product.label === labelToDelete);
  
      if (index !== -1) {
        currentProducts.splice(index, 1);
        updateProducts(type, currentProducts)
        .then(async () => {
            await bot.sendMessage(chatId, `Товар ${labelToDelete}UC был удален.`, menu);
        })
        .catch(async (error) => {
            await bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.');
            console.error(error);
        });
      } else {
        await bot.sendMessage(chatId, `Товар ${labelToDelete}UC не найден.`);
      }
  
      return;
    } else if (data.startsWith('order_completed_')) {
      const userId = data.split('_')[2];
      const message = query.message;
  
      if (!isAdmin(query.from.id)) {
        return
      }
  
        sendMessageToAllAdmins(`Заказ для пользователя с ID ${userId} был выполнен.`);
    
        await bot.sendMessage(userId, leaveFeedbackText);
    
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
          chat_id: message.chat.id,
          message_id: message.message_id,
        });
  
      return;
    } else if (data === 'deposit') {
      await bot.sendPhoto(chatId, IMAGES.amount, {
        caption: 'Введите сумму для пополнения',
        ...cancelMenu
      })
      awaitingDeposit[chatId] = true;
  
      return;
    }
  } catch (error) {
    if (error.code === 'EFATAL' && error.response?.statusCode === 403) {
      console.log('Бот был заблокирован пользователем');
    } else {
        console.error(`Polling error: ${error}`);
    }
  }
});
