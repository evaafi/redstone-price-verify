import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Cell, toNano } from 'ton-core';
import { Test } from '../wrappers/Test';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { ethers } from "ethers";
//@ts-ignore
import sortDeepObjectArrays from "sort-deep-object-arrays";
//@ts-ignore
import { toBuffer, bufferToHex, keccak256 } from "ethereumjs-util";
import { personalSign, recoverPersonalSignature } from "@metamask/eth-sig-util";

const sortDeepObjects = <T>(arr: T[]): T[] => sortDeepObjectArrays(arr);

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

const getLiteDataToSign = (priceData: any): string => {
    const data = getLiteDataBytesString(priceData);
    return bufferToHex(keccak256(toBuffer("0x" + data)));
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

        const formatedData = getLiteDataToSign(serializedPriceData);
        const signer = recoverPersonalSignature({
            data: formatedData,
            signature: price.liteEvmSignature,
        });
        console.log(price)
        console.log(formatedData)
        // console.log(ethers.utils.computeAddress(price.providerPublicKey))
        console.log(signer)
    });
});
