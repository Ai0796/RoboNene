// client/commands/stock.ts
/**
 * @fileoverview Displays statistics of a user or tier
 * @author Ai0796
 */

import * as COMMAND from '../command_data/stock'; // Assuming command_data/stock.ts is converted
import { stockApiKey } from '../../config'; // Import from TS config
import generateSlashCommand from '../methods/generateSlashCommand';
import generateEmbed from '../methods/generateEmbed';
import Stocks from '../stock/stock'; // Assuming stock.ts is converted
import prskChars from '../stock/stockTickers'; // Assuming stockTickers.ts is converted
import DiscordClient from '../client'; // Assuming default export
import { CommandInteraction, GuildMember } from 'discord.js'; // Import necessary types

const stocks = new Stocks(stockApiKey);

/**
 * Ensures a string is ASCII to be sent through HTML
 * @param {string} str the string to be converted to ASCII
 * @returns {string}
 */
async function ensureAtoZ(str: string): Promise<string> {
  return str.replace(/[^a-zA-Z]/gi, ''); // Remove non-alphabetic characters
}

interface PrayerData {
  id: string;
  luck: number;
  prays: number;
  lastTimestamp: number;
  totalLuck: number;
}

async function updatePrays(data: PrayerData, discordClient: DiscordClient, id: string): Promise<void> {
  discordClient.prayerdb?.prepare('UPDATE prayers SET ' +
    'luck=@luck, prays=@prays, lastTimestamp=@lastTimestamp, totalLuck = @totalLuck ' +
    'WHERE id=@id').run(
      {
        'id': id,
        'luck': data.luck,
        'prays': data.prays,
        'lastTimestamp': data.lastTimestamp,
        'totalLuck': data.totalLuck
      }
    );
}

interface StockQuoteData {
  Symbol?: string;
  Open?: string;
  High?: string;
  Low?: string;
  Price?: string;
  Volume?: string;
  'Latest Trading Day'?: string;
  'Previous Close'?: string;
  Change?: string;
  'Change Percent'?: string;
  'Exchange Rate'?: string;
}

async function getStockData(ticker: string): Promise<StockQuoteData> {
  let swappedTicker = '';
  const cleanedTicker = await ensureAtoZ(ticker.toUpperCase()); // Ensure uppercase and A-Z only
  if (prskChars[cleanedTicker]) { // Check if it's a PRSK character ticker
    swappedTicker = prskChars[cleanedTicker];
  } else {
    swappedTicker = cleanedTicker;
  }

  let reply: StockQuoteData;

  if (['BTC', 'ETH'].includes(swappedTicker)) {
    reply = await stocks.getCryptoData(swappedTicker);
  } else {
    reply = await stocks.getStockData(swappedTicker);
  }

  // Ensure 'Price' is populated from 'Exchange Rate' for crypto
  if (reply['Exchange Rate'] && !reply['Price']) {
    reply['Price'] = reply['Exchange Rate'];
  }

  return reply;
}

async function sendInvalidTickerError(interaction: CommandInteraction, ticker: string, discordClient: DiscordClient): Promise<void> {
  await interaction.editReply({
    embeds: [
      generateEmbed({
        name: `$${ticker}`,
        content: {
          'type': 'ERROR',
          'message': 'Invalid stock ticker'
        },
        client: discordClient.client
      })
    ]
  });
}

async function sendNoPrayers(interaction: CommandInteraction, discordClient: DiscordClient): Promise<void> {
  await interaction.editReply({
    embeds: [
      generateEmbed({
        name: 'ERROR',
        content: {
          'type': 'ERROR',
          'message': 'ERROR, you have not prayed yet'
        },
        client: discordClient.client
      })
    ]
  });
}

async function sendStockData(ticker: string, interaction: CommandInteraction, discordClient: DiscordClient): Promise<void> {
  const reply = await getStockData(ticker);
  if (Object.keys(reply).length === 0 || !reply.Price) { // Check for empty reply or missing price
    await sendInvalidTickerError(interaction, ticker, discordClient);
    return;
  }

  let returnString = '';

  for (const key in reply) {
    if (Object.prototype.hasOwnProperty.call(reply, key) && key !== 'Symbol') {
      returnString += key.charAt(0).toUpperCase() + key.slice(1);
      returnString += ': ';
      returnString += (reply as any)[key]; // Access dynamically, cast to any
      returnString += '\r';
    }
  }

  await interaction.editReply({
    embeds: [
      generateEmbed({
        name: `$${ticker.toUpperCase()}`, // Display original ticker as uppercase
        content: {
          'type': 'Stock',
          'message': returnString
        },
        client: discordClient.client
      })
    ]
  });
}

interface UserStockPortfolio {
  [ticker: string]: {
    average: number;
    amount: number;
  };
}

