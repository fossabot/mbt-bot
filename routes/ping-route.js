const nmap = require('node-nmap');

module.exports = {

    handle: function (ctx, message, sendMessage) {
        const quickScan = new nmap.nodenmap.QuickScan(ctx.config.network.address);

        ctx.dao.loadNetworkState((err, networkState)=> {

            if (err && Object.keys(networkState).length == 0) {
                let network = ctx.config.network;
                networkState = fillSubnetHosts(network.fixedPart, network.startIndex, network.endIndex, network.skippedHosts);
            }

            quickScan.on('complete', function (data) {
                let onlineHosts = [];
                data.forEach(function (host) {
                    onlineHosts.push(host.ip);
                });

                for (let hostIp in networkState) {
                    let response = hostIp + ' ' + (ctx.config.network.knownHosts[hostIp] != null ? ctx.config.network.knownHosts[hostIp] : '<b>?</b>');
                    if (!networkState[hostIp] & onlineHosts.indexOf(hostIp) >= 0) {
                        ctx.log.debug(hostIp + ' is up');
                        response += ' 👻';
                        sendMessage(ctx, message.from, response);
                        networkState[hostIp] = true;
                    }
                    if (networkState[hostIp] & onlineHosts.indexOf(hostIp) < 0) {
                        ctx.log.debug(hostIp + ' is down');
                        response += ' ☠';
                        sendMessage(ctx, message.from, response);
                        networkState[hostIp] = false;
                    }
                }
            });

            quickScan.on('error', function (error) {
                ctx.log.error(error);
            });

            quickScan.startScan();

            ctx.dao.saveNetworkState(networkState);
        });
    }
};

function fillSubnetHosts(constPart, startIndex, endIndex, excludedHosts) {
    let subnetHosts = {}
    for (let i = startIndex; i <= endIndex; i++) {
        let host = constPart + i;
        if (excludedHosts.indexOf(host) < 0) {
            subnetHosts[host] = false;
        }
    }
    return subnetHosts;
}