import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { beginCell, Cell, toNano, BitString } from 'ton-core';
import { Test } from '../wrappers/Test';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { ethers } from "ethers";
//@ts-ignore
import sortDeepObjectArrays from "sort-deep-object-arrays";
//@ts-ignore
import { toBuffer, bufferToHex, keccak256 } from "ethereumjs-util";
import { personalSign, extractPublicKey, recoverPersonalSignature } from "@metamask/eth-sig-util";
import { arrayify, BytesLike, DataOptions, hexConcat, hexDataLength, hexDataSlice, hexlify, hexZeroPad, isBytesLike, SignatureLike, splitSignature, stripZeros, } from "@ethersproject/bytes";
import {
    ecsign,
    hashPersonalMessage,
    publicToAddress,
    ToBufferInputTypes,

} from '@ethereumjs/util';
import { toBigIntBE, toBigIntLE, toBufferBE, toBufferLE } from 'bigint-buffer';
import { getAddress } from "@ethersproject/address";
import {
    bufferToBigInt,
    addHexPrefix,
    bufferToInt,
    ecrecover,
    // toBuffer,
    bigIntToBuffer,
    fromRpcSig,
    fromSigned,
    toUnsigned,
} from '@ethereumjs/util';

const sortDeepObjects = <T>(arr: T[]): T[] => sortDeepObjectArrays(arr);
function concatenateBuffers(buffers: any) {
    // Вычисляем общую длину нового буфера
    const totalLength = buffers.reduce((acc: any, buffer: any) => acc + buffer.length, 0);

    // Создаем новый буфер с общей длиной
    const concatenatedBuffer = new Uint8Array(totalLength);

    // Копируем содержимое каждого буфера в новый буфер
    let offset = 0;
    for (const buffer of buffers) {
        concatenatedBuffer.set(buffer, offset);
        offset += buffer.length;
    }

    return concatenatedBuffer;
}

// function bigIntToBuffer(num: any, width: number) {
//     const hex = num.toString(16);
//     return Buffer.from(hex.padStart(width * 2, '0').slice(0, width * 2), 'hex');
// }

// function bufferToBigInt(buffer: any, start = 0, end = buffer.length) {
//     let bufferAsHexString = buffer.toString("hex");
//     // console.log(bufferAsHexString)
//     return BigInt(`0x${bufferAsHexString}`);
// }

function hexToArrayBuffer(hexString: any) {
    // remove the leading 0x
    hexString = hexString.replace(/^0x/, '');

    // ensure even number of characters
    if (hexString.length % 2 != 0) {
        console.log('WARNING: expecting an even number of characters in the hexString');
    }

    // check for some non-hex characters
    var bad = hexString.match(/[G-Z\s]/i);
    if (bad) {
        console.log('WARNING: found non-hex characters', bad);
    }

    // split the string into pairs of octets
    var pairs = hexString.match(/[\dA-F]{2}/gi);

    // convert the octets to integers
    var integers = pairs.map(function(s: any) {
        return parseInt(s, 16);
    });

    var array = new Uint8Array(integers);
    console.log(array);

    return Buffer.from(array.buffer);
}

const convertStringToBytes32String = (str: string) => {
    if (str.length > 31) {
        const bytes32StringLength = 32 * 2 + 2; // 32 bytes (each byte uses 2 symbols) + 0x
        if (str.length === bytes32StringLength && str.startsWith("0x")) {
            return str;
        } else {
            //@ts-ignore
            return ethers.utils.id(str);
        }
    } else {
        // @ts-ignore
        return ethers.utils.formatBytes32String(str);
    }
}

const serializeToMessage = (pricePackage: any): any => {
    // console.log(pricePackage.prices[0].symbol)
    // console.log(convertStringToBytes32String(pricePackage.prices[0].symbol))
    const cleanPricesData = pricePackage.prices.map((p: any) => ({
        symbol: convertStringToBytes32String(p.symbol),
        value: Math.round(p.value * 10 ** 8),
    }));
    const sortedPrices = sortDeepObjects(cleanPricesData);

    const symbols: string[] = [];
    const values: string[] = [];
    sortedPrices.forEach((p: any) => {
        symbols.push(p.symbol);
        values.push(p.value);
    });
    return {
        symbols,
        values,
        timestamp: pricePackage.timestamp,
    };
}
const getLiteDataBytesString = (priceData: any): string => {
    let data = "";
    for (let i = 0; i < priceData.symbols.length; i++) {
        const symbol = priceData.symbols[i];
        // console.log(symbol)
        const value = priceData.values[i];
        // console.log(value)
        data += symbol.substr(2) + value.toString(16).padStart(64, "0");
    }
    data += Math.ceil(priceData.timestamp / 1000)
        .toString(16)
        .padStart(64, "0");
    return data;
}

