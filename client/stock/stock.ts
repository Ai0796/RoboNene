// client/stock/stock.ts
import fetch from 'node-fetch'; // Importing fetch as a default export for Node.js environments

interface StockData {
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
  'Exchange Rate'?: string; // For crypto
  // Add other potential keys if they exist in the API response
}

class Stock {
  private APIKEY: string;

  constructor(APIKEY: string) {
    this.APIKEY = APIKEY;
  }

  private async formatKey(key: string): Promise<string> {
    const frags = key.split(' ');
    for (let i = 0; i < frags.length; i++) {
      frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
    }
    return frags.join(' ');
  }

  /**
   * @param {String} symbol stock symbol, or optionally a project sekai character/ticker
   * @returns {Promise<StockData>} containing stock data
   */
  async getStockData(symbol: string): Promise<StockData> {
    const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.APIKEY}`);
    const data: any = await response.json();

    const returnData: StockData = {};

    if (data && data['Global Quote']) {
      for (const key in data['Global Quote']) {
        if (Object.prototype.hasOwnProperty.call(data['Global Quote'], key)) {
          const newKey = await this.formatKey(key.substring(4));
          returnData[newKey as keyof StockData] = data['Global Quote'][key];
        }
      }
    }
    return returnData;
  }

  async getCryptoData(symbol: string): Promise<StockData> {
    const response = await fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol}&to_currency=USD&apikey=${this.APIKEY}`);
    const data: any = await response.json();

    const returnData: StockData = {};

    const exemptKeys = ['1. From_Currency Code', '2. From_Currency Name', '3. To_Currency Code', '4. To_Currency Name'];

    if (data && data['Realtime Currency Exchange Rate']) {
      for (const key in data['Realtime Currency Exchange Rate']) {
        if (Object.prototype.hasOwnProperty.call(data['Realtime Currency Exchange Rate'], key)) {
          const newKey = await this.formatKey(key.substring(3));
          if (!exemptKeys.includes(key)) {
            returnData[newKey as keyof StockData] = data['Realtime Currency Exchange Rate'][key];
          }
        }
      }
      if (returnData['Exchange Rate']) {
        returnData['Price'] = returnData['Exchange Rate']; // Alias Exchange Rate to Price for consistency
      }
    }

    return returnData;
  }
}

export default Stock;