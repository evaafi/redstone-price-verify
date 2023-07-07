 curl "https://api.redstone.finance/prices?symbol=BTC&provider=redstone&limit=1"
// [{ "id": "047907fd-8c7a-4692-ba22-0137fe08d22f", "symbol": "BTC", "provider": "I-5rWUehEv-MjdK9gFw09RxfSLQX9DIHxG614Wf8qo0", "value": 30365.4154744, "liteEvmSignature": "0x2eb0d3361a360c6275f92386b644052715b58444300574da9006b8135af0d8b07080f9534835f066db40f255625e4b015e9624ecb96f02d6f5e6c1113268a9271c", "permawebTx": "mock-permaweb-tx", "version": "0.4", "source": { "ascendex": 30376.005633250003, "band": 30374, "bequant": 30355.765329650003, "binance": 30359.055379, "binanceus": 28323.82, "binanceusdm": 30340.555101500002, "bitcoincom": 30355.765329650003, "bitfinex2": 30398, "bittrex": 30423.877, "btcturk": 30388.455820000003, "cex": 30398, "coinbaseprime": 30376.25, "coinbasepro": 30376.25, "coingecko": 30370, "currencycom": 30363.1, "hitbtc": 30355.765329650003, "hollaex": 30392.695883600005, "huobipro": 30359.965392650003, "kaiko": 30367.136423410568, "kraken": 30364.3, "kucoin": 30362.655433000004, "lbank": 30364.027892322898, "oceanex": 30365.4154744, "okx": 30359.155380500004, "probit": 30385.255772000004 }, "timestamp": 1688739000000, "minutes": 10, "providerPublicKey": "xyTvKiCST8bAT6sxrgkLh8UCX2N1eKvawODuxwq4qOHIdDAZFU_3N2m59rkZ0E7m77GsJuf1I8u0oEJEbxAdT7uD2JTwoYEHauXSxyJYvF0RCcZOhl5P1PJwImd44SJYa_9My7L84D5KXB9SKs8_VThe7ZyOb5HSGLNvMIK6A8IJ4Hr_tg9GYm65CRmtcu18S9mhun8vgw2wi7Gw6oR6mc4vU1I-hrU66Fi7YlXwFieP6YSy01JqoLPhU84EunPQzXPouVSbXjgRU5kFVxtdRy4GK2fzEBFYsQwCQgFrySCrFKHV8AInu9jerfof_DxNKiXkBzlB8nc22CrYnvvio_BWyh-gN0hQHZT0gwMR-A7sbXNCQJfReaIZzX_jP6XoB82PnpzmL_j1mJ2lnv2Rn001flBAx9AYxtGXd9s07pA-FggTbEG3Y2UnlWW6l3EJ93E0IfxL0PqGEUlp217mxUHvmTw9fkGDWa8rT9RPmsTyji-kMFSefclw80cBm_iOsIEutGP4S3LDbP-ZVJWDeJOBQQpSgwbisl8qbjl2sMQLQihoG2TQyNbmLwfyq-XSULkXjUi1_6BH36wnDBLWBKF-bS2bLKcGtn3Vjet72lNHxJJilcj8vpauwJG0078S_lO5uGt6oicdGR6eh_NSn6_8za_tXg0G_fohz4Yb1z8" }]⏎



const isSignatureValid = evmSigner.verifyLiteSignature({
  pricePackage: {
    prices: [
      {
        symbol: price.symbol,
        value: price.value,
      },
    ],
    timestamp: price.timestamp,
  },
  signerAddress: this.providerEvmAddress,
  liteSignature: price.liteEvmSignature,
}

verifyLiteSignature(signedPricePackage: SignedPricePackage): boolean {
  1 - const serializedPriceData = this.serializeToMessage(
    signedPricePackage.pricePackage
  );

  2 - const data = this.getLiteDataToSign(serializedPriceData);

  const signer = recoverPersonalSignature({
    data,
    signature: signedPricePackage.liteSignature,
  });

  const signerAddressUC = signer.toUpperCase();
  const expectedSignerAddress = signedPricePackage.signerAddress;
  const expectedSignerAddressUC = expectedSignerAddress.toUpperCase();

  return signerAddressUC === expectedSignerAddressUC;
}
});

--- 1
serializeToMessage(pricePackage: PricePackage): SerializedPriceData {
  // We clean and sort prices to be sure that prices
  // always have the same format
  const cleanPricesData = pricePackage.prices.map((p) => ({
   --- 1.1 symbol: EvmPriceSigner.convertStringToBytes32String(p.symbol),
   --- 1.2 value: serializePriceValue(p.value),
  }));
  --- 1.3 // imports
  --- 1.3 const sortedPrices = sortDeepObjects(cleanPricesData);

  const symbols: string[] = [];
  const values: string[] = [];
  sortedPrices.forEach((p: ShortSinglePrice) => {
    symbols.push(p.symbol);
    values.push(p.value);
  });
  return {
    symbols,
    values,
    timestamp: pricePackage.timestamp,
  };
}
--- 1.1
  public static convertStringToBytes32String(str: string) {
    if (str.length > 31) {
      // TODO: improve checking if str is a valid bytes32 string later
      const bytes32StringLength = 32 * 2 + 2; // 32 bytes (each byte uses 2 symbols) + 0x
      if (str.length === bytes32StringLength && str.startsWith("0x")) {
        return str;
      } else {
        // Calculate keccak hash if string is bigger than 32 bytes
        return ethers.utils.id(str);
      }
    } else {
      return ethers.utils.formatBytes32String(str);
    }
  }
--- 1.2
const serializePriceValue = (
  value: number | SafeNumber.ISafeNumber
): number => {
  if (typeof value === "number") {
    return Math.round(value * 10 ** 8);
  } else if (value instanceof SafeNumber.JsNativeSafeNumber) {
    return Math.round(value.unsafeToNumber() * 10 ** 8);
  } else {
    throw new Error(`Don't know how to serialize ${value} to price`);
  }
};
--- 2
private getLiteDataToSign(priceData: SerializedPriceData): string {
  --- 2.1 const data = this.getLiteDataBytesString(priceData);
  return bufferToHex(keccak256(toBuffer("0x" + data)));
}

--- 2.1
getLiteDataBytesString(priceData: SerializedPriceData): string {
  // Calculating lite price data bytes array
  let data = "";
  for (let i = 0; i < priceData.symbols.length; i++) {
    const symbol = priceData.symbols[i];
    const value = priceData.values[i];
    data += symbol.substr(2) + value.toString(16).padStart(64, "0");
  }
  data += Math.ceil(priceData.timestamp / 1000)
    .toString(16)
    .padStart(64, "0");

  return data;
}


