/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Market Exchanges
 **/

// Load required modules
let apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet);

// Initialize log system
let logSystem = 'market';
require('./exceptionWriter.js')(logSystem);

/**
 * Get market prices
 **/
exports.get = function(exchange, tickers, callback) {
    if (!exchange) {
        callback('No exchange specified', null);
    }
    exchange = exchange.toLowerCase();

    if (!tickers || tickers.length === 0) {
        callback('No tickers specified', null);
    }

    let marketPrices = [];
    let numTickers = tickers.length;
    let completedFetches = 0;

    getExchangeMarkets(exchange, function(error, marketData) {
        if (!marketData || marketData.length === 0) {
            callback({});
            return ;
        }

        for (let i in tickers) {
            (function(i){
                let pairName = tickers[i];
                let pairParts = pairName.split('-');
                let base = pairParts[0] || null;
                let target = pairParts[1] || null;

                if (!marketData[base]) {
                    completedFetches++;
                    if (completedFetches === numTickers) callback(marketPrices);
                } else {
                    let price = marketData[base][target] || null;
                    if (!price || price === 0) {
                        let cryptonatorBase;
                        if (marketData[base]['BTC']) cryptonatorBase = 'BTC';
                        else if (marketData[base]['ETH']) cryptonatorBase = 'ETH';
                        else if (marketData[base]['LTC']) cryptonatorBase = 'LTC';

                        if (!cryptonatorBase) {
                            completedFetches++;
                            if (completedFetches === numTickers) callback(marketPrices);
                        } else {
                            getExchangePrice("cryptonator", cryptonatorBase, target, function(error, tickerData) {
                                completedFetches++;
                                if (tickerData && tickerData.price) {
                                    marketPrices[i] = {
                                        ticker: pairName,
                                        price: tickerData.price * marketData[base][cryptonatorBase],
                                        source: tickerData.source
                                    };
                                }
                                if (completedFetches === numTickers) callback(marketPrices);
                            });
                        }
                    } else {
                        completedFetches++;
                        marketPrices[i] = { ticker: pairName, price: price, source: exchange };
                        if (completedFetches === numTickers) callback(marketPrices);
                    }
                }
            })(i);
        }
    });
}

/**
 * Get Exchange Market Prices
 **/

let marketRequestsCache = {};

function getExchangeMarkets(exchange, callback) {
    callback = callback || function(){};
    if (!exchange) {
        callback('No exchange specified', null);
    }
    exchange = exchange.toLowerCase();

    // Return cache if available
    let cacheKey = exchange;
    let currentTimestamp = Date.now() / 1000;

    if (marketRequestsCache[cacheKey] && marketRequestsCache[cacheKey].ts > (currentTimestamp - 60)) {
        callback(null, marketRequestsCache[cacheKey].data);
        return ;
    }

    let target = null;
    let symbol = null;
    let price = 0.0;
    let data = {};

    // Altex
    if (exchange == "altex") {
        apiInterfaces.jsonHttpRequest('api.altex.exchange', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            if (error) callback(error, {});
            if (!response || !response.success) callback('No market informations', {});
            let ticker = null;
            for (ticker in response.data) {
                tickerParts = ticker.split('_');
                target = tickerParts[0];
                symbol = tickerParts[1];

                price = +parseFloat(response.data[ticker].last);
                if (price === 0) continue;

                if (!data[symbol]) data[symbol] = {};
                data[symbol][target] = price;
            }
            if (!error) marketRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(null, data);
        }, '/v1/ticker');
    }

    // Crex24
    else if (exchange == "crex24") {
        apiInterfaces.jsonHttpRequest('api.crex24.com', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            if (error) callback(error, {});
            if (!response || !response.Tickers) callback('No market informations', {});

            let ticker = null;
            let pairName = null;
            let pairParts = null;
            for (let i in response.Tickers) {
                ticker = response.Tickers[i];

                pairName = ticker.PairName;
                pairParts = pairName.split('_');
                target = pairParts[0];
                symbol = pairParts[1];

                price = +ticker.Last;
                if (!price || price === 0) continue;

                if (!data[symbol]) data[symbol] = {};
                data[symbol][target] = price;
            }
            if (!error) marketRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(null, data);
        }, '/CryptoExchangeService/BotPublic/ReturnTicker');
    }

    // Cryptopia
    else if (exchange == "cryptopia") {
        apiInterfaces.jsonHttpRequest('www.cryptopia.co.nz', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            if (error) callback(error, {});
            if (!response || !response.Success) callback('No market informations', {});

            let ticker = null;
            let pairName = null;
            let pairParts = null;
            for (let i in response.Data) {
                ticker = response.Data[i];

                pairName = ticker.Label;
                pairParts = pairName.split('/');
                target = pairParts[1];
                symbol = pairParts[0];

                price = +ticker.LastPrice;
                if (!price || price === 0) continue;

                if (!data[symbol]) data[symbol] = {};
                data[symbol][target] = price;
            }
            if (!error) marketRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(null, data);
        }, '/api/GetMarkets');
    }

    // Stocks.Exchange
    else if (exchange == "stocks.exchange") {
        apiInterfaces.jsonHttpRequest('stocks.exchange', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            if (error) callback(error, {});
            if (!response) callback('No market informations', {});

            let ticker = null;
            let pairName = null;
            let pairParts = null;
            for (let i in response) {
                ticker = response[i];

                pairName = ticker.market_name;
                pairParts = pairName.split('_');
                target = pairParts[1];
                symbol = pairParts[0];

                price = +ticker.last;
                if (!price || price === 0) continue;

                if (!data[symbol]) data[symbol] = {};
                data[symbol][target] = price;
            }
            if (!error) marketRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(null, data);
        }, '/api2/ticker');
    }

    // TradeOgre
    else if (exchange == "tradeogre") {
        apiInterfaces.jsonHttpRequest('tradeogre.com', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            let pairParts = null;
            if (!error && response) {
                for (let i in response) {
                    for (let pairName in response[i]) {
                        pairParts = pairName.split('-');
                        target = pairParts[0];
                        symbol = pairParts[1];

                        price = +response[i][pairName].price;
                        if (price === 0) continue;

                        if (!data[symbol]) data[symbol] = {};
                        data[symbol][target] = price;
                    }
                }
            }
            if (!error) marketRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(null, data);
        }, '/api/v1/markets');
    }

    // Unknown
    else {
        callback('Exchange not supported: ' + exchange);
    }
}
exports.getExchangeMarkets = getExchangeMarkets;

