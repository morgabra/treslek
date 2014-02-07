var request = require('request');
var sprintf = require('sprintf').sprintf;
var async = require('async');
var _ = require('underscore');

/**
 * https://en.bitcoin.it/wiki/Original_Bitcoin_client/API_Calls_list
 */
var DogeClient = function (conf) {
    this.conf = conf;
};

DogeClient.prototype.send = function (command, params, callback) {

    if (!_.isArray(params)) {
        params = [];
    }

    var options = {},
        body = {},
        headers = {},
        responseBody;

    body = {
        id: (new Date()).getTime().toString(),
        method: command,
        params: params
    };

    options = {
        url: this.conf.url,
        body: JSON.stringify(body),
        method: 'POST',
        auth: {
            user: this.conf.rpcuser,
            pass: this.conf.rpcpassword,
            sendImmediately: true
        }
    };

    console.log('dogetip: request - ', JSON.stringify(options));

    request(options, function(error, response, body) {

        if (error) {
            console.log('dogetip: request error - ', error);
            return callback(error);
        }

        if (response.statusCode !== 200) {
            console.log(body);
            return callback('dogetip: unexpected status code - ', response.statusCode);
        }

        try {

            body = JSON.parse(body);

            if (body.error) {
                console.log('dogetip: rpc error - ', body.error);
                return callback(respnseBody.error);
            } else {
                console.log('dogetip: rpc response - ', body);
                return callback(null, body.result);
            }
        } catch(exception) {
            console.log('dogetip: rpc response parse error - ', exception);
            return callback(exception);
        }
    });

};


/** Fetch a dogecoin address by name, create one if it doesn't exist */
DogeClient.prototype.getaddress = function (name, callback) {
    this.send('getaccountaddress', [name], callback);
};

/** Get a dogecoin address balance by name */
DogeClient.prototype.getbalance = function (name, callback) {
    this.send('getbalance', [name], callback);
};

/** Send doge to an address */
DogeClient.prototype.sendfrom = function (account, address, amount, callback) {
    this.send('sendfrom', [account, address, amount], callback);
};

/** Move doge between accounts in the wallet */
DogeClient.prototype.move = function (from, to, amount, callback) {
    this.send('move', [from, to, amount], callback);
};

/** Get dogecoind info */
DogeClient.prototype.getinfo = function (callback) {
    this.send('getinfo', [], callback);
};

DogeClient.prototype.listaccounts = function(callback) {
    this.send('listaccounts', [], callback);
};

var DogeTip = function () {
    this.commands = ['dt'];
    this.usage = {
        dt: 'ex : !dt [tip <nick> <amt>] [sendto <address> <amd>] [address] [balance]'
    };
};

DogeTip.prototype.dt = function (bot, to, from, msg, callback) {

    var command, args;

    /** Split tokens and strip any whitespace */
    args = msg.split(" ");
    args = _.reject(args, function (val) { return (val === ""); });
    command = args[0];
    args.shift();

    switch (command) {
        case 'address':
            this.getaddress(bot, to, from, args);
            break;
        case 'balance':
            this.getbalance(bot, to, from, args);
            break;
        case 'tip':
            this.tip(bot, to, from, args);
            break;
        case 'sendto':
            this.sendto(bot, to, from, args);
            break;
        case 'move':
            this.move(bot, to, from, args);
            break;
        case 'ledger':
            this.ledger(bot, to, from, args);
            break;
        default:
            args.unshift(command);
            this.tip(bot, to, from, args);
            break;
//            bot.say(to, from + ': Very confuse with ' + command + '?');

    }

    callback();
};

/** Check and see if a given nick is in a given channel.
  * Callback will fire with a boolean.
  */
DogeTip.prototype._inChannel = function(bot, nick, channel, callback) {
    bot.whois(nick, function (result) {

        if (!_.has(result, 'channels')) {
            return callback(null, false);
        }

        /** We have to strip the operator sign from the channel list */
        found = _.find(result.channels, function (c) {
            if (c.charAt(0) === '@') {
                c = c.substring(1);
            }
            return c === channel;
        });

        if (!_.isUndefined(found)) {
            return callback(null, true);
        } else {
            return callback(null, false);
        }
    });
};

/** Check and see if a given nick is an admin. */
DogeTip.prototype._isAdmin = function(bot, nick) {
    return _.contains(bot.pluginsConf['dogetip']['admins'], nick);
};

/** Validate DOGE amount */
DogeTip.prototype._isValidAmount = function(amt) {
    if (!_.isFinite(amt) || _.isNaN(amt) || amt <= 0.0) {
        return false;
    }
    return true;
};


/** Look up the tip wallet address for a nick */
DogeTip.prototype.getaddress = function(bot, to, from, args) {

    var dogeClient = new DogeClient(bot.pluginsConf['dogetip']);
    var nick;

    if (this._isAdmin(bot, from)) {
        nick = args.shift();
        if (_.isUndefined(nick)) {
            nick = from;
        }
    } else {
        nick = from;
    }

    dogeClient.getaddress(nick, function (err, result) {
        if (err) {
            console.log(err);
            bot.say(to, from + ": Error fetching address.");
        } else {
            bot.say(to, from + ": " + result);
        }
    });
};

