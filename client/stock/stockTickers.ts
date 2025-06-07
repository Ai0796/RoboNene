// client/stock/stockTickers.ts
interface StockTickers {
    [key: string]: string;
  }
  
  const prskChars: StockTickers = {
    'MIKU': 'SGAMY',
    'RIN': 'INTC',
    'LEN': 'AMD',
    'LUKA': 'SPY',
    'MEIK': 'SBUX',
    'KAIT': 'UL',
    'ICHK': 'YAMCY',
    'SAKI': 'YAMCY',
    'HONA': '', // No ticker provided in original
    'SBIB': 'KWHIY',
    'MINO': 'SONY',
    'HARU': 'LUV',
    'AIRI': '', // No ticker provided in original
    'SZKU': 'META',
    'KOHA': 'MC.PA',
    'AN': 'FRCOY',
    'TOE': 'GOOS',
    'TOYA': 'NKE',
    'TSKA': 'BTC',
    'EMU': 'DIS',
    'NENE': 'NTDOY',
    'RUI': 'ETH',
    'KND': 'TSUKF',
    'MFY': '', // No ticker provided in original
    'ENA': 'WIX',
    'MZK': 'ITX.MC',
    'BPM': 'CRAI'
  };
  
  export default prskChars;