/**
 * Get Exchange Market Price
 **/

let priceRequestsCache = {};

function getExchangePrice(exchange, base, target, callback) {
    callback = callback || function(){};

    if (!exchange) {
        callback('No exchange specified');
    }
    else if (!base) {
        callback('No base specified');
    }
    else if (!target) {
        callback('No target specified');
    }

    exchange = exchange.toLowerCase();
    base = base.toUpperCase();
    target = target.toUpperCase();

    // Return cache if available
    let cacheKey = exchange + '-' + base + '-' + target;
    let currentTimestamp = Date.now() / 1000;

    if (priceRequestsCache[cacheKey] && priceRequestsCache[cacheKey].ts > (currentTimestamp - 60)) {
        callback(null, priceRequestsCache[cacheKey].data);
        return ;
    }

    // Cryptonator
    if (exchange == "cryptonator") {
        ticker = base + '-' + target;
        apiInterfaces.jsonHttpRequest('api.cryptonator.com', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);
            if (response.error) log('warn', logSystem, 'Cryptonator API error: %s', [response.error]);

            error = response.error ? response.error : error;
            price = response.success ? +response.ticker.price : null;
            if (!price) log('warn', logSystem, 'No exchange data for %s using %s', [ticker, exchange]);

            data = { ticker: ticker, price: price, source: exchange };
            if (!error) priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(error, data);
        }, '/api/ticker/' + ticker);
    }

    // Altex
    else if (exchange == "altex") {
        getExchangeMarkets(exchange, function(error, data) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            price = null;
            if (!error && data[base] && data[base][target]) {
                price = data[base][target];
            }
            if (!price) log('warn', logSystem, 'No exchange data for %s using %s', [ticker, exchange]);

            data = { ticker: ticker, price: price, source: exchange };
            if (!error) priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(error, data);
        });
    }

    // Crex24
    else if (exchange == "crex24") {
        ticker = base + '_' + target;
        apiInterfaces.jsonHttpRequest('api.crex24.com', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);
            if (response.Error) log('warn', logSystem, 'Crex24 API error: %s', [response.Error]);

            error = response.Error ? response.Error : error;
            price = (response.Tickers && response.Tickers[0]) ? +response.Tickers[0].Last : null;
            if (!price) log('warn', logSystem, 'No exchange data for %s using %s', [ticker, exchange]);

            data = { ticker: ticker, price: price, source: exchange };
            if (!error) priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(error, data);
        }, '/CryptoExchangeService/BotPublic/ReturnTicker?request=[NamePairs=' + ticker + ']');
    }

    // Cryptopia
    else if (exchange == "cryptopia") {
        ticker = base + '_' + target;
        apiInterfaces.jsonHttpRequest('www.cryptopia.co.nz', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);
            if (response.Error) log('warn', logSystem, 'Cryptopia API error: %s', [response.Error]);

            error = response.Error ? response.Error : error;
            price = (response.Data && response.Data.LastPrice) ? +response.Data.LastPrice : null;

            data = { ticker: ticker, price: price, source: exchange };
            if (!error) priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(error, data);
        }, '/api/GetMarket/' + ticker);
    }

    // Stocks.Exchange
    else if (exchange == "stocks.exchange") {
        getExchangeMarkets(exchange, function(error, data) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            if (!error && data[base] && data[base][target]) {
                price = data[base][target];
            }
            if (!price) log('warn', logSystem, 'No exchange data for %s using %s', [ticker, exchange]);

            data = { ticker: ticker, price: price, source: exchange };
            if (!error) priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(error, data);
        });
    }

    // TradeOgre
    else if (exchange == "tradeogre") {
        ticker = target + '-' + base;
        apiInterfaces.jsonHttpRequest('tradeogre.com', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);
            if (response.message) log('warn', logSystem, 'TradeOgre API error: %s', [response.message]);

            error = response.message ? response.message : error;
            price = +response.price || null;
            if (!price) log('warn', logSystem, 'No exchange data for %s using %s', [ticker, exchange]);

            data = { ticker: ticker, price: price, source: exchange };
            if (!error) priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(error, data);
        }, '/api/v2/ticker/' + ticker);
    }

    // Unknown
    else {
        callback('Exchange not supported: ' + exchange);
    }
}
exports.getExchangePrice = getExchangePrice;