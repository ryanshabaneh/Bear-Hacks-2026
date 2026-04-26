const { init } = require("dcp-client");

let compute;
let wallet;
let initialized = false;

async function initDCP() {
  if (initialized) return;
  const scheduler = process.env.DCP_SCHEDULER || "https://scheduler.distributed.computer";
  await init(scheduler);
  compute = require("dcp/compute");
  wallet = require("dcp/wallet");

  wallet.passphrasePrompt = async () => "";

  await wallet.get("bearhacks");
  console.log(`[dcp] initialized. scheduler=${scheduler}`);

  initialized = true;
}

function getCompute() {
  if (!compute) throw new Error("DCP not initialized");
  return compute;
}

function getWallet() {
  if (!wallet) throw new Error("DCP not initialized");
  return wallet;
}

module.exports = { initDCP, getCompute, getWallet };
