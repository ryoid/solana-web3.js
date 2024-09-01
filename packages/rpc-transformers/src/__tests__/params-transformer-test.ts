import type { RpcRequestTransformer } from '@solana/rpc-spec';
import type { Commitment } from '@solana/rpc-types';

import { getDefaultRequestTransformerForSolanaRpc } from '../params-transformer';
import { OPTIONS_OBJECT_POSITION_BY_METHOD } from '../request-transformer-options-object-position-config';

describe('getDefaultRequestTransformerForSolanaRpc', () => {
    describe('given no config', () => {
        let paramsTransformer: (params: unknown) => unknown;
        beforeEach(() => {
            const requestTransformer = getDefaultRequestTransformerForSolanaRpc();
            paramsTransformer = params => requestTransformer({ methodName: 'getFoo', params }).params;
        });
        describe('given an array as input', () => {
            const input = [10n, 10, '10', ['10', [10, 10n], 10n]] as const;
            it('casts the bigints in the array to a `number`, recursively', () => {
                expect(paramsTransformer(input)).toStrictEqual([
                    Number(input[0]),
                    input[1],
                    input[2],
                    [input[3][0], [input[3][1][0], Number(input[3][1][0])], Number(input[3][2])],
                ]);
            });
        });
        describe('given an object as input', () => {
            const input = { a: 10n, b: 10, c: { c1: '10', c2: 10n } } as const;
            it('casts the bigints in the array to a `number`, recursively', () => {
                expect(paramsTransformer(input)).toStrictEqual({
                    a: Number(input.a),
                    b: input.b,
                    c: { c1: input.c.c1, c2: Number(input.c.c2) },
                });
            });
        });
    });
    describe('with respect to the default commitment', () => {
        const METHODS_SUBJECT_TO_COMMITMENT_DEFAULTING = [
            'accountNotifications',
            'blockNotifications',
            'getAccountInfo',
            'getBalance',
            'getBlock',
            'getBlockHeight',
            'getBlockProduction',
            'getBlocks',
            'getBlocksWithLimit',
            'getConfirmedBlock',
            'getConfirmedBlocks',
            'getConfirmedBlocksWithLimit',
            'getConfirmedSignaturesForAddress2',
            'getConfirmedTransaction',
            'getEpochInfo',
            'getFeeCalculatorForBlockhash',
            'getFeeForMessage',
            'getFees',
            'getInflationGovernor',
            'getInflationReward',
            'getLargestAccounts',
            'getLatestBlockhash',
            'getLeaderSchedule',
            'getMinimumBalanceForRentExemption',
            'getMultipleAccounts',
            'getProgramAccounts',
            'getRecentBlockhash',
            'getSignaturesForAddress',
            'getSlot',
            'getSlotLeader',
            'getStakeActivation',
            'getStakeMinimumDelegation',
            'getSupply',
            'getTokenAccountBalance',
            'getTokenAccountsByDelegate',
            'getTokenAccountsByOwner',
            'getTokenLargestAccounts',
            'getTokenSupply',
            'getTransaction',
            'getTransactionCount',
            'getVoteAccounts',
            'isBlockhashValid',
            'logsNotifications',
            'programNotifications',
            'requestAirdrop',
            'signatureNotifications',
            'simulateTransaction',
        ];
        describe.each(['processed', 'confirmed'] as Commitment[])(
            'with the default commitment set to `%s`',
            defaultCommitment => {
                let requestTransformer: RpcRequestTransformer;
                beforeEach(() => {
                    requestTransformer = getDefaultRequestTransformerForSolanaRpc({ defaultCommitment });
                });
                it.each(METHODS_SUBJECT_TO_COMMITMENT_DEFAULTING)(
                    'adds a default commitment on calls for `%s`',
                    methodName => {
                        expect(requestTransformer({ methodName, params: [] }).params).toContainEqual({
                            commitment: defaultCommitment,
                        });
                    },
                );
                it('adds a default preflight commitment on calls to `sendTransaction`', () => {
                    expect(requestTransformer({ methodName: 'sendTransaction', params: [] }).params).toContainEqual({
                        preflightCommitment: defaultCommitment,
                    });
                });
            },
        );
        describe('with the default commitment set to `finalized`', () => {
            let requestTransformer: RpcRequestTransformer;
            beforeEach(() => {
                requestTransformer = getDefaultRequestTransformerForSolanaRpc({ defaultCommitment: 'finalized' });
            });
            it.each(METHODS_SUBJECT_TO_COMMITMENT_DEFAULTING)('adds no commitment on calls for `%s`', methodName => {
                expect(requestTransformer({ methodName, params: [] }).params).not.toContainEqual(
                    expect.objectContaining({ commitment: expect.anything() }),
                );
            });
            it('adds no preflight commitment on calls to `sendTransaction`', () => {
                expect(requestTransformer({ methodName: 'sendTransaction', params: [] }).params).not.toContainEqual(
                    expect.objectContaining({ preflightCommitment: expect.anything() }),
                );
            });
        });
        describe('with no default commitment set', () => {
            let requestTransformer: RpcRequestTransformer;
            beforeEach(() => {
                requestTransformer = getDefaultRequestTransformerForSolanaRpc();
            });
            it.each(METHODS_SUBJECT_TO_COMMITMENT_DEFAULTING)('sets no commitment on calls to `%s`', methodName => {
                expect(requestTransformer({ methodName, params: [] }).params).not.toContainEqual(
                    expect.objectContaining({ commitment: expect.anything() }),
                );
            });
            it('adds no preflight commitment on calls to `sendTransaction`', () => {
                expect(requestTransformer({ methodName: 'sendTransaction', params: [] }).params).not.toContainEqual(
                    expect.objectContaining({ preflightCommitment: expect.anything() }),
                );
            });
        });
        describe.each(['finalized', undefined])(
            'when the params already specify a commitment of `%s`',
            existingCommitment => {
                describe.each(METHODS_SUBJECT_TO_COMMITMENT_DEFAULTING)('on calls to `%s`', methodName => {
                    const optionsObjectPosition = OPTIONS_OBJECT_POSITION_BY_METHOD[methodName]!;
                    it('removes the commitment property on calls to `%s` when there are other properties in the config object', () => {
                        expect.assertions(1);
                        const params = [
                            ...new Array(optionsObjectPosition),
                            { commitment: existingCommitment, other: 'property' },
                        ];
                        const requestTransformer = getDefaultRequestTransformerForSolanaRpc();
                        expect(requestTransformer({ methodName, params }).params).toStrictEqual([
                            ...new Array(optionsObjectPosition).map(() => expect.anything()),
                            { other: 'property' },
                        ]);
                    });
                    it('deletes the commitment on calls to `%s` when there are no other properties left and the config object is not the last param', () => {
                        expect.assertions(1);
                        const params = [
                            ...new Array(optionsObjectPosition),
                            { commitment: existingCommitment },
                            'someParam',
                        ];
                        const requestTransformer = getDefaultRequestTransformerForSolanaRpc();
                        expect(requestTransformer({ methodName, params }).params).toStrictEqual([
                            ...new Array(optionsObjectPosition).map(() => expect.anything()),
                            undefined,
                            'someParam',
                        ]);
                    });
                    it('truncates the params on calls to `%s` when there are no other properties left and the config object is the last param', () => {
                        expect.assertions(1);
                        const params = [...new Array(optionsObjectPosition), { commitment: existingCommitment }];
                        const requestTransformer = getDefaultRequestTransformerForSolanaRpc();
                        expect(requestTransformer({ methodName, params }).params).toStrictEqual([
                            ...new Array(optionsObjectPosition).map(() => expect.anything()),
                        ]);
                    });
                });
                it('removes the preflight commitment property on calls to `%s` when there are other properties in the config object', () => {
                    expect.assertions(1);
                    const optionsObjectPosition = OPTIONS_OBJECT_POSITION_BY_METHOD['sendTransaction']!;
                    const params = [
                        ...new Array(optionsObjectPosition),
                        { other: 'property', preflightCommitment: existingCommitment },
                    ];
                    const requestTransformer = getDefaultRequestTransformerForSolanaRpc();
                    expect(requestTransformer({ methodName: 'sendTransaction', params }).params).toStrictEqual([
                        ...new Array(optionsObjectPosition).map(() => expect.anything()),
                        { other: 'property' },
                    ]);
                });
                it('deletes the preflight commitment on calls to `%s` when there are no other properties left and the config object is not the last param', () => {
                    expect.assertions(1);
                    const optionsObjectPosition = OPTIONS_OBJECT_POSITION_BY_METHOD['sendTransaction']!;
                    const params = [
                        ...new Array(optionsObjectPosition),
                        { preflightCommitment: existingCommitment },
                        'someParam',
                    ];
                    const requestTransformer = getDefaultRequestTransformerForSolanaRpc();
                    expect(requestTransformer({ methodName: 'sendTransaction', params }).params).toStrictEqual([
                        ...new Array(optionsObjectPosition).map(() => expect.anything()),
                        undefined,
                        'someParam',
                    ]);
                });
                it('truncates the params on calls to `%s` when there are no other properties left and the config object is the last param', () => {
                    expect.assertions(1);
                    const optionsObjectPosition = OPTIONS_OBJECT_POSITION_BY_METHOD['sendTransaction']!;
                    const params = [...new Array(optionsObjectPosition), { preflightCommitment: existingCommitment }];
                    const requestTransformer = getDefaultRequestTransformerForSolanaRpc();
                    expect(requestTransformer({ methodName: 'sendTransaction', params }).params).toStrictEqual([
                        ...new Array(optionsObjectPosition).map(() => expect.anything()),
                    ]);
                });
            },
        );
    });
    // FIXME Remove when https://github.com/anza-xyz/agave/pull/483 is deployed.
    it.each([undefined, 'processed', 'confirmed', 'finalized'])(
        'sets the `preflightCommitment` to `processed` when `skipPreflight` is `true` and `preflightCommitment` is `%s` on calls to `sendTransaction`',
        explicitPreflightCommitment => {
            const requestTransformer = getDefaultRequestTransformerForSolanaRpc();
            expect(
                requestTransformer({
                    methodName: 'sendTransaction',
                    params: [
                        null,
                        {
                            // eslint-disable-next-line jest/no-conditional-in-test
                            ...(explicitPreflightCommitment
                                ? { preflightCommitment: explicitPreflightCommitment }
                                : null),
                            skipPreflight: true,
                        },
                    ],
                }).params,
            ).toContainEqual(expect.objectContaining({ preflightCommitment: 'processed' }));
        },
    );
    describe('given an integer overflow handler', () => {
        let onIntegerOverflow: jest.Mock;
        let paramsTransformer: (value: unknown) => unknown;
        beforeEach(() => {
            onIntegerOverflow = jest.fn();
            const requestTransformer = getDefaultRequestTransformerForSolanaRpc({ onIntegerOverflow });
            paramsTransformer = params => requestTransformer({ methodName: 'getFoo', params }).params;
        });
        Object.entries({
            'value above `Number.MAX_SAFE_INTEGER`': BigInt(Number.MAX_SAFE_INTEGER) + 1n,
            'value below `Number.MAX_SAFE_INTEGER`': -BigInt(Number.MAX_SAFE_INTEGER) - 1n,
        }).forEach(([description, value]) => {
            it('calls `onIntegerOverflow` when passed a value ' + description, () => {
                paramsTransformer(value);
                expect(onIntegerOverflow).toHaveBeenCalledWith(
                    'getFoo',
                    [], // Equivalent to `params`
                    value,
                );
            });
            it('calls `onIntegerOverflow` when passed a nested array having a value ' + description, () => {
                paramsTransformer([1, 2, [3, value]]);
                expect(onIntegerOverflow).toHaveBeenCalledWith(
                    'getFoo',
                    [2, 1], // Equivalent to `params[2][1]`.
                    value,
                );
            });
            it('calls `onIntegerOverflow` when passed a nested object having a value ' + description, () => {
                paramsTransformer({ a: 1, b: { b1: 2, b2: value } });
                expect(onIntegerOverflow).toHaveBeenCalledWith(
                    'getFoo',
                    ['b', 'b2'], // Equivalent to `params.b.b2`.
                    value,
                );
            });
            it('does not call `onIntegerOverflow` when passed `Number.MAX_SAFE_INTEGER`', () => {
                paramsTransformer(BigInt(Number.MAX_SAFE_INTEGER));
                expect(onIntegerOverflow).not.toHaveBeenCalled();
            });
        });
    });
});
