/**
 * Check the buyer wallet's USDC + gas balance on Arc Testnet.
 * Run: node --experimental-transform-types --no-warnings --env-file=.env.local scripts/balance.mts
 */
import { createPublicClient, http, erc20Abi, formatUnits, formatEther } from "viem";
import { arcTestnet } from "viem/chains";

const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;
const RPC = "https://rpc.testnet.arc.network";
const buyer = process.env.BUYER_ADDRESS as `0x${string}`;

const client = createPublicClient({ chain: arcTestnet, transport: http(RPC) });

async function main() {
  const gas = await client.getBalance({ address: buyer });
  const usdc = await client.readContract({
    address: ARC_TESTNET_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [buyer],
  });
  console.log(`Buyer: ${buyer}`);
  console.log(`  Gas (native): ${formatEther(gas)}`);
  console.log(`  USDC:         ${formatUnits(usdc as bigint, 6)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });