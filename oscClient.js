const osc = require("osc");
const { OSC_TARGET, OSC_PORT } = require("./constants");
const { Client } = require("node-osc");

async function sendOSC2(address, args = []) {
  console.log(`Sending OSC message to ${address} with args:`, args);
  const client = new Client(OSC_TARGET, OSC_PORT);

  await client.send(address, ...args);
  await client.close();
}

const udpPort = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 57121,
  remoteAddress: OSC_TARGET,
  remotePort: OSC_PORT,
});

udpPort.open();

function sendOSC(address, args = []) {
  udpPort.send({
    address,
    args,
  });
}

module.exports = {
  sendOSC,
  sendOSC2,
};
