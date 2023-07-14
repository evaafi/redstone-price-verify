import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type TestConfig = {};

export function testConfigToCell(config: TestConfig): Cell {
    return beginCell().endCell();
}

export class Test implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) { }

    static createFromAddress(address: Address) {
        return new Test(address);
    }

    static createFromConfig(config: TestConfig, code: Cell, workchain = 0) {
        const data = testConfigToCell(config);
        const init = { code, data };
        return new Test(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getCheck(provider: ContractProvider, data: any, data_pt2: any, sig: any) {
        const result = await provider.get('check', [
            { type: 'slice', cell: data },
            { type: 'slice', cell: data_pt2 },
            { type: 'slice', cell: sig },
        ]);
        return result;

    }
}