const getLiteDataToSign = (priceData: any) => {
    const data = getLiteDataBytesString(priceData);
    return bufferToBigInt(keccak256(toBuffer("0x" + data)));
}
const getLiteDataToSign1 = (priceData: any) => {
    const data = getLiteDataBytesString(priceData);
    return toBuffer("0x" + data);
}

// const verifyLiteSignature = (signedPricePackage: any): boolean => {
//     const signer = recoverPersonalSignature({
//         data,
//         signature: signedPricePackage.liteSignature,
//     });
//
//     const signerAddressUC = signer.toUpperCase();
//     const expectedSignerAddress = signedPricePackage.signerAddress;
//     const expectedSignerAddressUC = expectedSignerAddress.toUpperCase();
//
//     return signerAddressUC === expectedSignerAddressUC;
// }

describe('Test', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Test');
    });

    let blockchain: Blockchain;
    let test: SandboxContract<Test>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        test = blockchain.openContract(Test.createFromConfig({}, code));

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await test.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: test.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        const res = await fetch("https://api.redstone.finance/prices?symbol=BTC&provider=redstone&limit=1")
        const data = await res.json()
        const price = data[0]
        const serializedPriceData = serializeToMessage(
            {
                prices: [
                    {
                        symbol: price.symbol,
                        value: price.value,
                    },
                ],
                timestamp: price.timestamp,
            }
        );
        console.log(price)
        const formatedData = getLiteDataToSign(serializedPriceData);
        const data_raw = getLiteDataBytesString(serializedPriceData);
        const { v, r, s } = fromRpcSig(price.liteEvmSignature)
        const rr = toBuffer(price.liteEvmSignature)
        // console.log(price.liteEvmSignature)
        // const v = bufferToBigInt(sigbuf.slice(0, 1));
        // const r = bufferToBigInt(sigbuf.slice(1, 33));
        // const c = bufferToBigInt(sigbuf.slice(33, 65));
        // console.log(sigbuf.slice(0, 1).length, sigbuf.slice(1, 33).length, sigbuf.slice(33, 65).length)
        // console.log(a, b, c, 'js')
        // console.log(data_raw.slice(0, 127).length)
        // console.log(data_raw.slice(127).length)
        // console.log(f)
        // console.log(data_raw)
        // console.log(bufferToBigInt(v))
        console.log(bufferToBigInt(r))
        console.log(bufferToBigInt(s))
        const bufffff = toBuffer('0x' + data_raw)
        console.log(formatedData, 'js signed')
        const counterBefore = await test.getCheck(
            beginCell().storeBuffer(bufffff.slice(0, 127)).endCell(),
            beginCell().storeBuffer(bufffff.slice(127)).endCell(),
            v, beginCell().storeBuffer(rr).endCell(), beginCell().storeBuffer(s).endCell());

        console.log(counterBefore.logs)
        // console.log((32390913822885769587718662201712307072991146127311459572739976111577303366912n, 256))
        const a = counterBefore.stack.pop() as any
        // // console.log(r.value, 'fc signed')
        // const s = counterBefore.stack.pop() as any
        // const e = counterBefore.stack.pop() as any
        // const bool = counterBefore.stack.pop() as any
        // console.log(bool.value === -1n)
        //
        const signerPK = extractPublicKey({
            data: formatedData,
            signature: price.liteEvmSignature,
        });
        const signer = recoverPersonalSignature({
            data: formatedData,
            signature: price.liteEvmSignature,
        });
        // console.log(toBufferLE(r.value, 1).length, toBufferLE(s.value, 32).length, toBufferLE(e.value, 32).length)
        console.log(signer)
        // console.log(hexToArrayBuffer(signerPK))
        // console.log(bufferToBigInt(signerPK.slice(0, 1)))
        // console.log(bufferToBigInt(signerPK.slice(1, 33)))
        console.log(signerPK.slice(33, 65).length)
        // console.log(bufferToBigInt(signerPK.slice(33, 65)))
        console.log((a.cell.bits.subbuffer(0, 520)).length)
        console.log((a.cell.bits.subbuffer(0, 520)).toString('hex'))
        // // console.log(hexToArrayBuffer(signer).slice(33))
        // // console.log(toBufferLE(s.value, 32))
        // console.log(Buffer.concat([toBufferBE(r.value, 1), toBufferBE(s.value, 32), toBufferBE(e.value, 32)]))
        // // console.log(bufferToHex(Buffer.concat([toBufferLE(r.value, 1), toBufferLE(s.value, 32), toBufferLE(e.value, 32)])))
        // // console.log((Buffer.from(concatenateBuffers([bigIntToBuffer(r.value, 1), bigIntToBuffer(s.value, 32), bigIntToBuffer(e.value, 32)]))))
        // console.log(getAddress(hexDataSlice(keccak256(r.cell.bits.subbuffer(0, 520)), 12)))
    });
});