/** Look up the tip wallet balance for a nick */
DogeTip.prototype.getbalance = function(bot, to, from, args) {

    var dogeClient = new DogeClient(bot.pluginsConf['dogetip']);
    var nick;

    if (this._isAdmin(bot, from)) {
        nick = args.shift();
        if (_.isUndefined(nick)) {
            nick = from;
        }
    } else {
        nick = from;
    }

    dogeClient.getbalance(nick, function (err, result) {
        if (err) {
            bot.say(to, from + ": Error fetching balance.");
        } else {
            bot.say(to, from + ": Đ" + result);
        }
    });

};

/** Look up all user accounts */
DogeTip.prototype.ledger = function(bot, to, from, args) {

    var dogeClient = new DogeClient(bot.pluginsConf['dogetip']);

    if (this._isAdmin(bot, from))
    {
        dogeClient.listaccounts(function(err, result) {

            if (err) {
                bot.say(to, from + ": Such fuck.");
            } else {
                msgOut = "Balances: ";
                _.each(result, function (value, key) {
                    if (key !== '') {
                        msgOut += key + ":Đ" + value + " ";
                    }
                });
                bot.say(to, msgOut);
            }
        });
    }
};

/** Tip a nick */
DogeTip.prototype.tip = function(bot, to, from, args) {

    var dogeClient = new DogeClient(bot.pluginsConf['dogetip']);

    var tipTo, tipAmt;
    tipTo = args[0];
    tipAmt = parseFloat(args[1]);

    if (!this._isValidAmount(tipAmt)) {
        bot.say(to, from + ': Very confuse with tip ' + tipAmt + '?');
        return;
    }

    this._inChannel(bot, tipTo, to, function (err, inChannel) {
        if (!inChannel) {
            bot.say(to, from + ': ' + tipTo + ' must be in the channel');
        } else {
            async.parallel([
                   function(callback){ dogeClient.getaddress(from, callback); },
                   function(callback){ dogeClient.getbalance(from, callback); },
                   function(callback){ dogeClient.getaddress(tipTo, callback); }
               ], function (err, results) {
                   if (err) {
                       console.log(err);
                       bot.say(to, sprintf('%s: Error fetching addresses.', from));
                   } else {
                       if (results[1] - tipAmt < 0.0) {
                           bot.say(to, sprintf('%s: Insufficient funds', from));
                           return;
                       }

                       dogeClient.move(from, tipTo, tipAmt, function (err, result) {
                           if (err) {
                               bot.say(to, sprintf('%s: Error tipping doge', from));
                           } else {
                               bot.say(to, sprintf('%s: Tipped Đ%s to %s', from, tipAmt, tipTo));
                           }
                       });
                   }
            });
        }
    });
};

/** Admin only - move doge between accounts */
DogeTip.prototype.move = function(bot, to, from, args) {

    var dogeClient = new DogeClient(bot.pluginsConf['dogetip']);

    if (!this._isAdmin(bot, from)) {
        bot.say(to, from + ': You are not an admin');
        return;
    }

    var moveFrom, moveTo, moveAmt;
    moveFrom = args[0];
    moveTo = args[1];
    moveAmt = parseFloat(args[2]);

    if (!this._isValidAmount(moveAmt)) {
        bot.say(to, from + ': Very confuse with amount ' + moveAmt + '?');
        return;
    }

    async.parallel([
        function(callback){ dogeClient.getaddress(moveFrom, callback); },
        function(callback){ dogeClient.getbalance(moveFrom, callback); },
        function(callback){ dogeClient.getaddress(moveTo, callback); }
    ], function (err, results) {
        if (err) {
            console.log(err);
            bot.say(to, sprintf('%s: Error fetching addresses.', from));
        } else {
            if (results[1] - moveAmt < 0.0) {
                bot.say(to, sprintf('%s: Insufficient funds', from));
                return;
            }

            dogeClient.move(moveFrom, moveTo, moveAmt, function (err, result) {
                if (err) {
                    bot.say(to, sprintf('%s: Error moving doge', from));
                } else {
                    bot.say(to, sprintf('%s: Moved Đ%s from %s to %s', from, moveAmt, moveFrom, moveTo));
                }
            });
        }
    });
};

/** Send doge to a nick's wallet */
DogeTip.prototype.sendto = function(bot, to, from, args, callback) {

    var dogeClient = new DogeClient(bot.pluginsConf['dogetip']);

    var sendTo, sendAmt;
    sendTo = args[0];
    sendAmt = parseFloat(args[1]);

    if (!this._isValidAmount(sendAmt)) {
        bot.say(to, from + ': Very confuse with amount ' + sendAmt + '?');
        return;
    }

    async.parallel([
        function(callback){ dogeClient.getaddress(from, callback); },
        function(callback){ dogeClient.getbalance(from, callback); }
    ], function (err, results) {
        if (err) {
            console.log(err);
            bot.say(to, sprintf('%s: Error fetching addresses.', from));
        } else {
            if (results[1] - (sendAmt + 1) < 0.0) {
                bot.say(to, sprintf('%s: Insufficient funds (remember: there is a 1 doge tx fee)', from));
                return;
            }

            dogeClient.sendfrom(from, sendTo, sendAmt, function (err, result) {
                if (err) {
                    bot.say(to, sprintf('%s: Error sending doge', from));
                } else {
                    bot.say(to, sprintf('%s: Sent Đ%s to %s (tx:%s)', from, sendAmt, sendTo, result));
                }
            });
        }
    });
};

exports.Plugin = DogeTip;