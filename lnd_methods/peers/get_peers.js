const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {isLnd} = require('./../../lnd_requests');
const {rpcPeerAsPeer} = require('./../../lnd_responses');

const {isArray} = Array;
const method = 'listPeers';
const type = 'default';

/** Get connected peers.

  LND 0.8.2 and below do not return `features`

  {
    lnd: <Authenticated LND gRPC API Object>
  }

  @returns via cbk or Promise
  {
    peers: [{
      bytes_received: <Bytes Received Number>
      bytes_sent: <Bytes Sent Number>
      features: [{
        bit: <BOLT 09 Feature Bit Number>
        is_known: <Feature is Known Bool>
        is_required: <Feature Support is Required Bool>
        type: <Feature Type String>
      }]
      is_inbound: <Is Inbound Peer Bool>
      [is_sync_peer]: <Is Syncing Graph Data Bool>
      ping_time: <Milliseconds Number>
      public_key: <Public Key String>
      socket: <Network Address And Port String>
      tokens_received: <Amount Received Tokens Number>
      tokens_sent: <Amount Sent Tokens Number>
    }]
  }
*/
module.exports = ({lnd}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!isLnd({lnd, method, type})) {
          return cbk([400, 'ExpectedAuthenticatedLndToGetConnectedPeers']);
        }

        return cbk();
      },

      // List the set of connected peers
      listPeers: ['validate', ({}, cbk) => {
        return lnd[type][method]({}, (err, res) => {
          if (!!err) {
            return cbk([503, 'UnexpectedGetPeersError', {err}]);
          }

          if (!res) {
            return cbk([503, 'ExpectedResponseForListPeers']);
          }

          if (!isArray(res.peers)) {
            return cbk([503, 'ExpectedPeersArrayWhenListingPeers']);
          }

          return cbk(null, res.peers);
        });
      }],

      // Check the list of peers and map into final format
      peers: ['listPeers', ({listPeers}, cbk) => {
        try {
          return cbk(null, listPeers.map(peer => rpcPeerAsPeer(peer)));
        } catch (err) {
          return cbk([503, err.message]);
        }
      }],

      // Final set of peers
      finalPeers: ['peers', ({peers}, cbk) => cbk(null, {peers})],
    },
    returnResult({reject, resolve, of: 'finalPeers'}, cbk));
  });
};
