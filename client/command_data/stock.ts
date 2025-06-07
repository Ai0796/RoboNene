// client/command_data/stock.ts
/**
 * @fileoverview /stock
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'stock',
    'utilization': '/stock',
    'description': 'returns the current stock price of the given company ticker',
    'ephemeral': false,
    'subcommands': [
        {
            'name': 'get',
            'description': 'Get current stock/crypto price',
            'params': [
                {
                    'type': 'string',
                    'name': 'symbol',
                    'required': true,
                    'description': 'stock symbol to get price of'
                }
            ]
        },
        {
            'name': 'buy',
            'description': 'Get current stock/crypto price',
            'params': [
                {
                    'type': 'string',
                    'name': 'symbol',
                    'required': true,
                    'description': 'stock symbol to buy'
                },
                {
                    'type': 'integer',
                    'name': 'amount',
                    'required': true,
                    'description': 'amount of the stock to buy'
                }
            ]
        },
        {
            'name': 'sell',
            'description': 'Get current stock/crypto price',
            'params': [
                {
                    'type': 'string',
                    'name': 'symbol',
                    'required': true,
                    'description': 'stock symbol to sell'
                },
                {
                    'type': 'integer',
                    'name': 'amount',
                    'required': true,
                    'description': 'amount of the stock to sell'
                }
            ]
        },
        {
            'name': 'list',
            'description': 'List all available stock/crypto symbols',
        },
        {
            'name': 'portfolio',
            'params': [
                {
                    'type': 'user',
                    'name': 'user',
                    'required': false,
                    'description': 'the user to get the portfolio of, defaults to the user who ran the command'
                }
            ],
            'description': 'List your current stock portfolio',
        }
    ]

};

export const CONSTANTS = {}; // No constants in originals