async function buyStock(ticker: string, amount: number, interaction: CommandInteraction, discordClient: DiscordClient): Promise<void> {
  const reply = await getStockData(ticker);

  if (Object.keys(reply).length === 0 || !reply.Price) {
    await sendInvalidTickerError(interaction, ticker, discordClient);
    return;
  }

  const praydataResult = discordClient.prayerdb?.prepare('SELECT * FROM prayers ' +
    'WHERE (id=@id)').all({
      id: interaction.user.id
    }) as PrayerData[] | undefined; // Type assertion

  let praydata: PrayerData | undefined;
  if (praydataResult && praydataResult.length > 0) {
    praydata = praydataResult[0];
  } else {
    await sendNoPrayers(interaction, discordClient);
    return;
  }

  const luck = praydata.luck;
  const price = parseFloat(reply.Price);

  if (price * amount > luck) {
    await interaction.editReply({
      embeds: [
        generateEmbed({
          name: 'ERROR',
          content: {
            'type': 'ERROR',
            'message': `ERROR, you do not have enough luck to buy this stock\n cost: ${(price * amount).toFixed(2)}\nluck: ${luck.toFixed(2)}`
          },
          client: discordClient.client
        })
      ]
    });
    return;
  }

  let userData = await discordClient.stockdb?.ref(`stocks/${interaction.user.id}`).get();
  let userStocks: UserStockPortfolio = {};

  if (userData?.exists()) {
    userStocks = userData.val() as UserStockPortfolio;
  }

  const cleanedTicker = await ensureAtoZ(ticker.toUpperCase()); // Ensure cleaned ticker for storage

  // Handle old format where ticker might be just a number
  if (userStocks[cleanedTicker] && (typeof userStocks[cleanedTicker] !== 'object' || !('average' in userStocks[cleanedTicker]))) {
    const tempAmount = (userStocks[cleanedTicker] as any).amount || userStocks[cleanedTicker]; // If it's a number, it's the amount
    userStocks[cleanedTicker] = { average: price, amount: Number(tempAmount) }; // Initialize with current price and old amount
  }

  if (userStocks[cleanedTicker]) {
    userStocks[cleanedTicker].average = (userStocks[cleanedTicker].average * userStocks[cleanedTicker].amount + price * amount) / (userStocks[cleanedTicker].amount + amount);
    userStocks[cleanedTicker].amount += amount;
  } else {
    userStocks[cleanedTicker] = { average: price, amount: amount };
  }

  const message = `You have bought ${amount} shares of ${cleanedTicker} @ ${price.toFixed(2)} for ${(price * amount).toFixed(2)} luck.\n` +
    `You now have ${(luck - price * amount).toFixed(2)} luck left.\n` +
    `You now have ${userStocks[cleanedTicker].amount} shares of ${cleanedTicker}.`;

  await interaction.editReply({
    embeds: [
      generateEmbed({
        name: `$${cleanedTicker}`,
        content: {
          'type': 'Stock',
          'message': message
        },
        client: discordClient.client
      })
    ]
  });

  if (praydata) { // Ensure praydata is defined before modifying
    praydata.luck -= price * amount;
    await updatePrays(praydata, discordClient, interaction.user.id);
  }
  await discordClient.stockdb?.ref(`stocks/${interaction.user.id}`).set(userStocks);
}

