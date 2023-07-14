import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { beginCell, Cell, toNano } from 'ton-core';
import { Test } from '../wrappers/Test';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { ethers } from "ethers";
import { toBuffer, keccak256 } from "ethereumjs-util";
import { extractPublicKey, recoverPersonalSignature } from "@metamask/eth-sig-util";
import { bufferToBigInt, fromRpcSig } from '@ethereumjs/util';
//@ts-ignore
import sortDeepObjectArrays from "sort-deep-object-arrays";

const sortDeepObjects = <T>(arr: T[]): T[] => sortDeepObjectArrays(arr);

function hexToArrayBuffer(input: any) {
    if (typeof input !== 'string') {
        throw new TypeError('Expected input to be a string')
    }
    if ((input.length % 2) !== 0) {
        throw new RangeError('Expected string to be an even number of characters')
    }
    const view = new Uint8Array(input.length / 2)
    for (let i = 0; i < input.length; i += 2) {
        view[i / 2] = parseInt(input.substring(i, i + 2), 16)
    }
    return Buffer.from(view.buffer)
}

const convertStringToBytes32String = (str: string) => {
    if (str.length > 31) {
        const bytes32StringLength = 32 * 2 + 2; // 32 bytes (each byte uses 2 symbols) + 0x
        if (str.length === bytes32StringLength && str.startsWith("0x")) {
            return str;
        } else {
            return ethers.utils.id(str);
        }
    } else {
        return ethers.utils.formatBytes32String(str);
    }
}

const serializeToMessage = (pricePackage: any): any => {
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
        const value = priceData.values[i];
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
        console.log('-- raw data')
        console.log(price)
        console.log('-- raw data')
        const formatedRawData = getLiteDataToSign(serializedPriceData);
        const dataDaw = getLiteDataBytesString(serializedPriceData);
        const { v, r, s } = fromRpcSig(price.liteEvmSignature)
        const signature = hexToArrayBuffer(price.liteEvmSignature)
        const rawDataBuffer = toBuffer('0x' + dataDaw)
        console.log('-- signature by parts')
        console.log(v)
        console.log(bufferToBigInt(r))
        console.log(bufferToBigInt(s))
        console.log('-- signature by parts')
        console.log(formatedRawData, 'js keccak hashed data')
        const scresult = await test.getCheck(
            beginCell().storeBuffer(rawDataBuffer.slice(0, 127)).endCell(),
            beginCell().storeBuffer(rawDataBuffer.slice(127)).endCell(),
            beginCell().storeBuffer(signature).endCell());
        console.log(scresult.logs)
        const signerPkFromSC = scresult.stack.pop() as any
        const signerPKJs = extractPublicKey({
            data: formatedRawData,
            signature: price.liteEvmSignature,
        });
        const signerAddressJs = recoverPersonalSignature({
            data: formatedRawData,
            signature: price.liteEvmSignature,
        });
        console.log('js signer address: ', signerAddressJs)
        console.log('js signer pk: ', signerPKJs)
        console.log('func signer pk: ', (signerPkFromSC.cell.bits.subbuffer(0, 520)).toString('hex'))
    });
});
