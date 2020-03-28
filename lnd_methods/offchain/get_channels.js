const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {isLnd} = require('./../../lnd_requests');
const {rpcChannelAsChannel} = require('./../../lnd_responses');

const {isArray} = Array;
const method = 'listChannels';
const type = 'default';

/** Get channels

  `is_static_remote_key` will be undefined on LND 0.7.1 and below

  `cooperative_close_address` is not supported on LND 0.8.2 and below
  `time_offline` and `time_online` will be undefined on 0.8.2 and below

  {
    [is_active]: <Limit Results To Only Active Channels Bool> // false
    [is_offline]: <Limit Results To Only Offline Channels Bool> // false
    [is_private]: <Limit Results To Only Private Channels Bool> // false
    [is_public]: <Limit Results To Only Public Channels Bool> // false
    lnd: <Authenticated LND gRPC API Object>
    [partner_public_key]: <Public Key Hex String>
  }

  @returns via cbk or Promise
  {
    channels: [{
      capacity: <Channel Token Capacity Number>
      commit_transaction_fee: <Commit Transaction Fee Number>
      commit_transaction_weight: <Commit Transaction Weight Number>
      [cooperative_close_address]: <Coop Close Restricted to Address String>
      id: <Standard Format Channel Id String>
      is_active: <Channel Active Bool>
      is_closing: <Channel Is Closing Bool>
      is_opening: <Channel Is Opening Bool>
      is_partner_initiated: <Channel Partner Opened Channel Bool>
      is_private: <Channel Is Private Bool>
      [is_static_remote_key]: <Remote Key Is Static Bool>
      local_balance: <Local Balance Tokens Number>
      [local_pushed]: <Local Initially Pushed Tokens Number>
      local_reserve: <Local Reserved Tokens Number>
      partner_public_key: <Channel Partner Public Key String>
      pending_payments: [{
        id: <Payment Preimage Hash Hex String>
        is_outgoing: <Payment Is Outgoing Bool>
        timeout: <Chain Height Expiration Number>
        tokens: <Payment Tokens Number>
      }]
      received: <Received Tokens Number>
      remote_balance: <Remote Balance Tokens Number>
      [remote_pushed]: <Remote Initially Pushed Tokens Number>
      remote_reserve: <Remote Reserved Tokens Number>
      sent: <Sent Tokens Number>
      [time_offline]: <Monitoring Uptime Channel Down Milliseconds Number>
      [time_online]: <Monitoring Uptime Channel Up Milliseconds Number>
      transaction_id: <Blockchain Transaction Id String>
      transaction_vout: <Blockchain Transaction Vout Number>
      unsettled_balance: <Unsettled Balance Tokens Number>
    }]
  }
*/
module.exports = (args, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!isLnd({method, type, lnd: args.lnd})) {
          return cbk([400, 'ExpectedLndToGetChannels']);
        }

        return cbk();
      },

      // Get channels
      getChannels: ['validate', ({}, cbk) => {
        const peer = args.partner_public_key;

        return args.lnd[type][method]({
          active_only: !!args.is_active ? true : undefined,
          inactive_only: !!args.is_offline ? true : undefined,
          peer: !peer ? undefined : Buffer.from(peer, 'hex'),
          private_only: !!args.is_private ? true : undefined,
          public_only: !!args.is_public ? true : undefined,
        },
        (err, res) => {
          if (!!err) {
            return cbk([503, 'UnexpectedGetChannelsError', {err}]);
          }

          if (!res || !isArray(res.channels)) {
            return cbk([503, 'ExpectedChannelsArray']);
          }

          try {
            const channels = res.channels
              .map(rpcChannelAsChannel)
              .filter(channel => {
                // Exit early when a partner public key is not specified
                if (!args.partner_public_key) {
                  return true;
                }

                return channel.partner_public_key === args.partner_public_key
              });

            return cbk(null, {channels});
          } catch (err) {
            return cbk([503, err.message]);
          }
        });
      }],
    },
    returnResult({reject, resolve, of: 'getChannels'}, cbk));
  });
};