async function sellStock(ticker: string, amount: number, interaction: CommandInteraction, discordClient: DiscordClient): Promise<void> {
  const reply = await getStockData(ticker);

  if (Object.keys(reply).length === 0 || !reply.Price) {
    await sendInvalidTickerError(interaction, ticker, discordClient);
    return;
  }

  const praydataResult = discordClient.prayerdb?.prepare('SELECT * FROM prayers ' +
    'WHERE (id=@id)').all({
      id: interaction.user.id
    }) as PrayerData[] | undefined; // Type assertion

  let praydata: PrayerData | undefined;
  if (praydataResult && praydataResult.length > 0) {
    praydata = praydataResult[0];
  } else {
    await sendNoPrayers(interaction, discordClient);
    return;
  }

  const luck = praydata.luck;
  const price = parseFloat(reply.Price);

  let userData = await discordClient.stockdb?.ref(`stocks/${interaction.user.id}`).get();
  let userStocks: UserStockPortfolio = {};

  if (userData?.exists()) {
    userStocks = userData.val() as UserStockPortfolio;
  }

  const cleanedTicker = await ensureAtoZ(ticker.toUpperCase()); // Ensure cleaned ticker for storage

  // Handle old format where ticker might be just a number
  if (userStocks[cleanedTicker] && (typeof userStocks[cleanedTicker] !== 'object' || !('average' in userStocks[cleanedTicker]))) {
    const tempAmount = (userStocks[cleanedTicker] as any).amount || userStocks[cleanedTicker]; // If it's a number, it's the amount
    userStocks[cleanedTicker] = { average: 0, amount: Number(tempAmount) }; // Initialize with 0 average and old amount
  }

  if (!(userStocks[cleanedTicker]) || userStocks[cleanedTicker].amount < amount) {
    const amountHeld = userStocks[cleanedTicker]?.amount || 0;
    await interaction.editReply({
      embeds: [
        generateEmbed({
          name: 'ERROR',
          content: {
            'type': 'ERROR',
            'message': `ERROR, you do not have enough of this stock to sell\n given: ${amount}\nheld: ${amountHeld}`
          },
          client: discordClient.client
        })
      ]
    });
    return;
  }

  userStocks[cleanedTicker].amount -= amount;

  const message = `You have sold ${amount} shares of ${cleanedTicker} @ ${price.toFixed(2)} for ${(price * amount).toFixed(2)} luck.\n` +
    `You now have ${(luck + price * amount).toFixed(2)} luck.\n` +
    `You now have ${userStocks[cleanedTicker].amount} shares of ${cleanedTicker}.`;

  await interaction.editReply({
    embeds: [
      generateEmbed({
        name: `$${cleanedTicker}`,
        content: {
          'type': 'Stock',
          'message': message
        },
        client: discordClient.client
      })
    ]
  });

  if (praydata) { // Ensure praydata is defined before modifying
    praydata.luck += price * amount;
    await updatePrays(praydata, discordClient, interaction.user.id);
  }
  await discordClient.stockdb?.ref(`stocks/${interaction.user.id}`).set(userStocks);
}

async function getStocks(interaction: CommandInteraction, user: GuildMember, discordClient: DiscordClient): Promise<void> {
  const userData = await discordClient.stockdb?.ref(`stocks/${user.id}`).get();
  let userStocks: UserStockPortfolio = {};

  if (userData?.exists()) {
    userStocks = userData.val() as UserStockPortfolio;
  }

  let message = '';
  const keys = Object.keys(userStocks);
  keys.sort(); // Sort keys alphabetically for consistent display

  for (const key of keys) {
    // Handle old format where ticker might be just a number
    if (typeof userStocks[key] !== 'object' || !('average' in userStocks[key])) {
      const tempAmount = (userStocks[key] as any).amount || userStocks[key]; // If it's a number, it's the amount
      userStocks[key] = { average: 0.00, amount: Number(tempAmount) }; // Initialize with 0 average and old amount
    }

    if (userStocks[key].amount === 0) {
      continue;
    }
    message += `${key}: ${userStocks[key].amount} @ ${(userStocks[key].average || 0.00).toFixed(2)}\r\n`;
  }

  if (message === '') {
    message = `${user.displayName} has no stocks.`;
  }

  await interaction.editReply({
    embeds: [
      generateEmbed({
        name: `${user.displayName}'s Stocks`,
        content: {
          'type': 'Stock',
          'message': message
        },
        client: discordClient.client
      })
    ]
  });
}


export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      let stockList = '';
      const keys = Object.keys(prskChars);
      keys.sort();
      for (const key of keys) {
        stockList += key;
        stockList += '\r\n';
      }
      await interaction.editReply({
        embeds: [generateEmbed({
          name: 'Stocks List',
          content: {
            'type': 'Symbols',
            'message': stockList
          },
          client: discordClient.client
        })]
      });
      return;
    }

    else if (subcommand === 'get') {
      const ticker = interaction.options.getString('symbol');
      if (ticker) {
        await sendStockData(ticker, interaction, discordClient);
      }
    }

    else if (subcommand === 'buy') {
      const ticker = interaction.options.getString('symbol');
      const amount = interaction.options.getInteger('amount');
      if (ticker && amount !== null) { // Check for null amount
        await buyStock(ticker, amount, interaction, discordClient);
      }
    }

    else if (subcommand === 'sell') {
      const ticker = interaction.options.getString('symbol');
      const amount = interaction.options.getInteger('amount');
      if (ticker && amount !== null) { // Check for null amount
        await sellStock(ticker, amount, interaction, discordClient);
      }
    }

    else if (subcommand === 'portfolio') {
      const userOption = interaction.options.getMember('user');
      const user = userOption instanceof GuildMember ? userOption : interaction.member instanceof GuildMember ? interaction.member : interaction.user; // Prioritize GuildMember, then Interaction.user for display name

      if (user) {
          await getStocks(interaction, user as GuildMember, discordClient); // Cast to GuildMember
      } else {
          await interaction.editReply('Could not retrieve user for portfolio.');
      }
    }
  }
};